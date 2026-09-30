import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { RateLimiter, MINUTE } from "@convex-dev/rate-limiter";

import { mutation } from "./_generated/server";
import { components } from "./_generated/api";
import type { ActionCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getRole } from "./roles";
import type { Role } from "@/lib/constants";

/**
 * Per-user token buckets guarding the expensive CallMissed paths (chat,
 * speech, KB search). A bucket refills continuously at `rate` per `period`,
 * so ordinary use never reaches the cap; a tight script drains it. Kiosk
 * accounts are shared by every citizen at one terminal, so each bucket has
 * a wider `*Kiosk` variant picked by role.
 */
export const rateLimiter = new RateLimiter(components.rateLimiter, {
  chatMessage: { kind: "token bucket", rate: 20, period: MINUTE },
  voice: { kind: "token bucket", rate: 20, period: MINUTE },
  kbSearch: { kind: "token bucket", rate: 40, period: MINUTE },
  chatMessageKiosk: { kind: "token bucket", rate: 60, period: MINUTE },
  voiceKiosk: { kind: "token bucket", rate: 60, period: MINUTE },
  kbSearchKiosk: { kind: "token bucket", rate: 120, period: MINUTE },
});

type Bucket = "chatMessage" | "voice" | "kbSearch";

/**
 * Take one token from `base`'s bucket for `userId` — the kiosk variant when
 * `role` is "kiosk". Usable from mutations and actions; the bucket is keyed
 * by user id, never by request content.
 */
export async function consume(
  ctx: MutationCtx | ActionCtx,
  base: Bucket,
  role: Role,
  userId: Id<"users">
) {
  const name = role === "kiosk" ? (`${base}Kiosk` as const) : base;
  return rateLimiter.limit(ctx, name, { key: userId });
}

/** Like `consume` but throws a user-facing error when the bucket is empty. */
export async function assertWithinLimit(
  ctx: MutationCtx | ActionCtx,
  base: Bucket,
  role: Role,
  userId: Id<"users">
): Promise<void> {
  const { ok, retryAfter } = await consume(ctx, base, role, userId);
  if (!ok) {
    throw new Error(
      `Rate limit exceeded. Try again in ${Math.ceil(retryAfter / 1000)}s.`
    );
  }
}

/**
 * HTTP-facing consume for the chat bucket: the Next.js chat route calls
 * this before streaming a reply and turns `ok: false` into a 429. Kept
 * public (not internal) because route handlers sit outside Convex.
 */
export const consumeChatMessage = mutation({
  args: {},
  returns: v.object({ ok: v.boolean(), retryAfter: v.number() }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const role = await getRole(ctx, userId);
    const result = await consume(ctx, "chatMessage", role, userId);
    return { ok: result.ok, retryAfter: result.retryAfter ?? 0 };
  },
});
