/**
 * Grievance service-level helpers (pure, shared by Convex and the UI).
 *
 * GRIEVANCE_SLA_DAYS is a typical citizen-charter *target* for disposing of a
 * grievance, not a statutory deadline. Show it as a "target" in the UI.
 */

export const GRIEVANCE_SLA_DAYS = 15;

const DAY_MS = 24 * 60 * 60 * 1000;
const SLA_MS = GRIEVANCE_SLA_DAYS * DAY_MS;

/** Statuses still awaiting action; only these can be overdue. */
const OPEN_STATUSES: ReadonlySet<string> = new Set(["submitted", "in_review"]);

/** Whole days elapsed since `createdAt` (floored, never negative). */
export function ageInDays(createdAt: number, now: number): number {
  return Math.max(0, Math.floor((now - createdAt) / DAY_MS));
}

/** When the SLA target falls: createdAt + 15 days (epoch ms). */
export function dueDate(createdAt: number): number {
  return createdAt + SLA_MS;
}

/**
 * True for an open grievance (submitted / in review) older than the target.
 * Exactly 15 days is still on time; any time after that is overdue.
 */
export function isOverdue(g: { status: string; createdAt: number }, now: number): boolean {
  return OPEN_STATUSES.has(g.status) && now - g.createdAt > SLA_MS;
}

export const UNSPECIFIED_DISTRICT = "Unspecified";

/**
 * Canonical district key for grouping and filtering: trimmed, inner spaces
 * collapsed, title-cased ("  NASHIK " → "Nashik", "navi-mumbai" →
 * "Navi-Mumbai"). Scripts without letter case pass through unchanged.
 * Missing or blank → "Unspecified".
 */
export function normalizeDistrict(district: string | undefined): string {
  const collapsed = (district ?? "").trim().replace(/\s+/g, " ");
  if (!collapsed) return UNSPECIFIED_DISTRICT;
  return collapsed
    .toLowerCase()
    .replace(/(^|[\s\-(/])(\p{Ll})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}
