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

function bump(map: Record<string, number>, key: string) {
  map[key] = (map[key] ?? 0) + 1;
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
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);

    const grievances = await grievanceStats(ctx);

    const totals = await kbTotals(ctx);

    const since = Date.now() - WINDOW_MS;
    const scanned = await ctx.db
      .query("kb_queries")
      .withIndex("by_createdAt", (q) => q.gte("createdAt", since))
      .order("desc")
      .take(QUERY_SCAN_CAP + 1);
    const truncated = scanned.length > QUERY_SCAN_CAP;
    const recent = truncated ? scanned.slice(0, QUERY_SCAN_CAP) : scanned;

    const byLanguage: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const byMode: Record<string, number> = { vector: 0, text: 0, none: 0 };
    for (const r of recent) {
      bump(byLanguage, r.language ?? "unknown");
      bump(byCategory, r.category ?? "unspecified");
      bump(byMode, r.mode);
    }

    // Most recent unanswered questions: the knowledge gaps to fill. Look in
    // the rows already read, then (bounded) in older ones.
    const unanswered: { query: string; language?: string; createdAt: number }[] = [];
    const collect = (r: (typeof recent)[number]) => {
      if (unanswered.length < UNANSWERED_LIMIT && (r.hits === 0 || r.mode === "none")) {
        unanswered.push({
          query: r.query,
          ...(r.language ? { language: r.language } : {}),
          createdAt: r.createdAt,
        });
      }
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
