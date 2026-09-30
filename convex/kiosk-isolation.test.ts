import { convexTest, type TestConvex } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import { asUser } from "./test.helpers";
import crons from "./crons";

const page = { numItems: 20, cursor: null };

describe("kiosk account isolation", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("never lists earlier citizens' chats in the kiosk account's history", async () => {
    const t = convexTest(schema, modules);
    const kiosk = await asUser(t, { email: "kiosk.pacs01@example.com", role: "kiosk" });
    await kiosk.client.mutation(api.chats.saveChat, {
      chatId: "citizen-a",
      title: "Ramesh loan complaint",
      visibility: "private",
    });
    expect((await kiosk.client.query(api.chats.listChats, { paginationOpts: page })).page).toEqual([]);
  });

  it("never lists kiosk-filed grievances on the kiosk account's My grievances page", async () => {
    const t = convexTest(schema, modules);
    const kiosk = await asUser(t, { email: "kiosk.pacs01@example.com", role: "kiosk" });
    await kiosk.client.mutation(api.grievances.file, {
      category: "loan_credit",
      subject: "Loan not sanctioned",
      description: "Applied three months ago",
      contact: "9800000000",
    });
    expect(await kiosk.client.query(api.grievances.listMine, {})).toEqual([]);
  });

  it("refuses to store personal memories for a kiosk account, before any embedding call", async () => {
    const t = convexTest(schema, modules);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const kiosk = await asUser(t, { email: "kiosk.pacs01@example.com", role: "kiosk" });
    const result = await kiosk.client.action(api.memories.createResource, {
      content: "My name is Ramesh, phone 9800000000",
    });
    expect(result).toMatch(/not available on the kiosk/i);
    expect(fetchSpy).not.toHaveBeenCalled();
    const rows = await t.run((ctx) => ctx.db.query("memories").collect());
    expect(rows).toEqual([]);
  });

  it("refuses to recall memories for a kiosk account", async () => {
    const t = convexTest(schema, modules);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const kiosk = await asUser(t, { email: "kiosk.pacs01@example.com", role: "kiosk" });
    const result = await kiosk.client.action(api.memories.searchResource, { query: "what is my name" });
    expect(result).toMatch(/not available on the kiosk/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("still lists a normal member's own chats", async () => {
    const t = convexTest(schema, modules);
    const member = await asUser(t, { email: "farmer@example.com" });
    await member.client.mutation(api.chats.saveChat, { chatId: "c1", title: "t", visibility: "private" });
    expect((await member.client.query(api.chats.listChats, { paginationOpts: page })).page).toHaveLength(1);
  });

  it("returns no memories to a kiosk account, even rows stored before it became a kiosk", async () => {
    const t = convexTest(schema, modules);
    const kiosk = await asUser(t, { email: "kiosk.pacs01@example.com", role: "kiosk" });
    await t.run((ctx) =>
      ctx.db.insert("memories", {
        userId: kiosk.userId,
        resourceId: "r1",
        content: "Ramesh, phone 9800000000",
        embedding: Array<number>(1536).fill(0),
      })
    );
    expect(await kiosk.client.query(api.memories.listMemories, {})).toEqual([]);
    // deleteAllMemories still clears the kiosk account's own rows.
    await kiosk.client.mutation(api.memories.deleteAllMemories, {});
    expect(await t.run((ctx) => ctx.db.query("memories").collect())).toEqual([]);
  });

  it("still lists a normal member's own memories", async () => {
    const t = convexTest(schema, modules);
    const member = await asUser(t, { email: "farmer@example.com" });
    await t.run((ctx) =>
      ctx.db.insert("memories", {
        userId: member.userId,
        resourceId: "r1",
        content: "Grows soybean",
        embedding: Array<number>(1536).fill(0),
      })
    );
    expect(await member.client.query(api.memories.listMemories, {})).toHaveLength(1);
  });
});

describe("chats.purgeKioskChats", () => {
  const HOUR_MS = 60 * 60 * 1000;
  afterEach(() => vi.useRealTimers());

  async function chatsWithChildren(t: TestConvex<typeof schema>, chatId: string) {
    return await t.run(async (ctx) => {
      const count = async (table: "messages" | "votes" | "documents" | "streams") =>
        (await ctx.db.query(table).withIndex("by_chatId", (q) => q.eq("chatId", chatId)).collect()).length;
      const chat = await ctx.db.query("chats").withIndex("by_chatId", (q) => q.eq("chatId", chatId)).first();
      return {
        chat: chat !== null,
        messages: await count("messages"),
        votes: await count("votes"),
        documents: await count("documents"),
        streams: await count("streams"),
      };
    });
  }

  async function chatWithChildren(
    client: Awaited<ReturnType<typeof asUser>>["client"],
    chatId: string
  ) {
    await client.mutation(api.chats.saveChat, { chatId, title: "Citizen question", visibility: "private" });
    await client.mutation(api.messages.saveMessages, {
      messages: [{ messageId: `${chatId}-m1`, chatId, role: "user", parts: [{ type: "text", text: "My phone is 9800000000" }] }],
    });
    await client.mutation(api.chats.voteMessage, { chatId, messageId: `${chatId}-m1`, type: "up" });
    await client.mutation(api.streams.createStreamId, { streamId: `${chatId}-s1`, chatId });
  }

  it("purges a kiosk chat older than an hour with its messages, votes, documents and streams", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const start = Date.now();
    const t = convexTest(schema, modules);
    const kiosk = await asUser(t, { email: "kiosk.pacs01@example.com", role: "kiosk" });
    const member = await asUser(t, { email: "farmer@example.com" });
    await chatWithChildren(kiosk.client, "kiosk-old");
    await t.run(async (ctx) => {
      await ctx.db.insert("documents", {
        title: "Receipt",
        content: "GRV-12345678",
        kind: "text",
        documentId: "doc-1",
        userId: kiosk.userId,
        chatId: "kiosk-old",
      });
    });
    await chatWithChildren(member.client, "member-old");

    vi.setSystemTime(start + 2 * HOUR_MS);
    await chatWithChildren(kiosk.client, "kiosk-recent");

    const result = await t.mutation(internal.chats.purgeKioskChats, {});
    expect(result).toEqual({ deleted: 1, more: false });

    expect(await chatsWithChildren(t, "kiosk-old")).toEqual({
      chat: false,
      messages: 0,
      votes: 0,
      documents: 0,
      streams: 0,
    });
    expect(await chatsWithChildren(t, "kiosk-recent")).toMatchObject({ chat: true, messages: 1, votes: 1, streams: 1 });
    expect(await chatsWithChildren(t, "member-old")).toMatchObject({ chat: true, messages: 1, votes: 1, streams: 1 });
  });

  it("deletes 50 chats per run and reschedules itself while more remain", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const start = Date.now();
    const t = convexTest(schema, modules);
    const kiosk = await asUser(t, { email: "kiosk.pacs01@example.com", role: "kiosk" });
    await t.run(async (ctx) => {
      for (let i = 0; i < 52; i++) {
        await ctx.db.insert("chats", { chatId: `k-${i}`, title: "q", visibility: "private", userId: kiosk.userId });
      }
    });
    vi.setSystemTime(start + 2 * HOUR_MS);

    expect(await t.mutation(internal.chats.purgeKioskChats, {})).toEqual({ deleted: 50, more: true });
    expect(await t.run((ctx) => ctx.db.query("chats").collect())).toHaveLength(2);
    const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
    expect(scheduled.map((s) => s.name)).toContain("chats:purgeKioskChats");

    expect(await t.mutation(internal.chats.purgeKioskChats, {})).toEqual({ deleted: 2, more: false });
    expect(await t.run((ctx) => ctx.db.query("chats").collect())).toEqual([]);
  });

  it("is registered as a cron", () => {
    const jobs = (crons as unknown as { crons: Record<string, { name: string; schedule: unknown }> }).crons;
    const job = Object.values(jobs).find((j) => j.name === "chats:purgeKioskChats");
    expect(job?.schedule).toEqual({ type: "interval", minutes: 15 });
  });
});
