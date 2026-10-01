import type { TestConvex } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { testConvex } from "./test.setup";
import { asUser } from "./test.helpers";
import { GRIEVANCE_CATEGORIES } from "@/lib/constants";

type T = TestConvex<typeof schema>;

const DAY_MS = 24 * 60 * 60 * 1000;
const DEMO_EMAIL = "demo.citizen@sahayak.test";
const DEMO_REF = /^GRV-DE00[0-9A-F]{4}$/;

const allGrievances = (t: T) => t.run((ctx) => ctx.db.query("grievances").collect());
const allQueries = (t: T) => t.run((ctx) => ctx.db.query("kb_queries").collect());
const allUsers = (t: T) => t.run((ctx) => ctx.db.query("users").collect());

describe("demo.seed", () => {
  it("creates the demo user, grievances and queries; a second seed adds nothing", async () => {
    const t = testConvex();

    const first = await t.mutation(internal.demo.seed, {});
    expect(first.userCreated).toBe(true);
    expect(first.grievances).toBeGreaterThanOrEqual(20);
    expect(first.queries).toBeGreaterThanOrEqual(100);

    const users = await allUsers(t);
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ email: DEMO_EMAIL, name: "Demo Citizen", image: "" });
    expect(users[0].role ?? "member").toBe("member");

    const grievances = await allGrievances(t);
    expect(grievances).toHaveLength(first.grievances);
    expect((await allQueries(t)).length).toBe(first.queries);

    const second = await t.mutation(internal.demo.seed, {});
    expect(second).toEqual({ userCreated: false, grievances: 0, queries: 0 });
    expect(await allUsers(t)).toHaveLength(1);
    expect((await allGrievances(t)).length).toBe(first.grievances);
    expect((await allQueries(t)).length).toBe(first.queries);
  });

  it("produces varied, identifiable, realistic rows", async () => {
    const t = testConvex();
    const before = Date.now();
    await t.mutation(internal.demo.seed, {});
    const grievances = await allGrievances(t);

    for (const g of grievances) {
      expect(g.refId).toMatch(DEMO_REF);
      expect(g.refId).toMatch(/^GRV-[0-9A-F]{8}$/); // the format track() accepts
      // Obviously fake and non-routable: the +91 00000 prefix is no real number.
      expect(g.contact).toMatch(/^\+91 00000 0\d{4}$/);
      expect(g.createdAt).toBeGreaterThan(before - 46 * DAY_MS);
      expect(g.createdAt).toBeLessThanOrEqual(Date.now());
      const updates = g.updates ?? [];
      expect(updates[0]).toMatchObject({ status: "submitted" });
      expect(updates.at(-1)?.status).toBe(g.status);
      for (let i = 1; i < updates.length; i++) {
        expect(updates[i].at).toBeGreaterThan(updates[i - 1].at);
        expect(updates[i].byName).toMatch(/, (ARCS|DDR) /);
      }
      expect(updates.at(-1)!.at).toBeLessThanOrEqual(Date.now());
    }
    expect(new Set(grievances.map((g) => g.refId)).size).toBe(grievances.length);

    const set = (key: keyof (typeof grievances)[number]) =>
      new Set(grievances.map((g) => g[key]));
    expect([...set("category")].sort()).toEqual([...GRIEVANCE_CATEGORIES].sort());
    expect([...set("district")].sort()).toEqual(
      ["Kolhapur", "Nagpur", "Nashik", "Pune", "Satara", "Solapur"]
    );
    expect(set("channel")).toEqual(new Set(["web", "kiosk"]));
    expect(set("language")).toEqual(new Set(["hi", "mr", "en"]));
    for (const s of ["submitted", "in_review", "resolved", "rejected"]) {
      expect(set("status").has(s)).toBe(true);
    }

    const queries = await allQueries(t);
    for (const q of queries) {
      expect(q.createdAt % 1000).toBe(123);
      expect(q.createdAt).toBeGreaterThan(before - 31 * DAY_MS);
      expect(q.createdAt).toBeLessThanOrEqual(Date.now());
      if (q.mode === "none") expect(q.hits).toBe(0);
      else expect(q.hits).toBeGreaterThan(0);
    }
    expect(new Set(queries.map((q) => q.language))).toEqual(
      new Set(["hi", "mr", "en", "ta", "te", "bn"])
    );
    expect(new Set(queries.map((q) => q.mode))).toEqual(new Set(["vector", "text", "none"]));
    const gapShare = queries.filter((q) => q.mode === "none").length / queries.length;
    expect(gapShare).toBeGreaterThan(0.1);
    expect(gapShare).toBeLessThan(0.2);
  });

  it("leaves at least 3 open grievances older than 15 days (overdue)", async () => {
    const t = testConvex();
    await t.mutation(internal.demo.seed, {});
    const cutoff = Date.now() - 15 * DAY_MS;
    const overdue = (await allGrievances(t)).filter(
      (g) => (g.status === "submitted" || g.status === "in_review") && g.createdAt < cutoff
    );
    expect(overdue.length).toBeGreaterThanOrEqual(3);
  });
});

describe("demo.seed on a real account", () => {
  it("refuses to seed onto a demo-email user someone registered (has an authAccounts row)", async () => {
    const t = testConvex();
    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { name: "Someone", email: DEMO_EMAIL, image: "" });
      await ctx.db.insert("authAccounts", {
        userId,
        provider: "password",
        providerAccountId: DEMO_EMAIL,
        secret: "hash",
      });
    });
    await expect(t.mutation(internal.demo.seed, {})).rejects.toThrow(
      "demo.citizen@sahayak.test is a real account; refusing to seed"
    );
    expect(await allGrievances(t)).toEqual([]);
    expect(await allQueries(t)).toEqual([]);
  });

  it("clear still works (and keeps the account) when the demo email is a real account", async () => {
    const t = testConvex();
    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { name: "Someone", email: DEMO_EMAIL, image: "" });
      await ctx.db.insert("authAccounts", {
        userId,
        provider: "password",
        providerAccountId: DEMO_EMAIL,
      });
    });
    expect(await t.mutation(internal.demo.clear, {})).toEqual({ users: 0, grievances: 0, queries: 0 });
    expect(await allUsers(t)).toHaveLength(1);
  });
});

describe("demo refs and grievances.track", () => {
  it("track works for a demo ref", async () => {
    const t = testConvex();
    await t.mutation(internal.demo.seed, {});
    const [g] = await allGrievances(t);
    const tracked = await t.query(api.grievances.track, { refId: g.refId.toLowerCase() });
    expect(tracked).not.toBeNull();
    expect(tracked).toMatchObject({ refId: g.refId, status: g.status, subject: g.subject });
    expect(tracked!.updates.length).toBe(g.updates?.length);
  });
});

describe("demo.clear", () => {
  it("removes only demo rows", async () => {
    const t = testConvex();
    const farmer = await asUser(t, { email: "farmer@example.com" });
    const { refId: realRef } = await farmer.client.mutation(api.grievances.file, {
      category: "loan_credit",
      subject: "Crop loan not sanctioned",
      description: "Applied at PACS in March, no response since.",
    });
    await t.mutation(internal.kb.logQuery, {
      query: "What is PMFBY premium for rabi?",
      language: "en",
      hits: 2,
      mode: "text",
    });
    // A real query that happens to land on the marker millisecond survives:
    // clear also requires the text to be one of the demo questions.
    await t.run((ctx) =>
      ctx.db.insert("kb_queries", {
        query: "Is my society registered?",
        hits: 1,
        mode: "text",
        createdAt: Math.floor(Date.now() / 1000) * 1000 + 123,
      })
    );

    const seeded = await t.mutation(internal.demo.seed, {});
    const cleared = await t.mutation(internal.demo.clear, {});
    expect(cleared).toEqual({ users: 1, grievances: seeded.grievances, queries: seeded.queries });

    const grievances = await allGrievances(t);
    expect(grievances.map((g) => g.refId)).toEqual([realRef]);
    const queries = await allQueries(t);
    expect(queries.map((q) => q.query).sort()).toEqual([
      "Is my society registered?",
      "What is PMFBY premium for rabi?",
    ]);
    const users = await allUsers(t);
    expect(users.map((u) => u.email)).toEqual(["farmer@example.com"]);

    expect(await t.mutation(internal.demo.clear, {})).toEqual({
      users: 0,
      grievances: 0,
      queries: 0,
    });
  });

  it("keeps a real grievance whose random ref happens to use the demo prefix", async () => {
    const t = testConvex();
    await t.mutation(internal.demo.seed, {});
    const farmer = await asUser(t, { email: "farmer@example.com" });
    await t.run((ctx) =>
      ctx.db.insert("grievances", {
        userId: farmer.userId,
        refId: "GRV-DE00FFFF",
        category: "other",
        subject: "Real",
        description: "Real grievance",
        status: "submitted",
        createdAt: Date.now(),
      })
    );
    await t.mutation(internal.demo.clear, {});
    expect((await allGrievances(t)).map((g) => g.refId)).toEqual(["GRV-DE00FFFF"]);
  });
});
