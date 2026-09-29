import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { requireUserId } from "./access";
import { findDocument, requireOwnedDocument } from "./documents";

export const saveSuggestions = mutation({
  args: {
    suggestions: v.array(
      v.object({
        suggestionId: v.string(),
        documentId: v.string(),
        originalText: v.string(),
        suggestedText: v.string(),
        description: v.optional(v.string()),
        isResolved: v.boolean(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const documentIds = new Set(args.suggestions.map((s) => s.documentId));
    for (const documentId of documentIds) {
      await requireOwnedDocument(ctx, documentId);
    }
    return await Promise.all(
      args.suggestions.map((suggestion) =>
        ctx.db.insert("suggestions", { ...suggestion, userId })
      )
    );
  },
});

/** Suggestions are private to the document's owner; anyone else gets []. */
export const getSuggestionsByDocumentId = query({
  args: { documentId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const document = await findDocument(ctx, args.documentId);
    if (!document || document.userId !== userId) return [];
    return await ctx.db
      .query("suggestions")
      .withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
      .collect();
  },
});
