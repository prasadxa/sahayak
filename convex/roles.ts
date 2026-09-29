import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { isStaffRole, ROLES, type Role } from "@/lib/constants";

function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * A user's effective role: ADMIN_EMAILS wins, but only for a verified email
 * (Google OAuth sets `emailVerificationTime`; Password sign-ups never do, so
 * anyone could register an admin's address). Then the stored role, which an
 * admin or operator assigned to this specific row.
 */
export function roleOfUser(user: Doc<"users">): Role {
  if (
    user.emailVerificationTime !== undefined &&
    adminEmails().has(user.email.toLowerCase())
  ) {
    return "admin";
  }
  const stored = user.role as Role | undefined;
  return stored && (ROLES as readonly string[]).includes(stored) ? stored : "member";
}

export async function getRole(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
): Promise<Role> {
  const user = await ctx.db.get(userId);
  return user ? roleOfUser(user) : "member";
}

/** Throws unless the caller is signed in as an officer or admin. */
export async function requireStaff(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  if (!isStaffRole(await getRole(ctx, userId))) throw new Error("Forbidden");
  return userId;
}

export async function requireAdmin(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  if ((await getRole(ctx, userId)) !== "admin") throw new Error("Forbidden");
  return userId;
}

/** For actions: `await ctx.runQuery(internal.roles.roleOf, { userId })`. */
export const roleOf = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<Role> => getRole(ctx, args.userId),
});

export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return { userId, role: roleOfUser(user), email: user.email, name: user.name };
  },
});

function assertRole(role: string): asserts role is Role {
  if (!(ROLES as readonly string[]).includes(role)) {
    throw new Error(`Invalid role "${role}". Use one of: ${ROLES.join(", ")}`);
  }
}

/**
 * Every user row with this email. Convex Auth does not link a Password
 * sign-up to an existing Google user, so one email can have several rows.
 * Matches the lowercased address and the address as typed (the `email`
 * index is case-sensitive; Password sign-ups are stored lowercased).
 */
async function usersByEmail(ctx: MutationCtx, rawEmail: string): Promise<Doc<"users">[]> {
  const typed = rawEmail.trim();
  const variants = [...new Set([typed.toLowerCase(), typed])];
  const byId = new Map<Id<"users">, Doc<"users">>();
  for (const email of variants) {
    const rows = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .collect();
    for (const row of rows) byId.set(row._id, row);
  }
  return [...byId.values()];
}

function ambiguous(email: string, count: number): Error {
  return new Error(
    `${count} accounts share the email ${email}. Remove the duplicates in the Convex dashboard first.`
  );
}

export const setRole = mutation({
  args: { email: v.string(), role: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const role = args.role;
    assertRole(role);
    const email = args.email.trim();
    const matches = await usersByEmail(ctx, email);
    if (matches.length === 0) {
      throw new Error(`No user with email ${args.email}. They must sign up first.`);
    }

    let target: Doc<"users">;
    if (isStaffRole(role)) {
      // Staff roles go only to a verified (Google) row, never to a Password
      // sign-up that may have been registered by someone else.
      const verified = matches.filter((u) => u.emailVerificationTime !== undefined);
      if (verified.length === 0) {
        throw new Error("Officers must sign in with Google first (verified email)");
      }
      if (verified.length > 1) {
        throw new Error(
          `${verified.length} verified accounts share the email ${email}. Remove the duplicates in the Convex dashboard first.`
        );
      }
      target = verified[0];
    } else {
      // kiosk / member: kiosk accounts are Password-based, so an unverified
      // row is fine, but only when it is the only one.
      if (matches.length > 1) throw ambiguous(email, matches.length);
      target = matches[0];
    }

    await ctx.db.patch(target._id, { role });
    return { userId: target._id, role };
  },
});

/**
 * Operator bootstrap, callable only with deployment credentials:
 *   npx convex run roles:grantRole '{"email":"dev@example.com","role":"admin"}'
 * Sets the stored role on the single user with this email (verified or not,
 * so a Password dev account can become admin). Throws if several match.
 */
export const grantRole = internalMutation({
  args: { email: v.string(), role: v.string() },
  handler: async (ctx, args) => {
    const role = args.role;
    assertRole(role);
    const email = args.email.trim();
    const matches = await usersByEmail(ctx, email);
    if (matches.length === 0) {
      throw new Error(`No user with email ${args.email}. They must sign up first.`);
    }
    if (matches.length > 1) throw ambiguous(email, matches.length);
    await ctx.db.patch(matches[0]._id, { role });
    return { userId: matches[0]._id, role };
  },
});

export const listStaff = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await Promise.all(
      (["officer", "admin", "kiosk"] as const).map((role) =>
        ctx.db
          .query("users")
          .withIndex("by_role", (q) => q.eq("role", role))
          .collect()
      )
    );
    return rows
      .flat()
      .map((u) => ({ userId: u._id, email: u.email, name: u.name, role: roleOfUser(u) }));
  },
});
