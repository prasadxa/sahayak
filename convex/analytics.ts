import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireStaff } from "./roles";
import { grievanceStats } from "./grievances";
import { kbTotals } from "./kb";

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_MS = 30 * DAY_MS;
const UNANSWERED_LIMIT = 20;
/** Newest kb_queries rows read for the 30-day breakdown. */
const QUERY_SCAN_CAP = 5000;
/** Extra rows (older than 30 days) scanned for unanswered questions. */
const OLDER_UNANSWERED_SCAN = 1000;

/**
 * Convex object keys must be ≤1024 chars, not start with "$" and contain
 * only non-control ASCII (the byDistrict fix in grievances.ts hit the same
 * rule). kb_queries.language arrives from the caller's `sahayak-lang`
 * cookie and category is a free-form searchKnowledgeBase action arg, so a
 * crafted value ("हिन्दी", "$eq", …) would crash this query while the result
 * is serialised — fold invalid keys into "other".
 */
const INVALID_KEY_CHARS = /[^\x20-\x7e]/;
function safeKey(key: string): string {
  return key !== "" &&
    key.length <= 1024 &&
    !key.startsWith("$") &&
    !INVALID_KEY_CHARS.test(key)
    ? key
    : "other";
}

function bump(map: Record<string, number>, key: string) {
  const k = safeKey(key);
  map[k] = (map[k] ?? 0) + 1;
}

/**
 * Officer dashboard aggregates.
 *
 * KB counts come from the small `kb_sources` rows (never the chunk rows,
 * which carry embeddings). Query stats read at most the newest
 * QUERY_SCAN_CAP rows of the last 30 days; `queries.truncated` says when the
 * cap was hit. Grievance stats still scan the table (see grievances.ts).
 */
export const overview = query({
  // Optional caller clock (see grievances.ts nowArg) so SLA counts and the
  // 30-day window move forward even when no rows change.
  args: { now: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const now = args.now ?? Date.now();

    const grievances = await grievanceStats(ctx, now);

    const totals = await kbTotals(ctx);

    const since = now - WINDOW_MS;
    const scanned = await ctx.db
      .query("kb_queries")
      .withIndex("by_createdAt", (q) => q.gte("createdAt", since))
      .order("desc")
      .take(QUERY_SCAN_CAP + 1);
    const truncated = scanned.length > QUERY_SCAN_CAP;
    const recent = truncated ? scanned.slice(0, QUERY_SCAN_CAP) : scanned;

    // Null-prototype maps: "constructor"/"hasOwnProperty" are legal Convex
    // keys that would read the prototype on a plain object (a "__proto__"
    // key is silently dropped on the wire either way).
    const byLanguage: Record<string, number> = Object.create(null);
    const byCategory: Record<string, number> = Object.create(null);
    const byMode: Record<string, number> = { vector: 0, text: 0, none: 0 };
    for (const r of recent) {
      bump(byLanguage, r.language ?? "unknown");
      bump(byCategory, r.category ?? "unspecified");
      bump(byMode, r.mode);
    }

    // Most recent unanswered questions: the knowledge gaps to fill. Look in
    // the rows already read, then (bounded) in older ones.
    // Repeats of the same question (case/spacing-insensitive) are one row with
    // a count, keeping the most recent time; rows arrive newest first.
    const unanswered: {
      query: string;
      language?: string;
      createdAt: number;
      count: number;
    }[] = [];
    const seen = new Map<string, (typeof unanswered)[number]>();
    const collect = (r: (typeof recent)[number]) => {
      if (!(r.hits === 0 || r.mode === "none")) return;
      const key = r.query.trim().replace(/\s+/g, " ").toLowerCase();
      const existing = seen.get(key);
      if (existing) {
        existing.count += 1;
        return;
      }
      if (unanswered.length >= UNANSWERED_LIMIT) return;
      const row = {
        query: r.query.trim(),
        ...(r.language ? { language: r.language } : {}),
        createdAt: r.createdAt,
        count: 1,
      };
      seen.set(key, row);
      unanswered.push(row);
    };
    recent.forEach(collect);
    if (unanswered.length < UNANSWERED_LIMIT && !truncated) {
      const older = await ctx.db
        .query("kb_queries")
        .withIndex("by_createdAt", (q) => q.lt("createdAt", since))
        .order("desc")
        .take(OLDER_UNANSWERED_SCAN);
      older.forEach(collect);
    }

    return {
      grievances,
      kb: {
        entries: totals.sources,
        chunks: totals.chunks,
        pendingEmbeddings: totals.pendingEmbeddings,
      },
      queries: { total: recent.length, truncated, byLanguage, byCategory, byMode },
      unanswered,
    };
  },
});
