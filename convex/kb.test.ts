import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import { asUser } from "./test.helpers";

/** searchKnowledgeBase consumes a rate-limit bucket — register the component. */
function testConvex() {
  const t = convexTest(schema, modules);
  registerRateLimiter(t);
  return t;
}

const PMFBY_TEXT =
  "Under PMFBY the farmer premium is 2% of the sum insured for kharif crops and 1.5% for rabi crops. " +
  "Annual commercial and horticultural crops carry a 5% farmer premium.";
const KCC_TEXT =
  "The Kisan Credit Card gives farmers short-term crop loans with interest subvention for prompt repayment.";

/** listEntries requires sign-in; read it as a plain member. */
async function listAsMember(t: TestConvex<typeof schema>) {
  const { client } = await asUser(t, { email: `reader${Math.random()}@example.com` });
  return await client.query(api.kb.listEntries, {});
}

/** Simulate the CallMissed embeddings outage (HTTP 502) for every fetch. */
function embeddingsDown() {
  const fetchMock = vi.fn(
    async () => new Response("Bad Gateway", { status: 502, statusText: "Bad Gateway" })
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** A working OpenAI-compatible /embeddings endpoint. */
function embeddingsUp() {
  const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    const inputs: unknown[] = Array.isArray(body.input) ? body.input : [body.input];
    return new Response(
      JSON.stringify({
        object: "list",
        data: inputs.map((_, index) => ({
          object: "embedding",
          index,
          embedding: Array<number>(1536).fill(0.01),
        })),
        model: "text-embedding-3-small",
        usage: { prompt_tokens: 1, total_tokens: 1 },
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function seedChunks(t: ReturnType<typeof convexTest>) {
  await t.mutation(internal.kb.insertChunks, {
    entryId: "entry-pmfby",
    title: "PMFBY basics",
    category: "pmfby",
    source: "https://pmfby.gov.in/",
    chunks: [{ content: PMFBY_TEXT }],
  });
  await t.mutation(internal.kb.insertChunks, {
    entryId: "entry-kcc",
    title: "KCC basics",
    category: "finance",
    chunks: [{ content: KCC_TEXT }, { content: KCC_TEXT, embedding: Array(1536).fill(0.02) }],
  });
}

describe("kb access control", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("forbids a member from deleting an entry", async () => {
    const t = testConvex();
    await seedChunks(t);
    const { client } = await asUser(t, { email: "farmer@example.com" });
    await expect(client.mutation(api.kb.deleteEntry, { entryId: "entry-pmfby" })).rejects.toThrow(
      /Forbidden/
    );
  });

  it("requires sign-in to delete an entry", async () => {
    const t = testConvex();
    await expect(t.mutation(api.kb.deleteEntry, { entryId: "entry-pmfby" })).rejects.toThrow(
      /Not authenticated/
    );
  });

  it("lets an officer delete an entry", async () => {
    const t = testConvex();
    await seedChunks(t);
    const { client } = await asUser(t, { email: "clerk@example.com", role: "officer" });
    expect(await client.mutation(api.kb.deleteEntry, { entryId: "entry-kcc" })).toBe(2);
    const titles = (await client.query(api.kb.listEntries, {})).map((e) => e.title);
    expect(titles).toEqual(["PMFBY basics"]);
  });

  it("forbids a member from ingesting text, before any network call", async () => {
    const t = testConvex();
    const fetchMock = embeddingsDown();
    const { client } = await asUser(t, { email: "farmer@example.com" });
    await expect(
      client.action(api.kb.ingestText, { title: "x", category: "general", content: KCC_TEXT })
    ).rejects.toThrow(/Forbidden/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a signed-out ingestText call", async () => {
    const t = testConvex();
    embeddingsDown();
    await expect(
      t.action(api.kb.ingestText, { title: "x", category: "general", content: KCC_TEXT })
    ).rejects.toThrow(/Not authenticated/);
  });

  it("forbids a member from ingesting a URL without fetching it", async () => {
    const t = testConvex();
    const fetchMock = embeddingsDown();
    const { client } = await asUser(t, { email: "farmer@example.com" });
    await expect(
      client.action(api.kb.ingestUrl, { url: "https://pmfby.gov.in/", category: "pmfby" })
    ).rejects.toThrow(/Forbidden/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forbids a member from running the embeddings backfill", async () => {
    const t = testConvex();
    const { client } = await asUser(t, { email: "farmer@example.com" });
    await expect(client.action(api.kb.backfillEmbeddings, {})).rejects.toThrow(/Forbidden/);
  });
});

describe("ingestUrl SSRF guard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(["http://127.0.0.1", "http://169.254.169.254/latest/meta-data/", "file:///etc/passwd"])(
    "rejects %s before fetching",
    async (url) => {
      const t = testConvex();
      const fetchMock = embeddingsDown();
      const { client } = await asUser(t, { email: "clerk@example.com", role: "officer" });
      await expect(client.action(api.kb.ingestUrl, { url, category: "general" })).rejects.toThrow(
        /not allowed/i
      );
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );

  it("refuses to follow a redirect to an internal address", async () => {
    const t = testConvex();
    const fetchMock = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: "http://169.254.169.254/latest/meta-data/" },
        })
    );
    vi.stubGlobal("fetch", fetchMock);
    const { client } = await asUser(t, { email: "clerk@example.com", role: "officer" });
    await expect(
      client.action(api.kb.ingestUrl, { url: "https://example.com/r", category: "general" })
    ).rejects.toThrow(/not allowed/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("kb with the embeddings API down", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores chunks without embeddings instead of failing ingestion", async () => {
    const t = testConvex();
    embeddingsDown();
    const { client } = await asUser(t, { email: "clerk@example.com", role: "officer" });
    const result = await client.action(api.kb.ingestText, {
      title: "PMFBY basics",
      category: "pmfby",
      content: PMFBY_TEXT,
    });
    expect(result.chunks).toBe(1);
    const rows = await t.run((ctx) => ctx.db.query("kb_entries").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].embedding).toBeUndefined();
    expect(rows[0].createdBy).toBeDefined();
  }, 20_000);

  it("finds un-embedded chunks by keyword through the internal full-text query", async () => {
    const t = testConvex();
    await seedChunks(t);
    const hits = await t.query(internal.kb.textSearch, { query: "rabi premium", limit: 5 });
    expect(hits.map((h) => h.title)).toContain("PMFBY basics");
    expect(hits[0].embedding).toBeUndefined();

    const filtered = await t.query(internal.kb.textSearch, {
      query: "premium",
      category: "finance",
      limit: 5,
    });
    expect(filtered.map((h) => h.title)).not.toContain("PMFBY basics");
  });

  it("falls back to full-text search and logs the query in text mode", async () => {
    const t = testConvex();
    await seedChunks(t);
    embeddingsDown();
    const { client } = await asUser(t, { email: "farmer@example.com" });
    const out = await client.action(api.kb.searchKnowledgeBase, {
      query: "PMFBY premium rabi",
      language: "hi",
    });
    expect(out).toContain("[1] Source: PMFBY basics (https://pmfby.gov.in/) [pmfby]");
    expect(out).toContain("1.5% for rabi");

    const logs = await t.run((ctx) => ctx.db.query("kb_queries").collect());
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ query: "PMFBY premium rabi", language: "hi", mode: "text" });
    expect(logs[0].hits).toBeGreaterThan(0);
  });

  it("returns the not-found message and logs mode none when nothing matches", async () => {
    const t = testConvex();
    await seedChunks(t);
    embeddingsDown();
    const { client } = await asUser(t, { email: "farmer@example.com" });
    const out = await client.action(api.kb.searchKnowledgeBase, { query: "zzzqqq" });
    expect(out).toBe("No relevant information found in the knowledge base.");
    const logs = await t.run((ctx) => ctx.db.query("kb_queries").collect());
    expect(logs[0]).toMatchObject({ hits: 0, mode: "none" });
  });

  it("truncates logged queries to 500 characters", async () => {
    const t = testConvex();
    await t.mutation(internal.kb.logQuery, {
      query: "a".repeat(900),
      hits: 0,
      mode: "none",
    });
    const logs = await t.run((ctx) => ctx.db.query("kb_queries").collect());
    expect(logs[0].query).toHaveLength(500);
  });
});

describe("kb listing, seeding and backfill", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports pending embeddings per entry", async () => {
    const t = testConvex();
    await seedChunks(t);
    const entries = await listAsMember(t);
    expect(entries).toEqual([
      expect.objectContaining({ title: "KCC basics", chunks: 2, pendingEmbeddings: 1 }),
      expect.objectContaining({ title: "PMFBY basics", chunks: 1, pendingEmbeddings: 1 }),
    ]);
  });

  it("lists nothing to a signed-out caller", async () => {
    const t = testConvex();
    await seedChunks(t);
    expect(await t.query(api.kb.listEntries, {})).toEqual([]);
    expect(await listAsMember(t)).toHaveLength(2);
  });

  it("hasTitle reports whether a title exists", async () => {
    const t = testConvex();
    await seedChunks(t);
    expect(await t.query(internal.kb.hasTitle, { title: "PMFBY basics" })).toBe(true);
    expect(await t.query(internal.kb.hasTitle, { title: "Nope" })).toBe(false);
  });

  it("seedIngest ingests without auth even when embeddings are down", async () => {
    const t = testConvex();
    embeddingsDown();
    const r = await t.action(internal.kb.seedIngest, {
      title: "PMFBY basics",
      category: "pmfby",
      source: "https://pmfby.gov.in/",
      content: PMFBY_TEXT,
    });
    expect(r.chunks).toBe(1);
    expect(await t.query(internal.kb.hasTitle, { title: "PMFBY basics" })).toBe(true);
  }, 20_000);

  it("seedIngest rejects an unknown category", async () => {
    const t = testConvex();
    embeddingsDown();
    await expect(
      t.action(internal.kb.seedIngest, { title: "x", category: "misc", content: PMFBY_TEXT })
    ).rejects.toThrow(/Invalid category/);
  });

  it("backfills missing embeddings in batches and reports what remains", async () => {
    const t = testConvex();
    await t.mutation(internal.kb.insertChunks, {
      entryId: "big",
      title: "Big",
      category: "general",
      chunks: Array.from({ length: 40 }, (_, i) => ({ content: `Chunk number ${i} ${KCC_TEXT}` })),
    });
    const fetchMock = embeddingsUp();

    const first = await t.action(internal.kb.backfillEmbeddingsInternal, { maxBatches: 1 });
    expect(first).toEqual({ embedded: 32, remaining: 8 });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const second = await t.action(internal.kb.backfillEmbeddingsInternal, {});
    expect(second).toEqual({ embedded: 8, remaining: 0 });

    const rows = await t.run((ctx) => ctx.db.query("kb_entries").collect());
    expect(rows.every((r) => r.embedding?.length === 1536)).toBe(true);
  });

  it("lets an officer run the backfill", async () => {
    const t = testConvex();
    await seedChunks(t);
    embeddingsUp();
    const { client } = await asUser(t, { email: "clerk@example.com", role: "officer" });
    expect(await client.action(api.kb.backfillEmbeddings, {})).toEqual({
      embedded: 2,
      remaining: 0,
    });
  });
});

describe("admin via ADMIN_EMAILS", () => {
  beforeEach(() => {
    process.env.ADMIN_EMAILS = "boss@example.com";
  });
  afterEach(() => {
    delete process.env.ADMIN_EMAILS;
    vi.unstubAllGlobals();
  });

  it("lets an ADMIN_EMAILS admin ingest text", async () => {
    const t = testConvex();
    embeddingsDown();
    const { client } = await asUser(t, { email: "boss@example.com", verified: true });
    const r = await client.action(api.kb.ingestText, {
      title: "KCC basics",
      category: "finance",
      content: KCC_TEXT,
    });
    expect(r.chunks).toBe(1);
  }, 20_000);
});

type TestT = ReturnType<typeof convexTest>;

async function sources(t: TestT) {
  const rows = await t.run((ctx) => ctx.db.query("kb_sources").collect());
  return rows
    .map((r) => ({
      entryId: r.entryId, title: r.title, category: r.category, source: r.source,
      chunks: r.chunks, pendingEmbeddings: r.pendingEmbeddings,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

/** Chunk rows as they existed before kb_sources / needsEmbedding. */
async function insertLegacyChunks(t: TestT) {
  await t.run(async (ctx) => {
    const now = Date.now();
    const emb = Array<number>(1536).fill(0.02);
    await ctx.db.insert("kb_entries", {
      entryId: "legacy-a", title: "Legacy A", category: "laws", content: KCC_TEXT,
      chunkIndex: 0, createdAt: now,
    });
    await ctx.db.insert("kb_entries", {
      entryId: "legacy-a", title: "Legacy A", category: "laws", content: PMFBY_TEXT,
      chunkIndex: 1, embedding: emb, createdAt: now,
    });
    await ctx.db.insert("kb_entries", {
      entryId: "legacy-b", title: "Legacy B", category: "pmfby", source: "https://pmfby.gov.in/",
      content: PMFBY_TEXT, chunkIndex: 0, createdAt: now,
    });
  });
}

describe("kb_sources summary table", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is written by insertChunks, and un-embedded chunks are flagged needsEmbedding", async () => {
    const t = testConvex();
    await seedChunks(t);
    expect(await sources(t)).toEqual([
      expect.objectContaining({ entryId: "entry-kcc", title: "KCC basics", category: "finance", chunks: 2, pendingEmbeddings: 1 }),
      expect.objectContaining({
        entryId: "entry-pmfby", title: "PMFBY basics", category: "pmfby",
        source: "https://pmfby.gov.in/", chunks: 1, pendingEmbeddings: 1,
      }),
    ]);
    const rows = await t.run((ctx) => ctx.db.query("kb_entries").collect());
    for (const r of rows) {
      expect(r.needsEmbedding).toBe(r.embedding === undefined ? true : undefined);
    }
  });

  it("is removed by deleteEntry", async () => {
    const t = testConvex();
    await seedChunks(t);
    const { client } = await asUser(t, { email: "clerk@example.com", role: "officer" });
    await client.mutation(api.kb.deleteEntry, { entryId: "entry-kcc" });
    expect((await sources(t)).map((s) => s.entryId)).toEqual(["entry-pmfby"]);
  });

  it("is decremented by the embeddings backfill, which also clears needsEmbedding", async () => {
    const t = testConvex();
    await seedChunks(t);
    embeddingsUp();
    expect(await t.action(internal.kb.backfillEmbeddingsInternal, {})).toEqual({
      embedded: 2,
      remaining: 0,
    });
    expect((await sources(t)).map((s) => s.pendingEmbeddings)).toEqual([0, 0]);
    const rows = await t.run((ctx) => ctx.db.query("kb_entries").collect());
    expect(rows.every((r) => r.needsEmbedding === undefined)).toBe(true);
    const listed = await listAsMember(t);
    expect(listed.map((e) => e.pendingEmbeddings)).toEqual([0, 0]);
  });

  it("drives listEntries, hasTitle and the backfill queue (legacy rows are invisible until migrated)", async () => {
    const t = testConvex();
    await insertLegacyChunks(t);
    expect(await listAsMember(t)).toEqual([]);
    expect(await t.query(internal.kb.hasTitle, { title: "Legacy A" })).toBe(false);
    expect(await t.query(internal.kb.chunksMissingEmbedding, { limit: 10 })).toEqual([]);
    expect(await t.query(internal.kb.countMissingEmbeddings, {})).toBe(0);
  });

  it("migrateSources backfills kb_sources and needsEmbedding from existing chunks", async () => {
    const t = testConvex();
    await insertLegacyChunks(t);
    const r = await t.action(internal.kb.migrateSources, {});
    expect(r).toEqual({ sources: 2, chunks: 3, pendingEmbeddings: 2 });

    expect(await listAsMember(t)).toEqual([
      expect.objectContaining({ entryId: "legacy-a", title: "Legacy A", chunks: 2, pendingEmbeddings: 1 }),
      expect.objectContaining({
        entryId: "legacy-b", title: "Legacy B", source: "https://pmfby.gov.in/",
        chunks: 1, pendingEmbeddings: 1,
      }),
    ]);
    expect(await t.query(internal.kb.hasTitle, { title: "Legacy A" })).toBe(true);
    expect(await t.query(internal.kb.countMissingEmbeddings, {})).toBe(2);
    const missing = await t.query(internal.kb.chunksMissingEmbedding, { limit: 10 });
    expect(missing).toHaveLength(2);
  });

  it("migrateSources is idempotent", async () => {
    const t = testConvex();
    await insertLegacyChunks(t);
    await seedChunks(t); // already has kb_sources rows
    const first = await t.action(internal.kb.migrateSources, {});
    const afterFirst = await sources(t);
    const second = await t.action(internal.kb.migrateSources, {});
    expect(second).toEqual(first);
    expect(first).toEqual({ sources: 4, chunks: 6, pendingEmbeddings: 4 });
    expect(await sources(t)).toEqual(afterFirst);
    expect(afterFirst).toHaveLength(4);
    const flagged = await t.run(async (ctx) =>
      (await ctx.db.query("kb_entries").collect()).filter((r) => r.needsEmbedding === true)
    );
    expect(flagged).toHaveLength(4);
  });
});

describe("searchKnowledgeBase access and limits", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects an anonymous search before any embedding call or log write", async () => {
    const t = testConvex();
    await seedChunks(t);
    const fetchMock = embeddingsUp();
    await expect(
      t.action(api.kb.searchKnowledgeBase, { query: "PMFBY premium" })
    ).rejects.toThrow(/Not authenticated/);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await t.run((ctx) => ctx.db.query("kb_queries").collect())).toHaveLength(0);
  });

  it("caps the query at 500 characters before embedding it", async () => {
    const t = testConvex();
    await seedChunks(t);
    const fetchMock = embeddingsUp();
    const { client } = await asUser(t, { email: "farmer@example.com" });
    await client.action(api.kb.searchKnowledgeBase, { query: `PMFBY ${"a".repeat(5000)}` });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    const input = Array.isArray(body.input) ? body.input[0] : body.input;
    expect(input.length).toBeLessThanOrEqual(500);
    expect(input.startsWith("PMFBY a")).toBe(true);
  });

  it("merges full-text hits for un-embedded chunks with good vector hits", async () => {
    const t = testConvex();
    await t.mutation(internal.kb.insertChunks, {
      entryId: "kcc", title: "KCC basics", category: "finance",
      chunks: [{ content: KCC_TEXT, embedding: Array<number>(1536).fill(0.01) }],
    });
    await t.mutation(internal.kb.insertChunks, {
      entryId: "pmfby", title: "PMFBY basics", category: "pmfby",
      chunks: [{ content: PMFBY_TEXT }],
    });
    embeddingsUp();
    const [kcc] = await t.run((ctx) =>
      ctx.db.query("kb_entries").withIndex("by_entry", (q) => q.eq("entryId", "kcc")).collect()
    );
    // convex-test's fake vector index scores rows that lack the vector field
    // and crashes; real Convex leaves them out. Stub the index: KCC scores 0.99.
    const g = globalThis as unknown as {
      Convex: { syscall: unknown; jsSyscall: unknown; asyncSyscall: (op: string, a: string) => Promise<string> };
    };
    const original = g.Convex;
    g.Convex = {
      get syscall() { return original.syscall; },
      get jsSyscall() { return original.jsSyscall; },
      get asyncSyscall() {
        const inner = original.asyncSyscall;
        return async (op: string, a: string) =>
          op === "1.0/actions/vectorSearch"
            ? JSON.stringify({ results: [{ _id: kcc._id, _score: 0.99 }] })
            : inner(op, a);
      },
    };
    onTestFinished(() => {
      g.Convex = original;
    });
    const { client } = await asUser(t, { email: "farmer@example.com" });

    const out = await client.action(api.kb.searchKnowledgeBase, {
      query: "Kisan Credit rabi premium",
    });
    expect(out).toContain("Source: KCC basics");
    expect(out).toContain("Source: PMFBY basics");
    expect(out.match(/Source: KCC basics/g)).toHaveLength(1); // de-duplicated

    const one = await client.action(api.kb.searchKnowledgeBase, {
      query: "Kisan Credit rabi premium",
      k: 1,
    });
    expect(one).toContain("[1] Source:");
    expect(one).not.toContain("[2] Source:");

    const logs = await t.run((ctx) => ctx.db.query("kb_queries").collect());
    expect(logs[0]).toMatchObject({ mode: "vector", hits: 2 });
  });
});

describe("ingestUrl body limits", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("stops reading a page larger than 5 MB", async () => {
    const t = testConvex();
    let pulls = 0;
    const mb = new Uint8Array(1024 * 1024).fill(97);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            pull(controller) {
              pulls++;
              if (pulls > 50) controller.close();
              else controller.enqueue(mb);
            },
          }),
          { status: 200, headers: { "content-type": "text/html" } }
        )
      )
    );
    const { client } = await asUser(t, { email: "clerk@example.com", role: "officer" });
    await expect(
      client.action(api.kb.ingestUrl, { url: "https://example.com/huge", category: "general" })
    ).rejects.toThrow(/Page too large/);
    expect(pulls).toBeLessThan(10);
  });

  it("times out a body that drips forever", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const t = testConvex();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new TextEncoder().encode("<html>"));
              // never closes
            },
          }),
          { status: 200, headers: { "content-type": "text/html" } }
        )
      )
    );
    const { client } = await asUser(t, { email: "clerk@example.com", role: "officer" });
    const run = client.action(api.kb.ingestUrl, {
      url: "https://example.com/slow",
      category: "general",
    });
    const settled = run.then(
      () => "resolved",
      (e: Error) => e.message
    );
    await vi.advanceTimersByTimeAsync(25_000);
    const outcome = await Promise.race([
      settled,
      new Promise((r) => setImmediate(() => r("still hanging"))),
    ]);
    expect(outcome).toMatch(/timed out/i);
  });
});

describe("ingestFile storage cleanup", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("deletes the uploaded file after a successful ingestion", async () => {
    const t = testConvex();
    embeddingsDown();
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob([KCC_TEXT], { type: "text/plain" }))
    );
    const { client } = await asUser(t, { email: "clerk@example.com", role: "officer" });
    const r = await client.action(api.kb.ingestFile, {
      storageId, title: "KCC", category: "finance", filename: "kcc.txt",
    });
    expect(r.chunks).toBe(1);
    expect(await t.run((ctx) => ctx.storage.getUrl(storageId))).toBeNull();
  }, 20_000);

  it("keeps the file when ingestion fails", async () => {
    const t = testConvex();
    embeddingsDown();
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob([KCC_TEXT], { type: "text/plain" }))
    );
    const { client } = await asUser(t, { email: "clerk@example.com", role: "officer" });
    await expect(
      client.action(api.kb.ingestFile, {
        storageId, title: "KCC", category: "misc", filename: "kcc.txt",
      })
    ).rejects.toThrow(/Invalid category/);
    expect(await t.run((ctx) => ctx.storage.getUrl(storageId))).not.toBeNull();
  });
});
