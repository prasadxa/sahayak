import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

/**
 * Maps the email/password sign-up form to a `users` row. The table requires
 * `name` and `image`, which the Password provider does not supply by default.
 */
export function passwordProfile(params: Record<string, unknown>) {
  const email = typeof params.email === "string" ? params.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("A valid email address is required");
  }
  const name =
    typeof params.name === "string" && params.name.trim()
      ? params.name.trim()
      : email.split("@")[0];
  return { email, name, image: "" };
}

/**
 * Maps Google's OIDC claims to a `users` row and passes Google's
 * `email_verified` claim through as `emailVerified`.
 *
 * Why: @convex-dev/auth 0.0.80 (`defaultCreateOrUpdateUser`) computes
 * `emailVerified = profile.emailVerified ?? (provider is oauth/oidc)`, so
 * without this every Google sign-in gets `emailVerificationTime`, and the
 * default Google profile drops the claim. Only an explicit `false` stops that
 * (and also stops linking to an existing verified user by email). The flag is
 * stripped before the users row is written, so it needs no schema field.
 * `roleOfUser` grants ADMIN_EMAILS admin only when emailVerificationTime is set.
 */
export function googleProfile(p: Record<string, unknown>) {
  const email = typeof p.email === "string" ? p.email.toLowerCase() : undefined;
  const name =
    typeof p.name === "string" && p.name ? p.name : (typeof p.email === "string" ? p.email : "").split("@")[0];
  return {
    id: String(p.sub),
    name,
    email,
    image: typeof p.picture === "string" ? p.picture : "",
    emailVerified: p.email_verified === true,
  };
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password({ profile: passwordProfile }), Google({ profile: googleProfile })],
});
