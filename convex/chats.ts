import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { paginationOptsValidator } from "convex/server";
import { getAuthUserId } from "@convex-dev/auth/server";

import { findChat, readableChat, requireOwnedChat, requireUserId } from "./access";
import { getRole, roleOfUser } from "./roles";
import { assertWithinLimit } from "./ratelimits";

/** Deletes a chat and everything keyed by its chatId: messages, votes, documents, streams. */
async function deleteChatAndChildren(ctx: MutationCtx, chat: Doc<"chats">): Promise<void> {
  const chatId = chat.chatId;
  const [messages, votes, documents, streams] = await Promise.all([
    ctx.db.query("messages").withIndex("by_chatId", (q) => q.eq("chatId", chatId)).collect(),
    ctx.db.query("votes").withIndex("by_chatId", (q) => q.eq("chatId", chatId)).collect(),
    ctx.db.query("documents").withIndex("by_chatId", (q) => q.eq("chatId", chatId)).collect(),
    ctx.db.query("streams").withIndex("by_chatId", (q) => q.eq("chatId", chatId)).collect(),
  ]);
  await Promise.all([
    ...[...votes, ...messages, ...documents, ...streams].map((row) => ctx.db.delete(row._id)),
    ctx.db.delete(chat._id),
  ]);
}

export const saveChat = mutation({
  args: {
    title: v.string(),
    chatId: v.string(),
    visibility: v.union(v.literal("private"), v.literal("public")),
    // UI language code at chat creation (e.g. "hi"), for analytics.
    language: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    if (await findChat(ctx, args.chatId)) {
      throw new Error("A chat with this id already exists");
    }
    return await ctx.db.insert("chats", { ...args, userId });
  },
});

export const listChats = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    // A kiosk account serves many walk-in citizens: never show their history.
    if (!userId || (await getRole(ctx, userId)) === "kiosk") {
      return { page: [], isDone: true, continueCursor: "" };
    }
    const result = await ctx.db
      .query("chats")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .paginate(args.paginationOpts);

    return result;
  },
});

export const getChatById = query({
  args: { chatId: v.string() },
  handler: async (ctx, args) => readableChat(ctx, args.chatId),
});

export const deleteChatById = mutation({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const { chat } = await requireOwnedChat(ctx, args.id);
    await deleteChatAndChildren(ctx, chat);
  },
});

/** Kiosk chats hold walk-in citizens' details; keep them only this long. */
export const KIOSK_CHAT_TTL_MS = 60 * 60 * 1000;
const KIOSK_PURGE_BATCH = 50;

/**
 * Cron (every 15 min): deletes chats owned by kiosk-role accounts that are
 * older than KIOSK_CHAT_TTL_MS, KIOSK_PURGE_BATCH per run, and reschedules
 * itself while more remain.
 */
export const purgeKioskChats = internalMutation({
  args: {},
  returns: v.object({ deleted: v.number(), more: v.boolean() }),
  handler: async (ctx) => {
    const cutoff = Date.now() - KIOSK_CHAT_TTL_MS;
    const kioskUsers = (
      await ctx.db
        .query("users")
        .withIndex("by_role", (q) => q.eq("role", "kiosk"))
        .collect()
    ).filter((u) => roleOfUser(u) === "kiosk");

    // Collect one more than a batch to learn whether another run is needed.
    const candidates: Doc<"chats">[] = [];
    for (const user of kioskUsers) {
      const need = KIOSK_PURGE_BATCH + 1 - candidates.length;
      if (need <= 0) break;
      const rows = await ctx.db
        .query("chats")
        .withIndex("by_userId", (q) => q.eq("userId", user._id).lt("_creationTime", cutoff))
        .take(need);
      candidates.push(...rows);
    }

    const batch = candidates.slice(0, KIOSK_PURGE_BATCH);
    for (const chat of batch) {
      await deleteChatAndChildren(ctx, chat);
    }
    const more = candidates.length > KIOSK_PURGE_BATCH;
    if (more) {
      await ctx.scheduler.runAfter(0, internal.chats.purgeKioskChats, {});
    }
    return { deleted: batch.length, more };
  },
});

export const voteMessage = mutation({
  args: {
    chatId: v.string(),
    messageId: v.string(),
    type: v.union(v.literal("up"), v.literal("down")),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireOwnedChat(ctx, args.chatId);
    await assertWithinLimit(ctx, "vote", await getRole(ctx, userId), userId);
    // The message must belong to this chat, or the owner of chat A could vote
    // on (or flip the vote of) a message in someone else's chat B.
    const message = await ctx.db
      .query("messages")
      .withIndex("by_messageId", (q) => q.eq("messageId", args.messageId))
      .first();
    if (!message || message.chatId !== args.chatId) throw new Error("Forbidden");

    const existingVote = await ctx.db
      .query("votes")
      .withIndex("by_messageId", (q) => q.eq("messageId", args.messageId))
      .filter((q) => q.eq(q.field("chatId"), args.chatId))
      .first();

    if (existingVote) {
      return await ctx.db.patch(existingVote._id, {
        isUpvoted: args.type === "up",
      });
    }

    return await ctx.db.insert("votes", {
      chatId: args.chatId,
      messageId: args.messageId,
      isUpvoted: args.type === "up",
    });
  },
});

export const getVotesByChatId = query({
  args: { chatId: v.string() },
  handler: async (ctx, args) => {
    if (!(await readableChat(ctx, args.chatId))) return [];
    return await ctx.db
      .query("votes")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .collect();
  },
});

export const updateChatVisibilityById = mutation({
  args: {
    chatId: v.string(),
    visibility: v.union(v.literal("private"), v.literal("public")),
  },
  handler: async (ctx, args) => {
    const { chat } = await requireOwnedChat(ctx, args.chatId);

    return await ctx.db.patch(chat._id, {
      visibility: args.visibility,
    });
  },
});

export const togglePinChat = mutation({
  args: {
    chatId: v.string(),
  },
  returns: v.object({ isPinned: v.boolean() }),
  handler: async (ctx, args) => {
    const { chat } = await requireOwnedChat(ctx, args.chatId);

    await ctx.db.patch(chat._id, { isPinned: !chat.isPinned });

    return { isPinned: !chat.isPinned };
  },
});

export const renameChat = mutation({
  args: {
    chatId: v.string(),
    newTitle: v.string(),
  },
  handler: async (ctx, args) => {
    const { chat } = await requireOwnedChat(ctx, args.chatId);

    await ctx.db.patch(chat._id, { title: args.newTitle });
  },
});

export const deleteAllUserChats = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const userChats = await ctx.db
      .query("chats")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    for (const chat of userChats) {
      await deleteChatAndChildren(ctx, chat);
    }

    return { deletedChatsCount: userChats.length };
  },
});
