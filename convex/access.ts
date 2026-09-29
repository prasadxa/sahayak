import { getAuthUserId } from "@convex-dev/auth/server";

import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

/** Chat ownership and visibility checks shared by chats, messages and streams. */

export async function requireUserId(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

export async function findChat(
  ctx: QueryCtx | MutationCtx,
  chatId: string
): Promise<Doc<"chats"> | null> {
  return await ctx.db
    .query("chats")
    .withIndex("by_chatId", (q) => q.eq("chatId", chatId))
    .first();
}

/** The chat if the caller owns it or it is public, otherwise null. */
export async function readableChat(
  ctx: QueryCtx | MutationCtx,
  chatId: string
): Promise<Doc<"chats"> | null> {
  const chat = await findChat(ctx, chatId);
  if (!chat) return null;
  if (chat.visibility === "public") return chat;
  const userId = await getAuthUserId(ctx);
  return userId && chat.userId === userId ? chat : null;
}

/** Throws unless the signed-in caller owns the chat. */
export async function requireOwnedChat(
  ctx: QueryCtx | MutationCtx,
  chatId: string
): Promise<{ userId: Id<"users">; chat: Doc<"chats"> }> {
  const userId = await requireUserId(ctx);
  const chat = await findChat(ctx, chatId);
  if (!chat) throw new Error("Chat not found");
  if (chat.userId !== userId) throw new Error("Forbidden");
  return { userId, chat };
}
