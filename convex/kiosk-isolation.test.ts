import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import { asUser } from "./test.helpers";

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
});
