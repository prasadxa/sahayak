import { describe, expect, it } from "vitest";
import {
  GRIEVANCE_SLA_DAYS,
  UNSPECIFIED_DISTRICT,
  ageInDays,
  dueDate,
  isOverdue,
  normalizeDistrict,
} from "./grievance-sla";

const DAY = 24 * 60 * 60 * 1000;
const created = Date.UTC(2026, 8, 1, 10, 0, 0);

describe("GRIEVANCE_SLA_DAYS", () => {
  it("is the 15-day citizen-charter target", () => {
    expect(GRIEVANCE_SLA_DAYS).toBe(15);
  });
});

describe("ageInDays", () => {
  it("counts whole days elapsed", () => {
    expect(ageInDays(created, created)).toBe(0);
    expect(ageInDays(created, created + DAY - 1)).toBe(0);
    expect(ageInDays(created, created + DAY)).toBe(1);
    expect(ageInDays(created, created + 12 * DAY + 5 * 60 * 60 * 1000)).toBe(12);
  });

  it("never goes negative when the clock is behind createdAt", () => {
    expect(ageInDays(created, created - 3 * DAY)).toBe(0);
  });
});

describe("dueDate", () => {
  it("is createdAt plus 15 days", () => {
    expect(dueDate(created)).toBe(created + 15 * DAY);
  });
});

describe("isOverdue", () => {
  const open = (status: string) => ({ status, createdAt: created });

  it("is false at exactly 15 days and true just after", () => {
    expect(isOverdue(open("submitted"), created + 15 * DAY)).toBe(false);
    expect(isOverdue(open("submitted"), created + 15 * DAY + 1)).toBe(true);
    expect(isOverdue(open("in_review"), created + 15 * DAY)).toBe(false);
    expect(isOverdue(open("in_review"), created + 15 * DAY + 1)).toBe(true);
  });

  it("is false for a young open grievance", () => {
    expect(isOverdue(open("submitted"), created + 3 * DAY)).toBe(false);
  });

  it("is never true for closed statuses", () => {
    expect(isOverdue(open("resolved"), created + 100 * DAY)).toBe(false);
    expect(isOverdue(open("rejected"), created + 100 * DAY)).toBe(false);
  });
});

describe("normalizeDistrict", () => {
  it("trims, collapses spaces and title-cases", () => {
    expect(normalizeDistrict("  nashik ")).toBe("Nashik");
    expect(normalizeDistrict("NASHIK")).toBe("Nashik");
    expect(normalizeDistrict("new   delhi")).toBe("New Delhi");
    expect(normalizeDistrict("navi-mumbai")).toBe("Navi-Mumbai");
  });

  it("leaves scripts without case untouched", () => {
    expect(normalizeDistrict(" नाशिक ")).toBe("नाशिक");
  });

  it("maps missing or blank to Unspecified", () => {
    expect(UNSPECIFIED_DISTRICT).toBe("Unspecified");
    expect(normalizeDistrict(undefined)).toBe("Unspecified");
    expect(normalizeDistrict("")).toBe("Unspecified");
    expect(normalizeDistrict("   ")).toBe("Unspecified");
  });
});
