/** Shared enums used by Convex functions, AI tools and the UI. */

export const KB_CATEGORIES = [
  "laws",
  "schemes",
  "pmfby",
  "finance",
  "grievance",
  "general",
] as const;
export type KbCategory = (typeof KB_CATEGORIES)[number];

export const KB_CATEGORY_LABELS: Record<KbCategory, string> = {
  laws: "Laws & by-laws",
  schemes: "Schemes & services",
  pmfby: "PMFBY & crop insurance",
  finance: "Financial literacy",
  grievance: "Grievance procedures",
  general: "General",
};

export const GRIEVANCE_CATEGORIES = [
  "membership",
  "loan_credit",
  "election",
  "bylaw_violation",
  "financial_fraud",
  "service_denial",
  "scheme_benefit",
  "other",
] as const;
export type GrievanceCategory = (typeof GRIEVANCE_CATEGORIES)[number];

export const GRIEVANCE_STATUSES = [
  "submitted",
  "in_review",
  "resolved",
  "rejected",
] as const;
export type GrievanceStatus = (typeof GRIEVANCE_STATUSES)[number];

export const ROLES = ["member", "officer", "admin", "kiosk"] as const;
export type Role = (typeof ROLES)[number];

export function isStaffRole(role: Role): boolean {
  return role === "officer" || role === "admin";
}
