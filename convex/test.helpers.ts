import type { TestConvex } from "convex-test";
import type schema from "./schema";
import type { Id } from "./_generated/dataModel";

type T = TestConvex<typeof schema>;

/**
 * Insert a user row and return a client authenticated as that user.
 * `verified: true` sets `emailVerificationTime`, as a Google OAuth sign-in
 * does. Password sign-ups leave it unset.
 */
export async function asUser(
  t: T,
  fields: { email: string; name?: string; role?: string; verified?: boolean }
) {
  const userId: Id<"users"> = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: fields.name ?? fields.email.split("@")[0],
      email: fields.email,
      image: "",
      ...(fields.role ? { role: fields.role } : {}),
      ...(fields.verified ? { emailVerificationTime: Date.now() } : {}),
    })
  );
  return { userId, client: t.withIdentity({ subject: `${userId}|test-session` }) };
}
