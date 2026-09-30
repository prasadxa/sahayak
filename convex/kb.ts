import { embed, embedMany } from "ai";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

import { myProvider } from "@/lib/ai/models";
import { isStaffRole, KB_CATEGORIES, type KbCategory, type Role } from "@/lib/constants";
import { chunkText } from "@/lib/kb/chunk";
import { assertPublicHttpUrl } from "@/lib/kb/url-guard";

import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { requireStaff } from "./roles";

export type { KbCategory };

const categoryValidator = v.string();

const EMBEDDING_MODEL = "text-embedding-3-small";
const BACKFILL_BATCH = 32;
const DEFAULT_BACKFILL_BATCHES = 10;
/** Vector hits below this cosine score are treated as "no match". */
const MIN_VECTOR_SCORE = 0.3;
const MAX_LOGGED_QUERY = 500;
/** Longer search queries are cut to this before embedding (cost + log size). */
const MAX_QUERY_CHARS = 500;
/** Pages read per mutation by the migration and chunk deletion (~12 KB/row). */
const PAGE_SIZE = 100;
/** Fetched web pages larger than this are refused. */
const MAX_PAGE_BYTES = 5 * 1024 * 1024;
const NOT_FOUND = "No relevant information found in the knowledge base.";
const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 20_000;

type IngestResult = { entryId: string; chunks: number; embedded: boolean };
type BackfillResult = { embedded: number; remaining: number };

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Staff check for actions (which have no ctx.db). Throws before any network call. */
async function requireStaffAction(ctx: ActionCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  const role: Role = await ctx.runQuery(internal.roles.roleOf, { userId });
  if (!isStaffRole(role)) throw new Error("Forbidden");
  return userId;
}

async function embedChunks(chunks: string[]): Promise<number[][]> {
  if (chunks.length === 0) return [];
  const { embeddings } = await embedMany({
    model: myProvider.textEmbeddingModel(EMBEDDING_MODEL),
    values: chunks.map((c) => c.replaceAll("\n", " ")),
    maxRetries: 1,
  });
  return embeddings;
}

// ---------------------------------------------------------------------------
// kb_sources: one small summary row per entry, so nothing that lists or counts
// entries has to read the chunk rows (each carries a 1536-float embedding).

async function sourceRow(
  ctx: QueryCtx | MutationCtx,
  entryId: string
): Promise<Doc<"kb_sources"> | null> {
  return await ctx.db
    .query("kb_sources")
    .withIndex("by_entry", (q) => q.eq("entryId", entryId))
    .unique();
}

/** Totals across all sources, for the dashboard and the backfill. */
export async function kbTotals(
  ctx: QueryCtx | MutationCtx
): Promise<{ sources: number; chunks: number; pendingEmbeddings: number }> {
  let sources = 0;
  let chunks = 0;
  let pendingEmbeddings = 0;
  for await (const s of ctx.db.query("kb_sources")) {
    sources++;
    chunks += s.chunks;
    pendingEmbeddings += s.pendingEmbeddings;
  }
  return { sources, chunks, pendingEmbeddings };
}

// ---------------------------------------------------------------------------
// Internal data access

export const insertChunks = internalMutation({
  args: {
    entryId: v.string(),
    title: v.string(),
    category: categoryValidator,
    source: v.optional(v.string()),
    chunks: v.array(
      v.object({ content: v.string(), embedding: v.optional(v.array(v.float64())) })
    ),
    createdBy: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await sourceRow(ctx, args.entryId);
    const offset = existing?.chunks ?? 0;
    let pending = 0;
    for (let i = 0; i < args.chunks.length; i++) {
      const { content, embedding } = args.chunks[i];
      if (!embedding) pending++;
      await ctx.db.insert("kb_entries", {
        entryId: args.entryId,
        title: args.title,
        category: args.category,
        source: args.source,
        content,
        chunkIndex: offset + i,
        ...(embedding ? { embedding } : { needsEmbedding: true }),
        createdBy: args.createdBy,
        createdAt: now,
      });
    }
    if (existing) {
      await ctx.db.patch(existing._id, {
        chunks: existing.chunks + args.chunks.length,
        pendingEmbeddings: existing.pendingEmbeddings + pending,
      });
    } else {
      await ctx.db.insert("kb_sources", {
        entryId: args.entryId,
        title: args.title,
        category: args.category,
        source: args.source,
        chunks: args.chunks.length,
        pendingEmbeddings: pending,
        createdBy: args.createdBy,
        createdAt: now,
      });
    }
    return args.chunks.length;
  },
});

/** Full-text search over chunk content; works whether or not chunks are embedded. */
export const textSearch = internalQuery({
  args: {
    query: v.string(),
    category: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Doc<"kb_entries">[]> => {
    if (!args.query.trim()) return [];
    return await ctx.db
      .query("kb_entries")
      .withSearchIndex("search_content", (q) => {
        const s = q.search("content", args.query);
        return args.category ? s.eq("category", args.category) : s;
      })
      .take(Math.min(Math.max(args.limit ?? 6, 1), 16));
  },
});

export const fetchMany = internalQuery({
  args: { ids: v.array(v.id("kb_entries")) },
  handler: async (ctx, args) => {
    return await Promise.all(args.ids.map((id) => ctx.db.get(id)));
  },
});

/** Up to `limit` chunks that still need an embedding. */
export const chunksMissingEmbedding = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, args): Promise<{ _id: Id<"kb_entries">; content: string }[]> => {
    const rows = await ctx.db
      .query("kb_entries")
      .withIndex("by_needsEmbedding", (q) => q.eq("needsEmbedding", true))
      .take(Math.max(1, Math.floor(args.limit)));
    return rows.map((r) => ({ _id: r._id, content: r.content }));
  },
});

export const countMissingEmbeddings = internalQuery({
  args: {},
  handler: async (ctx): Promise<number> => (await kbTotals(ctx)).pendingEmbeddings,
});

export const setEmbeddings = internalMutation({
  args: {
    updates: v.array(v.object({ id: v.id("kb_entries"), embedding: v.array(v.float64()) })),
  },
  handler: async (ctx, args) => {
    let patched = 0;
    const newlyEmbedded = new Map<string, number>();
    for (const { id, embedding } of args.updates) {
      const row = await ctx.db.get(id);
      if (!row) continue;
      if (row.embedding === undefined) {
        newlyEmbedded.set(row.entryId, (newlyEmbedded.get(row.entryId) ?? 0) + 1);
      }
      await ctx.db.patch(id, { embedding, needsEmbedding: undefined });
      patched++;
    }
    for (const [entryId, n] of newlyEmbedded) {
      const src = await sourceRow(ctx, entryId);
      if (src) {
        await ctx.db.patch(src._id, {
          pendingEmbeddings: Math.max(0, src.pendingEmbeddings - n),
        });
      }
    }
    return patched;
  },
});

export const logQuery = internalMutation({
  args: {
    query: v.string(),
    category: v.optional(v.string()),
    language: v.optional(v.string()),
    hits: v.number(),
    topScore: v.optional(v.number()),
    mode: v.union(v.literal("vector"), v.literal("text"), v.literal("none")),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("kb_queries", {
      ...args,
      query: args.query.slice(0, MAX_LOGGED_QUERY),
      createdAt: Date.now(),
    });
    return null;
  },
});

export const hasTitle = internalQuery({
  args: { title: v.string() },
  handler: async (ctx, args): Promise<boolean> => {
    const row = await ctx.db
      .query("kb_sources")
      .withIndex("by_title", (q) => q.eq("title", args.title))
      .first();
    return row !== null;
  },
});

// ---------------------------------------------------------------------------
// Ingestion

/** Chunk → embed (best effort) → insert. An embeddings outage never fails ingestion. */
async function ingest(
  ctx: ActionCtx,
  userId: Id<"users"> | undefined,
  args: { title: string; category: string; source?: string; content: string }
): Promise<IngestResult> {
  if (!(KB_CATEGORIES as readonly string[]).includes(args.category)) {
    throw new Error(
      `Invalid category "${args.category}". Use one of: ${KB_CATEGORIES.join(", ")}`
    );
  }
  const title = args.title.trim();
  if (!title) throw new Error("Title is required.");
  const chunks = chunkText(args.content);
  if (chunks.length === 0) {
    throw new Error("No usable text found to index.");
  }

  let embeddings: number[][] | null = null;
  try {
    embeddings = await embedChunks(chunks);
  } catch (e) {
    console.error(
      `[kb] embeddings unavailable; storing ${chunks.length} chunks of "${title}" without embeddings (run backfill later): ${errorMessage(e)}`
    );
  }

  const entryId = crypto.randomUUID();
  const count: number = await ctx.runMutation(internal.kb.insertChunks, {
    entryId,
    title,
    category: args.category,
    source: args.source,
    chunks: chunks.map((content, i) =>
      embeddings?.[i] ? { content, embedding: embeddings[i] } : { content }
    ),
    createdBy: userId,
  });
  return { entryId, chunks: count, embedded: embeddings !== null };
}

export const ingestText = action({
  args: {
    title: v.string(),
    category: categoryValidator,
    content: v.string(),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<IngestResult> => {
    const userId = await requireStaffAction(ctx);
    return await ingest(ctx, userId, args);
  },
});

/**
 * Read a response body as text, at most `maxBytes`, giving up when `signal`
 * aborts (the fetch timeout covers the body too, so a slow drip can't hang).
 */
async function readCappedText(
  res: Response,
  signal: AbortSignal,
  maxBytes: number
): Promise<string> {
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await res.body?.cancel().catch(() => {});
    throw new Error("Page too large");
  }
  if (!res.body) return "";
  const reader = res.body.getReader();
  let onAbort = () => {};
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(new Error("aborted"));
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  });
  aborted.catch(() => {});

  const parts: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await Promise.race([reader.read(), aborted]);
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new Error("Page too large");
      parts.push(value);
    }
  } catch (e) {
    void reader.cancel().catch(() => {});
    throw e;
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    bytes.set(p, offset);
    offset += p.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Fetch a public URL, validating every redirect hop against the SSRF guard.
 * One timeout covers the whole exchange, body included; bodies over
 * MAX_PAGE_BYTES are refused.
 */
async function fetchPublicPage(raw: string): Promise<{ status: number; text: string | null }> {
  let current = assertPublicHttpUrl(raw);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const res = await fetch(current.toString(), {
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": "SahayakKB/1.0" },
      });
      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        await res.body?.cancel().catch(() => {});
        current = assertPublicHttpUrl(new URL(location, current).toString());
        continue;
      }
      // If the runtime followed redirects itself, re-check where we ended up.
      if (res.url) assertPublicHttpUrl(res.url);
      if (!res.ok) {
        await res.body?.cancel().catch(() => {});
        return { status: res.status, text: null };
      }
      return {
        status: res.status,
        text: await readCappedText(res, controller.signal, MAX_PAGE_BYTES),
      };
    }
    throw new Error("Too many redirects");
  } catch (e) {
    if (controller.signal.aborted) {
      throw new Error(`Timed out fetching URL after ${FETCH_TIMEOUT_MS / 1000}s`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export const ingestUrl = action({
  args: {
    url: v.string(),
    category: categoryValidator,
    title: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<IngestResult> => {
    const userId = await requireStaffAction(ctx);
    const target = assertPublicHttpUrl(args.url);

    const page = await fetchPublicPage(target.toString());
    if (page.text === null) {
      throw new Error(`Failed to fetch URL (${page.status})`);
    }
    const html = page.text;
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();

    const title =
      args.title?.trim() ||
      (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? target.toString()).trim();

    return await ingest(ctx, userId, {
      title,
      category: args.category,
      source: target.toString(),
      content: text.slice(0, 200_000),
    });
  },
});

export const ingestFile = action({
  args: {
    storageId: v.id("_storage"),
    title: v.string(),
    category: categoryValidator,
    filename: v.string(),
  },
  handler: async (ctx, args): Promise<IngestResult> => {
    const userId = await requireStaffAction(ctx);

    const blob = await ctx.storage.get(args.storageId);
    if (!blob) throw new Error("File not found in storage");
    const bytes = await blob.arrayBuffer();

    const isPdf =
      args.filename.toLowerCase().endsWith(".pdf") || blob.type.includes("pdf");

    let text: string;
    if (isPdf) {
      const { extractText } = await import("unpdf");
      const result = await extractText(new Uint8Array(bytes));
      text = Array.isArray(result.text)
        ? result.text.join("\n")
        : (result.text as unknown as string);
    } else {
      text = new TextDecoder().decode(bytes);
    }

    const result = await ingest(ctx, userId, {
      title: args.title,
      category: args.category,
      source: args.filename,
      content: text,
    });
    // The text now lives in kb_entries; the upload isn't needed any more.
    try {
      await ctx.storage.delete(args.storageId);
    } catch (e) {
      console.error(`[kb] could not delete uploaded file ${args.storageId}: ${errorMessage(e)}`);
    }
    return result;
  },
});

/** CLI seeder entry point (`npx convex run kb:seedIngest`). Internal, so no auth. */
export const seedIngest = internalAction({
  args: {
    title: v.string(),
    category: categoryValidator,
    source: v.optional(v.string()),
    content: v.string(),
  },
  handler: async (ctx, args): Promise<IngestResult> => {
    return await ingest(ctx, undefined, args);
  },
});

// ---------------------------------------------------------------------------
// Embedding backfill

async function runBackfill(ctx: ActionCtx, maxBatches: number): Promise<BackfillResult> {
  let embedded = 0;
  for (let batch = 0; batch < maxBatches; batch++) {
    const rows: { _id: Id<"kb_entries">; content: string }[] = await ctx.runQuery(
      internal.kb.chunksMissingEmbedding,
      { limit: BACKFILL_BATCH }
    );
    if (rows.length === 0) break;
    let vectors: number[][];
    try {
      vectors = await embedChunks(rows.map((r) => r.content));
    } catch (e) {
      console.error(`[kb] backfill stopped after ${embedded} chunks: ${errorMessage(e)}`);
      if (embedded === 0) {
        throw new Error(`Embeddings service unavailable: ${errorMessage(e)}`);
      }
      break;
    }
    const patched: number = await ctx.runMutation(internal.kb.setEmbeddings, {
      updates: rows.map((r, i) => ({ id: r._id, embedding: vectors[i] })),
    });
    embedded += patched;
  }
  const remaining: number = await ctx.runQuery(internal.kb.countMissingEmbeddings, {});
  return { embedded, remaining };
}

export const backfillEmbeddings = action({
  args: {},
  handler: async (ctx): Promise<BackfillResult> => {
    await requireStaffAction(ctx);
    return await runBackfill(ctx, DEFAULT_BACKFILL_BATCHES);
  },
});

export const backfillEmbeddingsInternal = internalAction({
  args: { maxBatches: v.optional(v.number()) },
  handler: async (ctx, args): Promise<BackfillResult> => {
    return await runBackfill(ctx, Math.max(1, args.maxBatches ?? DEFAULT_BACKFILL_BATCHES));
  },
});

// ---------------------------------------------------------------------------
// Search

function formatResults(docs: Doc<"kb_entries">[]): string {
  return docs
    .map(
      (d, i) =>
        `[${i + 1}] Source: ${d.title}${d.source ? ` (${d.source})` : ""} [${d.category}]\n${d.content}`
    )
    .join("\n\n---\n\n");
}

/** Vector hits and full-text hits alternated, de-duplicated by _id, at most `limit`. */
function mergeHits(
  vector: Doc<"kb_entries">[],
  text: Doc<"kb_entries">[],
  limit: number
): Doc<"kb_entries">[] {
  const out: Doc<"kb_entries">[] = [];
  const seen = new Set<Id<"kb_entries">>();
  for (let i = 0; out.length < limit && (i < vector.length || i < text.length); i++) {
    for (const d of [vector[i], text[i]]) {
      if (d && !seen.has(d._id) && out.length < limit) {
        seen.add(d._id);
        out.push(d);
      }
    }
  }
  return out;
}

/**
 * Search the shared knowledge base: vector first, full-text fallback. While
 * some chunks still await embeddings, full-text hits are merged in so new
 * content is findable before the backfill. Requires sign-in (every search
 * costs an embedding call and is logged to the officer dashboard).
 */
export const searchKnowledgeBase = action({
  args: {
    query: v.string(),
    category: v.optional(v.string()),
    k: v.optional(v.number()),
    language: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<string> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const query = args.query.slice(0, MAX_QUERY_CHARS);
    const limit = Math.min(Math.max(Math.floor(args.k ?? 6), 1), 16);
    const category = args.category || undefined;

    let vectorDocs: Doc<"kb_entries">[] = [];
    let textDocs: Doc<"kb_entries">[] = [];
    let topScore: number | undefined;

    if (query.trim()) {
      try {
        const { embedding } = await embed({
          model: myProvider.textEmbeddingModel(EMBEDDING_MODEL),
          value: query.replaceAll("\n", " "),
          maxRetries: 0,
        });
        const results = await ctx.vectorSearch("kb_entries", "by_embedding", {
          vector: embedding,
          limit,
          filter: category ? (q) => q.eq("category", category) : undefined,
        });
        const good = results.filter((r) => r._score >= MIN_VECTOR_SCORE);
        if (good.length > 0) {
          const fetched: (Doc<"kb_entries"> | null)[] = await ctx.runQuery(
            internal.kb.fetchMany,
            { ids: good.map((r) => r._id) }
          );
          vectorDocs = fetched.filter((d): d is Doc<"kb_entries"> => d !== null);
          if (vectorDocs.length > 0) topScore = good[0]._score;
        }
      } catch (e) {
        console.error(`[kb] vector search unavailable, using full-text: ${errorMessage(e)}`);
      }

      const pending: number =
        vectorDocs.length === 0 ? 0 : await ctx.runQuery(internal.kb.countMissingEmbeddings, {});
      if (vectorDocs.length === 0 || pending > 0) {
        textDocs = await ctx.runQuery(internal.kb.textSearch, { query, category, limit });
      }
    }

    const docs = mergeHits(vectorDocs, textDocs, limit);
    const mode: "vector" | "text" | "none" =
      vectorDocs.length > 0 ? "vector" : docs.length > 0 ? "text" : "none";

    await ctx.runMutation(internal.kb.logQuery, {
      query,
      category,
      language: args.language,
      hits: docs.length,
      topScore,
      mode,
    });

    return docs.length === 0 ? NOT_FOUND : formatResults(docs);
  },
});

// ---------------------------------------------------------------------------
// Management

export const listEntries = query({
  args: {},
  handler: async (ctx) => {
    // Signed-in only (the /knowledge page is behind the middleware too).
    if (!(await getAuthUserId(ctx))) return [];
    const rows = await ctx.db.query("kb_sources").collect();
    return rows
      .map((s) => ({
        entryId: s.entryId,
        title: s.title,
        category: s.category,
        source: s.source,
        chunks: s.chunks,
        pendingEmbeddings: s.pendingEmbeddings,
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
  },
});

/** Delete up to PAGE_SIZE chunks of an entry; reschedules itself for the rest. */
async function deleteChunkPage(ctx: MutationCtx, entryId: string): Promise<number> {
  const rows = await ctx.db
    .query("kb_entries")
    .withIndex("by_entry", (q) => q.eq("entryId", entryId))
    .take(PAGE_SIZE);
  for (const row of rows) {
    await ctx.db.delete(row._id);
  }
  if (rows.length === PAGE_SIZE) {
    await ctx.scheduler.runAfter(0, internal.kb.deleteChunks, { entryId });
  }
  return rows.length;
}

export const deleteChunks = internalMutation({
  args: { entryId: v.string() },
  handler: async (ctx, args) => deleteChunkPage(ctx, args.entryId),
});

/** Returns the number of chunks the entry had. Large entries finish deleting in the background. */
export const deleteEntry = mutation({
  args: { entryId: v.string() },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const src = await sourceRow(ctx, args.entryId);
    if (src) await ctx.db.delete(src._id);
    const deleted = await deleteChunkPage(ctx, args.entryId);
    return src?.chunks ?? deleted;
  },
});

// ---------------------------------------------------------------------------
// Migration: `npx convex run kb:migrateSources '{}'`

export const clearSourcesPage = internalMutation({
  args: {},
  handler: async (ctx): Promise<number> => {
    const rows = await ctx.db.query("kb_sources").take(PAGE_SIZE);
    for (const row of rows) await ctx.db.delete(row._id);
    return rows.length;
  },
});

/** Folds one page of chunks into kb_sources and fixes their needsEmbedding flag. */
export const migrateSourcesPage = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args): Promise<{ isDone: boolean; continueCursor: string }> => {
    const page = await ctx.db
      .query("kb_entries")
      .paginate({ numItems: PAGE_SIZE, cursor: args.cursor });
    const byEntry = new Map<string, { first: Doc<"kb_entries">; chunks: number; pending: number }>();
    for (const row of page.page) {
      const pending = row.embedding === undefined;
      if (pending && row.needsEmbedding !== true) {
        await ctx.db.patch(row._id, { needsEmbedding: true });
      } else if (!pending && row.needsEmbedding !== undefined) {
        await ctx.db.patch(row._id, { needsEmbedding: undefined });
      }
      const agg = byEntry.get(row.entryId) ?? { first: row, chunks: 0, pending: 0 };
      agg.chunks++;
      if (pending) agg.pending++;
      byEntry.set(row.entryId, agg);
    }
    for (const [entryId, agg] of byEntry) {
      const existing = await sourceRow(ctx, entryId);
      if (existing) {
        await ctx.db.patch(existing._id, {
          chunks: existing.chunks + agg.chunks,
          pendingEmbeddings: existing.pendingEmbeddings + agg.pending,
        });
      } else {
        await ctx.db.insert("kb_sources", {
          entryId,
          title: agg.first.title,
          category: agg.first.category,
          source: agg.first.source,
          chunks: agg.chunks,
          pendingEmbeddings: agg.pending,
          createdBy: agg.first.createdBy,
          createdAt: agg.first.createdAt,
        });
      }
    }
    return { isDone: page.isDone, continueCursor: page.continueCursor };
  },
});

export const sourceTotals = internalQuery({
  args: {},
  handler: async (ctx) => kbTotals(ctx),
});

/**
 * Rebuilds kb_sources from kb_entries, a page at a time, and sets
 * needsEmbedding on chunks without an embedding. Idempotent: it clears
 * kb_sources first. Run it while nobody is ingesting.
 */
export const migrateSources = internalAction({
  args: {},
  handler: async (
    ctx
  ): Promise<{ sources: number; chunks: number; pendingEmbeddings: number }> => {
    while ((await ctx.runMutation(internal.kb.clearSourcesPage, {})) === PAGE_SIZE) {
      // keep clearing
    }
    let cursor: string | null = null;
    for (;;) {
      const r: { isDone: boolean; continueCursor: string } = await ctx.runMutation(
        internal.kb.migrateSourcesPage,
        { cursor }
      );
      if (r.isDone) break;
      cursor = r.continueCursor;
    }
    return await ctx.runQuery(internal.kb.sourceTotals, {});
  },
});
