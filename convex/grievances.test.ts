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
