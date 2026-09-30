import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { getRole, requireStaff } from "./roles";
import { GRIEVANCE_CATEGORIES, GRIEVANCE_STATUSES } from "@/lib/constants";
import { ageInDays, isOverdue, normalizeDistrict } from "@/lib/grievance-sla";

// Re-exported for older imports; the single source is lib/constants.ts.
export { GRIEVANCE_CATEGORIES };

const REF_PATTERN = /^GRV-[0-9A-F]{8}$/;
const LIST_LIMIT = 200;
const EXPORT_LIMIT = 2000;
const DAY_MS = 24 * 60 * 60 * 1000;

type TimelineEntry = NonNullable<Doc<"grievances">["updates"]>[number];

/** Grievances filed before the timeline existed get a synthetic first entry. */
function timelineOf(g: Doc<"grievances">): TimelineEntry[] {
  return (
    g.updates ?? [
      { status: "submitted", note: "Grievance received", at: g.createdAt, byName: "Sahayak" },
    ]
  );
}

function clean(value: string | undefined, max: number): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

const REF_ATTEMPTS = 5;

const randomHex = () => crypto.randomUUID().replaceAll("-", "");

/** `GRV-` + the first 8 hex characters of `hex()`, upper-cased. */
export function makeRefId(hex: () => string = randomHex): string {
  return "GRV-" + hex().slice(0, 8).toUpperCase();
}

/** A ref ID no existing grievance uses (8 hex chars can collide). */
async function uniqueRefId(ctx: MutationCtx): Promise<string> {
  for (let attempt = 0; attempt < REF_ATTEMPTS; attempt++) {
    const refId = makeRefId();
    const existing = await ctx.db
      .query("grievances")
      .withIndex("by_refId", (q) => q.eq("refId", refId))
      .first();
    if (!existing) return refId;
  }
  throw new Error("Could not allocate a unique reference ID. Please try again.");
}

export const file = mutation({
  args: {
    category: v.string(),
    subject: v.string(),
    description: v.string(),
    contact: v.optional(v.string()),
    district: v.optional(v.string()),
    societyName: v.optional(v.string()),
    language: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    if (!(GRIEVANCE_CATEGORIES as readonly string[]).includes(args.category)) {
      throw new Error(
        `Invalid category "${args.category}". Use one of: ${GRIEVANCE_CATEGORIES.join(", ")}`
      );
    }
    const subject = args.subject.trim();
    const description = args.description.trim();
    if (!subject || !description) throw new Error("Subject and description are required");

    const role = await getRole(ctx, userId);
    const refId = await uniqueRefId(ctx);
    const now = Date.now();

    await ctx.db.insert("grievances", {
      userId,
      refId,
      category: args.category,
      subject: subject.slice(0, 200),
      description: description.slice(0, 8000),
      contact: clean(args.contact, 120),
      district: clean(args.district, 120),
      societyName: clean(args.societyName, 200),
      language: clean(args.language, 16),
      channel: role === "kiosk" ? "kiosk" : "web",
      status: "submitted",
      updates: [
        { status: "submitted", note: "Grievance received", at: now, byName: "Sahayak" },
      ],
      createdAt: now,
    });

    return { refId };
  },
});

export const listMine = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    // Kiosk-filed grievances belong to many citizens; they track by ref ID.
    if (!userId || (await getRole(ctx, userId)) === "kiosk") return [];
    return await ctx.db
      .query("grievances")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

type GrievanceFilter = { status?: string; category?: string; district?: string };

const filterArgs = {
  status: v.optional(v.string()),
  category: v.optional(v.string()),
  /** Matched after normalizeDistrict on both sides; "Unspecified" = no district. */
  district: v.optional(v.string()),
};

/**
 * Optional caller clock for SLA fields. Convex caches query results until the
 * rows they read change, so a server-side Date.now() would freeze "overdue"
 * on a quiet day; clients pass an hour-rounded `now` that ticks forward.
 */
const nowArg = { now: v.optional(v.number()) };


/** Newest first (by insertion), at most `limit` rows matching the filters. */
async function findGrievances(
  ctx: QueryCtx,
  { status, category, district }: GrievanceFilter,
  limit: number
): Promise<Doc<"grievances">[]> {
  const base = status
    ? ctx.db
        .query("grievances")
        .withIndex("by_status", (q) => q.eq("status", status))
        .order("desc")
    : ctx.db.query("grievances").order("desc");
  const districtKey = district?.trim() ? normalizeDistrict(district) : undefined;

  const rows: Doc<"grievances">[] = [];
  for await (const g of base) {
    if (category && g.category !== category) continue;
    if (districtKey && normalizeDistrict(g.district) !== districtKey) continue;
    rows.push(g);
    if (rows.length >= limit) break;
  }
  return rows;
}

/**
 * Staff console: newest first, at most 200 rows. Each row also carries
 * `ageDays` and `overdue` (open and older than the 15-day target).
 */
export const listAll = query({
  args: { ...filterArgs, ...nowArg },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const now = args.now ?? Date.now();
    const rows = await findGrievances(ctx, args, LIST_LIMIT);
    return rows.map((g) => ({
      ...g,
      ageDays: ageInDays(g.createdAt, now),
      overdue: isOverdue(g, now),
    }));
  },
});

/**
 * Flat rows for the officer CSV export (same filters as listAll), newest
 * first, at most 2000. Missing optional fields are empty strings; `district`
 * is normalised; `lastUpdate` is the latest timeline note.
 */
export const exportRows = query({
  args: { ...filterArgs, ...nowArg },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const now = args.now ?? Date.now();
    const rows = await findGrievances(ctx, args, EXPORT_LIMIT);
    return rows.map((g) => {
      const timeline = timelineOf(g);
      return {
        refId: g.refId,
        createdAt: new Date(g.createdAt).toISOString(),
        status: g.status,
        category: g.category,
        subject: g.subject,
        description: g.description,
        contact: g.contact ?? "",
        district: g.district?.trim() ? normalizeDistrict(g.district) : "",
        societyName: g.societyName ?? "",
        channel: g.channel ?? "",
        language: g.language ?? "",
        ageDays: ageInDays(g.createdAt, now),
        overdue: isOverdue(g, now),
        lastUpdate: timeline[timeline.length - 1]?.note ?? "",
      };
    });
  },
});

export const updateStatus = mutation({
  args: { refId: v.string(), status: v.string(), note: v.string() },
  handler: async (ctx, args) => {
    const staffId = await requireStaff(ctx);
    if (!(GRIEVANCE_STATUSES as readonly string[]).includes(args.status)) {
      throw new Error(
        `Invalid status "${args.status}". Use one of: ${GRIEVANCE_STATUSES.join(", ")}`
      );
    }
    const note = args.note.trim();
    if (!note) throw new Error("A note is required when updating a grievance");

    const refId = args.refId.trim().toUpperCase();
    const g = await ctx.db
      .query("grievances")
      .withIndex("by_refId", (q) => q.eq("refId", refId))
      .unique();
    if (!g) throw new Error(`Grievance ${refId} not found`);

    const staff = await ctx.db.get(staffId);
    const entry: TimelineEntry = {
      status: args.status,
      note: note.slice(0, 1000),
      at: Date.now(),
      byName: staff?.name?.trim() || "Officer",
    };
    await ctx.db.patch(g._id, {
      status: args.status,
      updates: [...timelineOf(g), entry],
    });
    return { refId, status: args.status };
  },
});

/**
 * PUBLIC tracking by reference ID (the QR target on kiosk receipts).
 * Returns only non-identifying fields: never userId, contact, description,
 * district or society.
 */
export const track = query({
  args: { refId: v.string() },
  handler: async (ctx, args) => {
    const refId = args.refId.trim().toUpperCase();
    if (!REF_PATTERN.test(refId)) return null;
    const g = await ctx.db
      .query("grievances")
      .withIndex("by_refId", (q) => q.eq("refId", refId))
      .unique();
    if (!g) return null;
    return {
      refId: g.refId,
      category: g.category,
      subject: g.subject,
      status: g.status,
      createdAt: g.createdAt,
      updates: timelineOf(g).map((u) => ({
        status: u.status,
        note: u.note,
        at: u.at,
        byName: u.byName,
      })),
    };
  },
});

export type GrievanceStats = {
  total: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  /** Normalised district → count; missing districts under "Unspecified". */
  byDistrict: Record<string, number>;
  /** Open (submitted / in review) grievances older than the 15-day target. */
  overdue: number;
  /** Mean days from filing to the latest move into "resolved", 1 decimal; null if none. */
  avgResolutionDays: number | null;
};

/** When a resolved grievance last became resolved, from its timeline. */
function resolvedAt(g: Doc<"grievances">): number | undefined {
  if (g.status !== "resolved") return undefined;
  const updates = g.updates ?? [];
  for (let i = updates.length - 1; i >= 0; i--) {
    if (updates[i].status === "resolved") return updates[i].at;
  }
  return undefined;
}

/**
 * Counts every grievance. `.collect()` scans the whole table, which is fine
 * at prototype scale; switch to an aggregate component before production.
 */
export async function grievanceStats(
  ctx: QueryCtx,
  now: number = Date.now()
): Promise<GrievanceStats> {
  const all = await ctx.db.query("grievances").collect();
  const byStatus: Record<string, number> = Object.fromEntries(
    GRIEVANCE_STATUSES.map((s) => [s, 0])
  );
  const byCategory: Record<string, number> = {};
  const byDistrict: Record<string, number> = {};
  let overdue = 0;
  let resolvedCount = 0;
  let resolutionMs = 0;
  for (const g of all) {
    byStatus[g.status] = (byStatus[g.status] ?? 0) + 1;
    byCategory[g.category] = (byCategory[g.category] ?? 0) + 1;
    const district = normalizeDistrict(g.district);
    byDistrict[district] = (byDistrict[district] ?? 0) + 1;
    if (isOverdue(g, now)) overdue++;
    const at = resolvedAt(g);
    if (at !== undefined) {
      resolvedCount++;
      resolutionMs += Math.max(0, at - g.createdAt);
    }
  }
  const avgResolutionDays =
    resolvedCount === 0 ? null : Math.round((resolutionMs / resolvedCount / DAY_MS) * 10) / 10;
  return { total: all.length, byStatus, byCategory, byDistrict, overdue, avgResolutionDays };
}

export const stats = query({
  args: nowArg,
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    return await grievanceStats(ctx, args.now ?? Date.now());
  },
});
