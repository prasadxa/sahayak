import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import { asUser } from "./test.helpers";

const DAY = 24 * 60 * 60 * 1000;

describe("analytics.overview", () => {
  it("forbids a member", async () => {
    const t = convexTest(schema, modules);
    const { client } = await asUser(t, { email: "farmer@example.com" });
    await expect(client.query(api.analytics.overview, {})).rejects.toThrow(/Forbidden/);
  });

  it("returns counts matching seeded rows for an officer", async () => {
    const t = convexTest(schema, modules);
    const member = await asUser(t, { email: "farmer@example.com" });
    const officer = await asUser(t, { email: "officer@example.com", role: "officer" });
    const now = Date.now();

    await member.client.mutation(api.grievances.file, {
      category: "loan_credit",
      subject: "Loan",
      description: "Loan not sanctioned",
    });
    await member.client.mutation(api.grievances.file, {
      category: "election",
      subject: "Election",
      description: "Election not held",
    });

    // Entry A: 2 chunks, one awaiting embedding. Entry B: 1 chunk, embedded.
    const emb = new Array(1536).fill(0.01);
    await t.mutation(internal.kb.insertChunks, {
      entryId: "a",
      title: "A",
      category: "laws",
      chunks: [{ content: "a0", embedding: emb }, { content: "a1" }],
    });
    await t.mutation(internal.kb.insertChunks, {
      entryId: "b",
      title: "B",
      category: "pmfby",
      chunks: [{ content: "b0", embedding: emb }],
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("kb_queries", {
        query: "PMFBY premium", category: "pmfby", language: "hi", hits: 3,
        topScore: 0.8, mode: "vector", createdAt: now - 1000,
      });
      await ctx.db.insert("kb_queries", {
        query: "PACS membership", language: "mr", hits: 2, mode: "text",
        createdAt: now - 2000,
      });
      await ctx.db.insert("kb_queries", {
        query: "dairy subsidy", language: "hi", hits: 0, mode: "none",
        createdAt: now - 3000,
      });
      await ctx.db.insert("kb_queries", {
        query: "fishery loan", category: "schemes", hits: 0, mode: "text",
        createdAt: now - 4000,
      });
      // Older than 30 days: excluded from `queries`.
      await ctx.db.insert("kb_queries", {
        query: "ancient question", language: "en", hits: 0, mode: "none",
        createdAt: now - 45 * DAY,
      });
    });

    const o = await officer.client.query(api.analytics.overview, {});

    expect(o.grievances.total).toBe(2);
    expect(o.grievances.byStatus).toMatchObject({ submitted: 2 });
    expect(o.grievances.byCategory).toMatchObject({ loan_credit: 1, election: 1 });
    expect(o.grievances.overdue).toBe(0);
    expect(o.grievances.avgResolutionDays).toBeNull();
    expect(o.grievances.byDistrict).toEqual([{ district: "Unspecified", count: 2 }]);

    expect(o.kb).toEqual({ entries: 2, chunks: 3, pendingEmbeddings: 1 });

    expect(o.queries.total).toBe(4);
    expect(o.queries.truncated).toBe(false);
    expect(o.queries.byLanguage).toMatchObject({ hi: 2, mr: 1 });
    expect(o.queries.byCategory).toMatchObject({ pmfby: 1, schemes: 1 });
    expect(o.queries.byMode).toEqual({ vector: 1, text: 2, none: 1 });

    expect(o.unanswered.map((u) => u.query)).toEqual([
      "dairy subsidy",
      "fishery loan",
      "ancient question",
    ]);
    expect(o.unanswered[0]).toMatchObject({ language: "hi" });
    expect(Object.keys(o.unanswered[0]).sort()).toEqual(["count", "createdAt", "language", "query"]);
  });

  it("folds non-Convex-key language/category values into 'other' instead of crashing", async () => {
    const t = convexTest(schema, modules);
    const officer = await asUser(t, { email: "officer@example.com", role: "officer" });
    const now = Date.now();
    // kb_queries.language comes from the raw sahayak-lang cookie and category
    // is a free-form searchKnowledgeBase arg — both can hold arbitrary text.
    // Convex object keys must be non-control ASCII, ≤1024 chars and not start
    // with "$", so these rows would throw "invalid character" while the
    // overview result is serialised (same class as the byDistrict fix).
    await t.run(async (ctx) => {
      const rows = [
        { query: "native script", language: "हिन्दी" },
        { query: "district cat", category: "पुणे" },
        { query: "dollar", language: "$eq" },
        { query: "ctor", category: "constructor" },
        { query: "overlong", language: "x".repeat(1100) },
        { query: "empty", language: "" },
        { query: "fine", language: "hi", category: "pmfby" },
      ];
      for (const [i, r] of rows.entries()) {
        await ctx.db.insert("kb_queries", {
          ...r,
          hits: 1,
          mode: "text",
          createdAt: now - (i + 1) * 1000,
        });
      }
    });
    const o = await officer.client.query(api.analytics.overview, {});
    expect(o.queries.byLanguage).toEqual({ other: 4, unknown: 2, hi: 1 });
    expect(o.queries.byCategory).toEqual({
      unspecified: 4,
      other: 1,
      constructor: 1,
      pmfby: 1,
    });
  });

  it("reads KB counts from kb_sources, not the chunk rows", async () => {
    const t = convexTest(schema, modules);
    const officer = await asUser(t, { email: "officer@example.com", role: "officer" });
    // A chunk row with no kb_sources row (pre-migration) is not scanned.
    await t.run((ctx) =>
      ctx.db.insert("kb_entries", {
        entryId: "legacy", title: "Legacy", category: "laws", content: "x",
        chunkIndex: 0, createdAt: Date.now(),
      })
    );
    const o = await officer.client.query(api.analytics.overview, {});
    expect(o.kb).toEqual({ entries: 0, chunks: 0, pendingEmbeddings: 0 });
  });

  it("caps the 30-day query scan at 5000 rows and says so", async () => {
    const t = convexTest(schema, modules);
    const officer = await asUser(t, { email: "officer@example.com", role: "officer" });
    const now = Date.now();
    await t.run(async (ctx) => {
      for (let i = 0; i < 5001; i++) {
        await ctx.db.insert("kb_queries", {
          query: `q${i}`, language: "hi", hits: 1, mode: "text", createdAt: now - i,
        });
      }
    });
    const o = await officer.client.query(api.analytics.overview, {});
    expect(o.queries.total).toBe(5000);
    expect(o.queries.truncated).toBe(true);
    expect(o.queries.byLanguage).toEqual({ hi: 5000 });
  }, 30_000);

  it("passes grievance SLA and district stats through", async () => {
    const t = convexTest(schema, modules);
    const officer = await asUser(t, { email: "officer@example.com", role: "officer" });
    const now = Date.now();
    const created = now - 30 * DAY;
    await t.run(async (ctx) => {
      await ctx.db.insert("grievances", {
        userId: officer.userId, refId: "GRV-0000A001", category: "election",
        subject: "s", description: "d", status: "submitted", district: " thane ",
        createdAt: now - 18 * DAY,
      });
      await ctx.db.insert("grievances", {
        userId: officer.userId, refId: "GRV-0000A002", category: "election",
        subject: "s", description: "d", status: "resolved", district: "Thane",
        createdAt: created,
        updates: [
          { status: "submitted", note: "received", at: created, byName: "Sahayak" },
          { status: "resolved", note: "done", at: created + 3 * DAY + DAY / 2, byName: "Officer" },
        ],
      });
    });
    const o = await officer.client.query(api.analytics.overview, {});
    expect(o.grievances.overdue).toBe(1);
    expect(o.grievances.avgResolutionDays).toBe(3.5);
    expect(o.grievances.byDistrict).toEqual([{ district: "Thane", count: 2 }]);
  });
});

describe("analytics.overview unanswered questions", () => {
  it("groups repeats of the same question into one row with a count", async () => {
    const t = convexTest(schema, modules);
    const officer = await asUser(t, { email: "officer@example.com", role: "officer" });
    const now = Date.now();
    await t.run(async (ctx) => {
      for (const [query, ago] of [
        ["PACS godown subsidy?", 3000],
        ["  pacs   GODOWN subsidy? ", 2000],
        ["PACS godown subsidy?", 1000],
        ["Milk price in dairy society?", 500],
      ] as const) {
        await ctx.db.insert("kb_queries", {
          query,
          language: "en",
          hits: 0,
          mode: "none",
          createdAt: now - ago,
        });
      }
    });
    const o = await officer.client.query(api.analytics.overview, {});
    expect(o.unanswered).toHaveLength(2);
    const godown = o.unanswered.find((u) => /godown/i.test(u.query));
    expect(godown?.count).toBe(3);
    expect(godown?.createdAt).toBe(now - 1000);
    expect(o.unanswered.find((u) => /milk/i.test(u.query))?.count).toBe(1);
  });
});
