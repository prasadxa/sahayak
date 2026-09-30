import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import { googleProfile, passwordProfile } from "./auth";
import schema from "./schema";
import { modules } from "./test.setup";

describe("passwordProfile", () => {
  it("fills the name and image fields the users table requires", () => {
    const profile = passwordProfile({ email: "Farmer.Ram@Example.com", flow: "signUp" });
    expect(profile).toEqual({
      email: "farmer.ram@example.com",
      name: "farmer.ram",
      image: "",
    });
  });

  it("uses a provided name when the sign-up form sends one", () => {
    expect(passwordProfile({ email: "a@b.co", name: "  Sita Devi " }).name).toBe("Sita Devi");
  });

  it("rejects a missing or malformed email", () => {
    expect(() => passwordProfile({})).toThrow(/email/i);
    expect(() => passwordProfile({ email: "not-an-email" })).toThrow(/email/i);
  });
});

describe("googleProfile", () => {
  const claims = {
    sub: "google-sub-123",
    name: "Boss Officer",
    email: "Boss@Example.com",
    picture: "https://lh3.googleusercontent.com/a/boss",
    email_verified: true,
  };

  it("maps Google's claims to a users row and passes email_verified through", () => {
    expect(googleProfile(claims)).toEqual({
      id: "google-sub-123",
      name: "Boss Officer",
      email: "boss@example.com",
      image: "https://lh3.googleusercontent.com/a/boss",
      emailVerified: true,
    });
  });

  it("reports an unverified Google email as unverified", () => {
    expect(googleProfile({ ...claims, email_verified: false }).emailVerified).toBe(false);
  });

  it("treats a missing or non-boolean email_verified as unverified", () => {
    const noClaim: Record<string, unknown> = { ...claims };
    delete noClaim.email_verified;
    expect(googleProfile(noClaim).emailVerified).toBe(false);
    expect(googleProfile({ ...claims, email_verified: "true" }).emailVerified).toBe(false);
  });

  it("falls back to the email local part and an empty image", () => {
    const p = googleProfile({ sub: "s", email: "Ram.Farmer@Example.com", email_verified: true });
    expect(p.name).toBe("Ram.Farmer");
    expect(p.image).toBe("");
  });
});

/**
 * End to end through Convex Auth's own user upsert (auth:store,
 * createAccountFromCredentials against the configured "google" provider):
 * @convex-dev/auth 0.0.80 sets emailVerificationTime for an OAuth/OIDC
 * provider unless the profile says `emailVerified: false`.
 */
describe("Google sign-in and ADMIN_EMAILS", () => {
  beforeEach(() => {
    process.env.ADMIN_EMAILS = "boss@example.com";
  });
  afterEach(() => {
    delete process.env.ADMIN_EMAILS;
  });

  async function signInWithGoogle(emailVerified: boolean) {
    const t = convexTest(schema, modules);
    const { id, ...profile } = googleProfile({
      sub: "google-sub-123",
      name: "Boss",
      email: "boss@example.com",
      picture: "",
      email_verified: emailVerified,
    });
    const result = await t.mutation(internal.auth.store, {
      args: {
        type: "createAccountFromCredentials",
        provider: "google",
        account: { id },
        profile,
      },
    });
    const userId = (result as { user: { _id: string } }).user._id;
    const user = await t.run((ctx) => ctx.db.query("users").first());
    const client = t.withIdentity({ subject: `${userId}|test-session` });
    return { user, role: (await client.query(api.roles.me, {}))?.role };
  }

  it("does not verify, or make admin, an email Google says is unverified", async () => {
    const { user, role } = await signInWithGoogle(false);
    expect(user?.email).toBe("boss@example.com");
    expect(user?.emailVerificationTime).toBeUndefined();
    expect(role).toBe("member");
  });

  it("verifies, and makes admin, an email Google has verified", async () => {
    const { user, role } = await signInWithGoogle(true);
    expect(user?.emailVerificationTime).toEqual(expect.any(Number));
    expect(role).toBe("admin");
  });
});
