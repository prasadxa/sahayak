import { convexTest, type TestConvex } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import { asUser } from "./test.helpers";
import { makeRefId } from "./grievances";

const sample = {
  category: "loan_credit",
  subject: "Crop loan not sanctioned",
  description: "Applied at PACS in March, no response since.",
  contact: "9876543210",
  district: "Nashik",
  societyName: "Pimpalgaon PACS",
  language: "mr",
};

async function grievanceByRef(t: TestConvex<typeof schema>, refId: string) {
  return await t.run((ctx) =>
    ctx.db
      .query("grievances")
      .withIndex("by_refId", (q) => q.eq("refId", refId))
      .unique()
  );
}

describe("grievances.file", () => {
  it("returns a GRV ref and seeds the timeline with a submitted entry", async () => {
    const t = convexTest(schema, modules);
    const { client } = await asUser(t, { email: "farmer@example.com" });
    const { refId } = await client.mutation(api.grievances.file, sample);
    expect(refId).toMatch(/^GRV-[0-9A-F]{8}$/);
    const row = await grievanceByRef(t, refId);
    expect(row?.status).toBe("submitted");
    expect(row?.district).toBe("Nashik");
    expect(row?.societyName).toBe("Pimpalgaon PACS");
    expect(row?.language).toBe("mr");
    expect(row?.updates).toHaveLength(1);
    expect(row?.updates?.[0]).toMatchObject({
      status: "submitted",
      note: "Grievance received",
      byName: "Sahayak",
    });
  });

  it("sets channel web for a member and kiosk for a kiosk account", async () => {
    const t = convexTest(schema, modules);
    const member = await asUser(t, { email: "farmer@example.com" });
    const kiosk = await asUser(t, { email: "kiosk.pacs01@example.com", role: "kiosk" });
    const web = await member.client.mutation(api.grievances.file, sample);
    const k = await kiosk.client.mutation(api.grievances.file, sample);
    expect((await grievanceByRef(t, web.refId))?.channel).toBe("web");
    expect((await grievanceByRef(t, k.refId))?.channel).toBe("kiosk");
  });

  it("rejects an unknown category", async () => {
    const t = convexTest(schema, modules);
    const { client } = await asUser(t, { email: "farmer@example.com" });
    await expect(
      client.mutation(api.grievances.file, { ...sample, category: "weather" })
    ).rejects.toThrow(/Invalid category/);
  });

  describe("refId uniqueness", () => {
    afterEach(() => vi.restoreAllMocks());

    const uuid = (hex8: string) => `${hex8}-0000-4000-8000-000000000000` as const;

    it("regenerates the ref when it collides with an existing grievance", async () => {
      const t = convexTest(schema, modules);
      const { client } = await asUser(t, { email: "farmer@example.com" });
      const spy = vi.spyOn(crypto, "randomUUID");
      spy.mockReturnValueOnce(uuid("aaaaaaaa"));
      const first = await client.mutation(api.grievances.file, sample);
      expect(first.refId).toBe("GRV-AAAAAAAA");

      spy.mockReturnValueOnce(uuid("aaaaaaaa")).mockReturnValueOnce(uuid("bbbbbbbb"));
      const second = await client.mutation(api.grievances.file, sample);
      expect(second.refId).toBe("GRV-BBBBBBBB");
      expect(await grievanceByRef(t, "GRV-AAAAAAAA")).not.toBeNull();
      expect(await grievanceByRef(t, "GRV-BBBBBBBB")).not.toBeNull();
    });

    it("gives up after 5 colliding attempts", async () => {
      const t = convexTest(schema, modules);
      const { client } = await asUser(t, { email: "farmer@example.com" });
      const spy = vi.spyOn(crypto, "randomUUID").mockReturnValue(uuid("cccccccc"));
      await client.mutation(api.grievances.file, sample);
      spy.mockClear();
      await expect(client.mutation(api.grievances.file, sample)).rejects.toThrow(
        /unique reference/i
      );
      expect(spy).toHaveBeenCalledTimes(5);
      const all = await t.run((ctx) => ctx.db.query("grievances").collect());
      expect(all).toHaveLength(1);
    });
  });

  it("makeRefId formats 8 upper-case hex characters", () => {
    expect(makeRefId(() => "deadbeefcafe")).toBe("GRV-DEADBEEF");
  });

  it("requires sign-in", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(api.grievances.file, sample)).rejects.toThrow(
      /Not authenticated/
    );
  });
});

describe("grievances.updateStatus", () => {
  it("forbids a member", async () => {
    const t = convexTest(schema, modules);
    const { client } = await asUser(t, { email: "farmer@example.com" });
    const { refId } = await client.mutation(api.grievances.file, sample);
    await expect(
      client.mutation(api.grievances.updateStatus, {
        refId,
        status: "resolved",
        note: "I resolved it myself",
      })
    ).rejects.toThrow(/Forbidden/);
  });

  it("lets an officer append to the timeline and change the status", async () => {
    const t = convexTest(schema, modules);
    const member = await asUser(t, { email: "farmer@example.com" });
    const officer = await asUser(t, {
      email: "officer@example.com",
      name: "Registrar Patil",
      role: "officer",
    });
    const { refId } = await member.client.mutation(api.grievances.file, sample);
    await officer.client.mutation(api.grievances.updateStatus, {
      refId,
      status: "in_review",
      note: "Forwarded to the branch manager",
    });
    const row = await grievanceByRef(t, refId);
    expect(row?.status).toBe("in_review");
    expect(row?.updates).toHaveLength(2);
    expect(row?.updates?.[1]).toMatchObject({
      status: "in_review",
      note: "Forwarded to the branch manager",
      byName: "Registrar Patil",
    });
    expect(typeof row?.updates?.[1].at).toBe("number");
  });

  it("rejects an invalid status and an empty note", async () => {
    const t = convexTest(schema, modules);
    const member = await asUser(t, { email: "farmer@example.com" });
    const officer = await asUser(t, { email: "officer@example.com", role: "officer" });
    const { refId } = await member.client.mutation(api.grievances.file, sample);
    await expect(
      officer.client.mutation(api.grievances.updateStatus, {
        refId,
        status: "closed",
        note: "done",
      })
    ).rejects.toThrow(/Invalid status/);
    await expect(
      officer.client.mutation(api.grievances.updateStatus, {
        refId,
        status: "resolved",
        note: "   ",
      })
    ).rejects.toThrow(/note/i);
    expect((await grievanceByRef(t, refId))?.status).toBe("submitted");
  });

  it("throws for an unknown ref", async () => {
    const t = convexTest(schema, modules);
    const officer = await asUser(t, { email: "officer@example.com", role: "officer" });
    await expect(
      officer.client.mutation(api.grievances.updateStatus, {
        refId: "GRV-00000000",
        status: "resolved",
        note: "ok",
      })
    ).rejects.toThrow(/not found/i);
  });
});

describe("grievances.track", () => {
  it("returns null for unknown and malformed refs", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.grievances.track, { refId: "GRV-DEADBEEF" })).toBeNull();
    expect(await t.query(api.grievances.track, { refId: "" })).toBeNull();
    expect(
      await t.query(api.grievances.track, { refId: "'; drop table grievances" })
    ).toBeNull();
  });

  it("works signed out, matches case-insensitively and leaks no PII", async () => {
    const t = convexTest(schema, modules);
    const { client } = await asUser(t, { email: "farmer@example.com" });
    const { refId } = await client.mutation(api.grievances.file, sample);
    const result = await t.query(api.grievances.track, {
      refId: `  ${refId.toLowerCase()} `,
    });
    expect(result).not.toBeNull();
    expect(result?.refId).toBe(refId);
    expect(result?.status).toBe("submitted");
    expect(result?.updates).toHaveLength(1);
    const keys = Object.keys(result ?? {});
    expect(keys.sort()).toEqual(
      ["category", "createdAt", "refId", "status", "subject", "updates"].sort()
    );
    for (const k of ["userId", "contact", "description", "district", "societyName", "_id"]) {
      expect(keys).not.toContain(k);
    }
  });
});

describe("grievances.listAll and stats", () => {
  it("forbids members", async () => {
    const t = convexTest(schema, modules);
    const { client } = await asUser(t, { email: "farmer@example.com" });
    await expect(client.query(api.grievances.listAll, {})).rejects.toThrow(/Forbidden/);
    await expect(client.query(api.grievances.stats, {})).rejects.toThrow(/Forbidden/);
  });

  it("filters by status and category and counts for staff", async () => {
    const t = convexTest(schema, modules);
    const member = await asUser(t, { email: "farmer@example.com" });
    const officer = await asUser(t, { email: "officer@example.com", role: "officer" });
    const a = await member.client.mutation(api.grievances.file, sample);
    await member.client.mutation(api.grievances.file, { ...sample, category: "election" });
    await member.client.mutation(api.grievances.file, { ...sample, category: "election" });
    await officer.client.mutation(api.grievances.updateStatus, {
      refId: a.refId,
      status: "resolved",
      note: "Loan sanctioned",
    });

    expect(await officer.client.query(api.grievances.listAll, {})).toHaveLength(3);
    const resolved = await officer.client.query(api.grievances.listAll, {
      status: "resolved",
    });
    expect(resolved.map((g) => g.refId)).toEqual([a.refId]);
    expect(
      await officer.client.query(api.grievances.listAll, { category: "election" })
    ).toHaveLength(2);
    expect(
      await officer.client.query(api.grievances.listAll, {
        status: "submitted",
        category: "loan_credit",
      })
    ).toHaveLength(0);

    const stats = await officer.client.query(api.grievances.stats, {});
    expect(stats.total).toBe(3);
    expect(stats.byStatus).toMatchObject({ submitted: 2, resolved: 1 });
    expect(stats.byCategory).toMatchObject({ election: 2, loan_credit: 1 });
  });
});

const DAY = 24 * 60 * 60 * 1000;

type SeedRow = {
  refId: string;
  status?: string;
  category?: string;
  district?: string;
  createdAt: number;
  updates?: { status: string; note: string; at: number; byName: string }[];
};

/** Insert grievance rows directly so createdAt and the timeline can be set. */
async function seedGrievances(t: TestConvex<typeof schema>, rows: SeedRow[]) {
  const { userId } = await asUser(t, { email: `seed-${rows[0]?.refId}@example.com` });
  await t.run(async (ctx) => {
    for (const r of rows) {
      await ctx.db.insert("grievances", {
        userId,
        refId: r.refId,
        category: r.category ?? "loan_credit",
        subject: `Subject ${r.refId}`,
        description: `Description ${r.refId}`,
        status: r.status ?? "submitted",
        createdAt: r.createdAt,
        ...(r.district !== undefined ? { district: r.district } : {}),
        ...(r.updates ? { updates: r.updates } : {}),
      });
    }
  });
}

describe("grievances SLA, districts and resolution time", () => {
  it("listAll adds ageDays and overdue to each row", async () => {
    const t = convexTest(schema, modules);
    const officer = await asUser(t, { email: "officer@example.com", role: "officer" });
    const now = Date.now();
    await seedGrievances(t, [
      { refId: "GRV-00000001", createdAt: now - 20 * DAY },
      { refId: "GRV-00000002", status: "in_review", createdAt: now - 16 * DAY },
      { refId: "GRV-00000003", createdAt: now - 3 * DAY },
      { refId: "GRV-00000004", status: "resolved", createdAt: now - 40 * DAY },
    ]);
    const rows = await officer.client.query(api.grievances.listAll, {});
    const byRef = Object.fromEntries(rows.map((r) => [r.refId, r]));
    expect(byRef["GRV-00000001"]).toMatchObject({ overdue: true, ageDays: 20 });
    expect(byRef["GRV-00000002"]).toMatchObject({ overdue: true, ageDays: 16 });
    expect(byRef["GRV-00000003"]).toMatchObject({ overdue: false, ageDays: 3 });
    expect(byRef["GRV-00000004"]).toMatchObject({ overdue: false, ageDays: 40 });
    // Existing fields are still there.
    expect(byRef["GRV-00000001"].subject).toBe("Subject GRV-00000001");
  });

  it("listAll filters by normalised district, including Unspecified", async () => {
    const t = convexTest(schema, modules);
    const officer = await asUser(t, { email: "officer@example.com", role: "officer" });
    const now = Date.now();
    await seedGrievances(t, [
      { refId: "GRV-00000011", district: "  NASHIK ", createdAt: now - 1000 },
      { refId: "GRV-00000012", district: "nashik", createdAt: now - 2000 },
      { refId: "GRV-00000013", district: "Pune", createdAt: now - 3000 },
      { refId: "GRV-00000014", createdAt: now - 4000 },
      { refId: "GRV-00000015", district: "   ", createdAt: now - 5000 },
    ]);
    const nashik = await officer.client.query(api.grievances.listAll, { district: "Nashik" });
    // Newest insert first (listAll orders by _creationTime desc).
    expect(nashik.map((g) => g.refId)).toEqual(["GRV-00000012", "GRV-00000011"]);
    const lower = await officer.client.query(api.grievances.listAll, { district: " nashik" });
    expect(lower).toHaveLength(2);
    const none = await officer.client.query(api.grievances.listAll, {
      district: "Unspecified",
    });
    expect(none.map((g) => g.refId)).toEqual(["GRV-00000015", "GRV-00000014"]);
    expect(await officer.client.query(api.grievances.listAll, {})).toHaveLength(5);
  });

  it("stats counts overdue, districts and average resolution time", async () => {
    const t = convexTest(schema, modules);
    const officer = await asUser(t, { email: "officer@example.com", role: "officer" });
    const now = Date.now();
    const c1 = now - 30 * DAY;
    const c2 = now - 20 * DAY;
    await seedGrievances(t, [
      { refId: "GRV-00000021", district: "nashik", createdAt: now - 20 * DAY },
      { refId: "GRV-00000022", district: "Nashik ", status: "in_review", createdAt: now - 2 * DAY },
      {
        refId: "GRV-00000023",
        district: "pune",
        status: "resolved",
        createdAt: c1,
        updates: [
          { status: "submitted", note: "received", at: c1, byName: "Sahayak" },
          { status: "in_review", note: "looking", at: c1 + DAY, byName: "Officer" },
          { status: "resolved", note: "fixed", at: c1 + 4 * DAY, byName: "Officer" },
        ],
      },
      {
        refId: "GRV-00000024",
        status: "resolved",
        createdAt: c2,
        updates: [
          { status: "submitted", note: "received", at: c2, byName: "Sahayak" },
          { status: "resolved", note: "first try", at: c2 + DAY, byName: "Officer" },
          { status: "in_review", note: "reopened", at: c2 + 2 * DAY, byName: "Officer" },
          { status: "resolved", note: "fixed", at: c2 + 10 * DAY, byName: "Officer" },
        ],
      },
      // Resolved but no timeline (pre-timeline row): skipped for the average.
      { refId: "GRV-00000025", status: "resolved", createdAt: now - 50 * DAY },
      { refId: "GRV-00000026", status: "rejected", createdAt: now - 50 * DAY },
    ]);
    const s = await officer.client.query(api.grievances.stats, {});
    expect(s.total).toBe(6);
    expect(s.overdue).toBe(1);
    // (4 + 10) / 2: the latest transition into resolved counts.
    expect(s.avgResolutionDays).toBe(7);
    expect(s.byDistrict).toEqual([
      { district: "Unspecified", count: 3 },
      { district: "Nashik", count: 2 },
      { district: "Pune", count: 1 },
    ]);
  });

  it("stats survives non-ASCII district names", async () => {
    // Convex object keys must be non-control ASCII, so byDistrict is a list
    // of {district, count} — native-script districts like पुणे are values.
    const t = convexTest(schema, modules);
    const officer = await asUser(t, { email: "officer@example.com", role: "officer" });
    const now = Date.now();
    await seedGrievances(t, [
      { refId: "GRV-00000031", district: "पुणे", createdAt: now - 1000 },
      { refId: "GRV-00000032", district: "नाशिक", createdAt: now - 2000 },
      { refId: "GRV-00000033", district: "पुणे", createdAt: now - 3000 },
    ]);
    const s = await officer.client.query(api.grievances.stats, {});
    expect(s.byDistrict).toEqual([
      { district: "पुणे", count: 2 },
      { district: "नाशिक", count: 1 },
    ]);
  });

  it("stats returns null average resolution when nothing is resolved", async () => {
    const t = convexTest(schema, modules);
    const officer = await asUser(t, { email: "officer@example.com", role: "officer" });
    const s = await officer.client.query(api.grievances.stats, {});
    expect(s).toMatchObject({ total: 0, overdue: 0, avgResolutionDays: null, byDistrict: [] });
  });
});

describe("grievances.exportRows", () => {
  it("forbids members and signed-out callers", async () => {
    const t = convexTest(schema, modules);
    const { client } = await asUser(t, { email: "farmer@example.com" });
    await expect(client.query(api.grievances.exportRows, {})).rejects.toThrow(/Forbidden/);
    await expect(t.query(api.grievances.exportRows, {})).rejects.toThrow(/Not authenticated/);
  });

  it("returns flat rows with ISO dates, SLA fields and the last note", async () => {
    const t = convexTest(schema, modules);
    const member = await asUser(t, { email: "farmer@example.com" });
    const officer = await asUser(t, { email: "officer@example.com", role: "officer" });
    const { refId } = await member.client.mutation(api.grievances.file, sample);
    await officer.client.mutation(api.grievances.updateStatus, {
      refId,
      status: "in_review",
      note: "Forwarded to the branch manager",
    });
    const rows = await officer.client.query(api.grievances.exportRows, {});
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(Object.keys(r).sort()).toEqual(
      [
        "refId", "createdAt", "status", "category", "subject", "description", "contact",
        "district", "societyName", "channel", "language", "ageDays", "overdue", "lastUpdate",
      ].sort()
    );
    expect(r).toMatchObject({
      refId,
      status: "in_review",
      category: "loan_credit",
      subject: sample.subject,
      description: sample.description,
      contact: sample.contact,
      district: "Nashik",
      societyName: sample.societyName,
      channel: "web",
      language: "mr",
      ageDays: 0,
      overdue: false,
      lastUpdate: "Forwarded to the branch manager",
    });
    expect(r.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("uses empty strings for missing optional fields and filters like listAll", async () => {
    const t = convexTest(schema, modules);
    const officer = await asUser(t, { email: "officer@example.com", role: "officer" });
    const now = Date.now();
    await seedGrievances(t, [
      { refId: "GRV-00000031", district: "pune", createdAt: now - 20 * DAY },
      { refId: "GRV-00000032", category: "election", createdAt: now - 1000 },
      { refId: "GRV-00000033", status: "resolved", district: "Pune", createdAt: now - 2000 },
    ]);
    const all = await officer.client.query(api.grievances.exportRows, {});
    expect(all.map((r) => r.refId)).toEqual(["GRV-00000033", "GRV-00000032", "GRV-00000031"]);
    const legacy = all.find((r) => r.refId === "GRV-00000032");
    expect(legacy).toMatchObject({
      contact: "",
      district: "",
      societyName: "",
      channel: "",
      language: "",
      lastUpdate: "Grievance received",
    });
    const overdue = all.find((r) => r.refId === "GRV-00000031");
    expect(overdue).toMatchObject({ overdue: true, ageDays: 20, district: "Pune" });

    const pune = await officer.client.query(api.grievances.exportRows, { district: "PUNE" });
    expect(pune.map((r) => r.refId)).toEqual(["GRV-00000033", "GRV-00000031"]);
    const resolvedPune = await officer.client.query(api.grievances.exportRows, {
      district: "Pune",
      status: "resolved",
    });
    expect(resolvedPune.map((r) => r.refId)).toEqual(["GRV-00000033"]);
    const election = await officer.client.query(api.grievances.exportRows, {
      category: "election",
    });
    expect(election.map((r) => r.refId)).toEqual(["GRV-00000032"]);
    const unspecified = await officer.client.query(api.grievances.exportRows, {
      district: "Unspecified",
    });
    expect(unspecified.map((r) => r.refId)).toEqual(["GRV-00000032"]);
  });

  it("returns at most 2000 rows", async () => {
    const t = convexTest(schema, modules);
    const officer = await asUser(t, { email: "officer@example.com", role: "officer" });
    const now = Date.now();
    await seedGrievances(
      t,
      Array.from({ length: 2001 }, (_, i) => ({
        refId: `GRV-${i.toString(16).toUpperCase().padStart(8, "0")}`,
        createdAt: now - i,
      }))
    );
    const rows = await officer.client.query(api.grievances.exportRows, {});
    expect(rows).toHaveLength(2000);
  }, 30_000);
});

describe("grievance SLA uses the caller's clock", () => {
  it("marks a fresh grievance overdue when the caller's now is past the target", async () => {
    const t = convexTest(schema, modules);
    const citizen = await asUser(t, { email: "farmer.sla@example.com" });
    const officer = await asUser(t, { email: "officer.sla@example.com", role: "officer" });
    await citizen.client.mutation(api.grievances.file, {
      category: "membership",
      subject: "Membership pending",
      description: "Applied long ago",
    });
    const later = Date.now() + 20 * 24 * 60 * 60 * 1000;

    const rows = await officer.client.query(api.grievances.listAll, { now: later });
    expect(rows[0].overdue).toBe(true);
    expect(rows[0].ageDays).toBeGreaterThanOrEqual(19);
    expect((await officer.client.query(api.grievances.stats, { now: later })).overdue).toBe(1);
    expect((await officer.client.query(api.analytics.overview, { now: later })).grievances.overdue).toBe(1);
    const exported = await officer.client.query(api.grievances.exportRows, { now: later });
    expect(exported[0].overdue).toBe(true);

    // Without `now`, the server clock is used: filed just now, not overdue.
    expect((await officer.client.query(api.grievances.listAll, {}))[0].overdue).toBe(false);
  });
});
