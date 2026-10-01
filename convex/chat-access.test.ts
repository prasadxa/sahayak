import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { testConvex } from "./test.setup";
import { asUser } from "./test.helpers";

async function setup() {
  const t = testConvex();
  const alice = await asUser(t, { email: "alice@example.com" });
  const mallory = await asUser(t, { email: "mallory@example.com" });
  await alice.client.mutation(api.chats.saveChat, {
    chatId: "chat-private",
    title: "My loan problem",
    visibility: "private",
  });
  await alice.client.mutation(api.chats.saveChat, {
    chatId: "chat-public",
    title: "Shared answer",
    visibility: "public",
  });
  await alice.client.mutation(api.messages.saveMessages, {
    messages: [
      { messageId: "m1", chatId: "chat-private", role: "user", parts: [{ type: "text", text: "My phone is 98xxxx" }] },
      { messageId: "m2", chatId: "chat-public", role: "user", parts: [{ type: "text", text: "PMFBY?" }] },
    ],
  });
  return { t, alice, mallory };
}

const page = { numItems: 20, cursor: null };

describe("chat access control", () => {
  it("saveChat stores the chat under the signed-in user", async () => {
    const { t, alice } = await setup();
    const chat = await t.run((ctx) =>
      ctx.db.query("chats").withIndex("by_chatId", (q) => q.eq("chatId", "chat-private")).first()
    );
    expect(chat?.userId).toBe(alice.userId);
  });

  it("saveChat refuses anonymous callers and duplicate chat ids", async () => {
    const { t, mallory } = await setup();
    await expect(
      t.mutation(api.chats.saveChat, { chatId: "x", title: "t", visibility: "private" })
    ).rejects.toThrow(/Not authenticated/);
    await expect(
      mallory.client.mutation(api.chats.saveChat, {
        chatId: "chat-private",
        title: "hijack",
        visibility: "private",
      })
    ).rejects.toThrow(/already exists/);
  });

  it("listChats only ever returns the caller's own chats", async () => {
    const { t, alice, mallory } = await setup();
    expect((await mallory.client.query(api.chats.listChats, { paginationOpts: page })).page).toEqual([]);
    expect((await alice.client.query(api.chats.listChats, { paginationOpts: page })).page).toHaveLength(2);
    expect((await t.query(api.chats.listChats, { paginationOpts: page })).page).toEqual([]);
  });

  it("hides another user's private chat and its messages", async () => {
    const { t, mallory } = await setup();
    expect(await mallory.client.query(api.chats.getChatById, { chatId: "chat-private" })).toBeNull();
    expect(await t.query(api.chats.getChatById, { chatId: "chat-private" })).toBeNull();
    expect(await mallory.client.query(api.messages.getMessagesByChatId, { chatId: "chat-private" })).toEqual([]);
    expect(await mallory.client.query(api.chats.getVotesByChatId, { chatId: "chat-private" })).toEqual([]);
  });

  it("still lets anyone read a public chat", async () => {
    const { t } = await setup();
    expect((await t.query(api.chats.getChatById, { chatId: "chat-public" }))?.title).toBe("Shared answer");
    expect(await t.query(api.messages.getMessagesByChatId, { chatId: "chat-public" })).toHaveLength(1);
  });

  it("lets the owner read their private chat", async () => {
    const { alice } = await setup();
    expect(await alice.client.query(api.chats.getChatById, { chatId: "chat-private" })).not.toBeNull();
    expect(await alice.client.query(api.messages.getMessagesByChatId, { chatId: "chat-private" })).toHaveLength(1);
  });

  it("forbids writing to or deleting someone else's chat, even a public one", async () => {
    const { mallory } = await setup();
    const forbidden = /Forbidden/;
    await expect(mallory.client.mutation(api.chats.deleteChatById, { id: "chat-public" })).rejects.toThrow(forbidden);
    await expect(
      mallory.client.mutation(api.messages.saveMessages, {
        messages: [{ messageId: "evil", chatId: "chat-public", role: "assistant", parts: [] }],
      })
    ).rejects.toThrow(forbidden);
    await expect(mallory.client.mutation(api.messages.deleteTrailingMessages, { messageId: "m2" })).rejects.toThrow(forbidden);
    await expect(
      mallory.client.mutation(api.chats.voteMessage, { chatId: "chat-public", messageId: "m2", type: "down" })
    ).rejects.toThrow(forbidden);
    await expect(
      mallory.client.mutation(api.chats.updateChatVisibilityById, { chatId: "chat-private", visibility: "public" })
    ).rejects.toThrow(forbidden);
    await expect(mallory.client.mutation(api.chats.togglePinChat, { chatId: "chat-public" })).rejects.toThrow(forbidden);
    await expect(
      mallory.client.mutation(api.chats.renameChat, { chatId: "chat-public", newTitle: "x" })
    ).rejects.toThrow(forbidden);
    await expect(
      mallory.client.mutation(api.streams.createStreamId, { streamId: "s", chatId: "chat-public" })
    ).rejects.toThrow(forbidden);
  });

  it("refuses a vote on a message from another chat, passed with the caller's own chatId", async () => {
    const { t, alice, mallory } = await setup();
    await alice.client.mutation(api.chats.voteMessage, { chatId: "chat-public", messageId: "m2", type: "up" });
    await mallory.client.mutation(api.chats.saveChat, { chatId: "chat-m", title: "mine", visibility: "private" });
    await expect(
      mallory.client.mutation(api.chats.voteMessage, { chatId: "chat-m", messageId: "m2", type: "down" })
    ).rejects.toThrow(/Forbidden/);
    const votes = await t.run((ctx) => ctx.db.query("votes").collect());
    expect(votes).toHaveLength(1);
    expect(votes[0]).toMatchObject({ chatId: "chat-public", messageId: "m2", isUpvoted: true });
  });

  it("lets the owner vote on, and then flip, a vote on their own message", async () => {
    const { t, alice } = await setup();
    await alice.client.mutation(api.chats.voteMessage, { chatId: "chat-private", messageId: "m1", type: "up" });
    await alice.client.mutation(api.chats.voteMessage, { chatId: "chat-private", messageId: "m1", type: "down" });
    const votes = await t.run((ctx) => ctx.db.query("votes").collect());
    expect(votes).toHaveLength(1);
    expect(votes[0]).toMatchObject({ chatId: "chat-private", messageId: "m1", isUpvoted: false });
  });

  it("lets the owner delete their chat", async () => {
    const { t, alice } = await setup();
    await alice.client.mutation(api.chats.deleteChatById, { id: "chat-private" });
    const msgs = await t.run((ctx) =>
      ctx.db.query("messages").withIndex("by_chatId", (q) => q.eq("chatId", "chat-private")).collect()
    );
    expect(msgs).toEqual([]);
  });

  it("hides stream ids of another user's chat", async () => {
    const { alice, mallory } = await setup();
    await alice.client.mutation(api.streams.createStreamId, { streamId: "s1", chatId: "chat-private" });
    expect(await mallory.client.query(api.streams.getStreamIdsByChatId, { chatId: "chat-private" })).toEqual([]);
    expect(await alice.client.query(api.streams.getStreamIdsByChatId, { chatId: "chat-private" })).toEqual(["s1"]);
  });

  it("requires sign-in to get an upload URL", async () => {
    const { t } = await setup();
    await expect(t.mutation(api.files.generateAttachmentUrl, { contentType: "audio/webm" })).rejects.toThrow(
      /Not authenticated/
    );
  });
});
