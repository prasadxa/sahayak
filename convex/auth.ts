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

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password({ profile: passwordProfile }), Google],
});
