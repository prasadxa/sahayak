import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { readableChat, requireOwnedChat, requireUserId } from "./access";

/**
 * Documents are versioned by `documentId`: every version is its own row.
 * The first (oldest) version's `userId` is the owner of the whole document.
 */

/** A document version as returned to clients: never includes the owner's userId. */
export type PublicDocument = Omit<Doc<"documents">, "userId">;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function withoutOwner({ userId: _userId, ...doc }: Doc<"documents">): PublicDocument {
  return doc;
}

/** The oldest version of a document, or null if it does not exist. */
export async function findDocument(
  ctx: QueryCtx | MutationCtx,
  documentId: string
): Promise<Doc<"documents"> | null> {
  return await ctx.db
    .query("documents")
    .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
    .first();
}

/** True if the caller owns the document, or the document belongs to a public chat. */
async function canReadDocument(
  ctx: QueryCtx | MutationCtx,
  doc: Doc<"documents">
): Promise<boolean> {
  const userId = await getAuthUserId(ctx);
  if (userId && doc.userId === userId) return true;
  if (!doc.chatId) return false;
  return (await readableChat(ctx, doc.chatId))?.visibility === "public";
}

/** Throws unless the signed-in caller owns the (existing) document. */
export async function requireOwnedDocument(
  ctx: QueryCtx | MutationCtx,
  documentId: string
): Promise<{ userId: Id<"users">; document: Doc<"documents"> }> {
  const userId = await requireUserId(ctx);
  const document = await findDocument(ctx, documentId);
  if (!document) throw new Error("Document not found");
  if (document.userId !== userId) throw new Error("Forbidden");
  return { userId, document };
}

const documentKind = v.union(
  v.literal("text"),
  v.literal("code"),
  v.literal("image"),
  v.literal("sheet")
);

export const saveDocument = mutation({
  args: {
    documentId: v.string(),
    title: v.string(),
    kind: documentKind,
    content: v.string(),
    chatId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const existing = await findDocument(ctx, args.documentId);
    if (existing && existing.userId !== userId) throw new Error("Forbidden");
    if (args.chatId) await requireOwnedChat(ctx, args.chatId);
    return await ctx.db.insert("documents", { ...args, userId });
  },
});

export const getDocumentById = query({
  args: { documentId: v.string() },
  handler: async (ctx, args) => {
    const doc = await findDocument(ctx, args.documentId);
    if (!doc || !(await canReadDocument(ctx, doc))) return null;
    return withoutOwner(doc);
  },
});

export const updateDocument = mutation({
  args: {
    documentId: v.string(),
    content: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireOwnedDocument(ctx, args.documentId);
    const latestVersion = await ctx.db
      .query("documents")
      .withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
      .order("desc")
      .first();

    if (!latestVersion) {
      throw new Error("Cannot update document: No existing version found.");
    }

    return await ctx.db.insert("documents", {
      documentId: args.documentId,
      userId,
      title: latestVersion.title,
      kind: latestVersion.kind,
      content: args.content ?? latestVersion.content,
      chatId: latestVersion.chatId,
    });
  },
});

export const deleteDocumentsByIdAfterTimestamp = mutation({
  args: {
    documentId: v.string(),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    await requireOwnedDocument(ctx, args.documentId);

    const suggestions = await ctx.db
      .query("suggestions")
      .withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
      .filter((q) => q.gt(q.field("_creationTime"), args.timestamp))
      .collect();
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
      .filter((q) => q.gt(q.field("_creationTime"), args.timestamp))
      .collect();

    await Promise.all([...suggestions, ...documents].map((row) => ctx.db.delete(row._id)));
  },
});

export const getDocumentVersions = query({
  args: { documentId: v.string() },
  handler: async (ctx, args) => {
    const doc = await findDocument(ctx, args.documentId);
    if (!doc || !(await canReadDocument(ctx, doc))) return [];

    const documents = await ctx.db
      .query("documents")
      .withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
      .order("desc")
      .collect();

    return documents.map(withoutOwner);
  },
});
