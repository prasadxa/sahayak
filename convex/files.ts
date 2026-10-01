import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, action, query } from "./_generated/server";
import { v, Base64 } from "convex/values";

import { requireUserId } from "./access";
import { getRole } from "./roles";
import { assertWithinLimit } from "./ratelimits";

export const generateAttachmentUrl = mutation({
  args: {
    contentType: v.string(),
  },
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    await assertWithinLimit(ctx, "storageUpload", await getRole(ctx, userId), userId);
    return await ctx.storage.generateUploadUrl();
  },
});

export const getAttachmentUrl = mutation({
  args: {
    storageId: v.id("_storage"),
    name: v.string(),
    contentType: v.string(),
  },
  handler: async (ctx, args) => {
    await requireUserId(ctx);
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) throw new Error("Failed to get attachment URL");
    return {
      storageId: args.storageId,
      name: args.name,
      type: args.contentType,
      url,
    };
  },
});

const MAX_AI_IMAGE_BYTES = 5 * 1024 * 1024;

/** Bytes a base64 string decodes to, computed without decoding it. */
function decodedBase64Size(b64: string): number {
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

export const storeAiImage = action({
  args: {
    base64Image: v.string(),
  },
  handler: async (ctx, args) => {
    if (!(await getAuthUserId(ctx))) throw new Error("Not authenticated");
    const base64Data = args.base64Image.replace(/^data:image\/\w+;base64,/, "");
    if (decodedBase64Size(base64Data) > MAX_AI_IMAGE_BYTES) throw new Error("Image too large");
    const bytes = Base64.toByteArray(base64Data);
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "image/png" });
    const storageId = await ctx.storage.store(blob);
    return { storageId };
  },
});

export const getAiImageUrl = query({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await requireUserId(ctx);
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) {
      throw new Error("Failed to get image URL");
    }
    return { url };
  },
});
