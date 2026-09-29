import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import { asUser } from "./test.helpers";

describe("roles", () => {
  beforeEach(() => {
    process.env.ADMIN_EMAILS = "Boss@Example.com, other@example.com";
  });
  afterEach(() => {
    delete process.env.ADMIN_EMAILS;
  });

  it("resolves a verified ADMIN_EMAILS address to admin, case-insensitively", async () => {
    const t = convexTest(schema, modules);
    const { client } = await asUser(t, { email: "boss@example.com", verified: true });
    expect((await client.query(api.roles.me, {}))?.role).toBe("admin");
  });

  it("does not grant admin to an unverified account whose email is in ADMIN_EMAILS", async () => {
    const t = convexTest(schema, modules);
    const { client, userId } = await asUser(t, { email: "boss@example.com" });
    expect((await client.query(api.roles.me, {}))?.role).toBe("member");
    expect(await t.query(internal.roles.roleOf, { userId })).toBe("member");
  });

  it("still honours a stored role on an unverified account", async () => {
    const t = convexTest(schema, modules);
    const { client } = await asUser(t, { email: "kiosk.pacs01@example.com", role: "kiosk" });
    expect((await client.query(api.roles.me, {}))?.role).toBe("kiosk");
  });

  it("defaults a plain user to member", async () => {
    const t = convexTest(schema, modules);
    const { client } = await asUser(t, { email: "farmer@example.com" });
    expect((await client.query(api.roles.me, {}))?.role).toBe("member");
  });

  it("returns null from me when signed out", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.roles.me, {})).toBeNull();
  });

  it("forbids a member from assigning roles", async () => {
    const t = convexTest(schema, modules);
    const { client } = await asUser(t, { email: "farmer@example.com" });
    await asUser(t, { email: "clerk@example.com" });
    await expect(
      client.mutation(api.roles.setRole, { email: "clerk@example.com", role: "officer" })
    ).rejects.toThrow(/Forbidden/);
  });

  it("forbids an unverified ADMIN_EMAILS impostor from assigning roles", async () => {
    const t = convexTest(schema, modules);
    const impostor = await asUser(t, { email: "boss@example.com" });
    await asUser(t, { email: "clerk@example.com", verified: true });
    await expect(
      impostor.client.mutation(api.roles.setRole, { email: "clerk@example.com", role: "admin" })
    ).rejects.toThrow(/Forbidden/);
  });

  it("lets an admin promote a verified user to officer by email", async () => {
    const t = convexTest(schema, modules);
    const admin = await asUser(t, { email: "boss@example.com", verified: true });
    const clerk = await asUser(t, { email: "clerk@example.com", verified: true });
    await admin.client.mutation(api.roles.setRole, { email: "Clerk@Example.com", role: "officer" });
    expect((await clerk.client.query(api.roles.me, {}))?.role).toBe("officer");
  });

  it("refuses to make an unverified-only account an officer", async () => {
    const t = convexTest(schema, modules);
    const admin = await asUser(t, { email: "boss@example.com", verified: true });
    const clerk = await asUser(t, { email: "clerk@example.com" });
    await expect(
      admin.client.mutation(api.roles.setRole, { email: "clerk@example.com", role: "officer" })
    ).rejects.toThrow("Officers must sign in with Google first (verified email)");
    await expect(
      admin.client.mutation(api.roles.setRole, { email: "clerk@example.com", role: "admin" })
    ).rejects.toThrow(/verified email/);
    expect((await clerk.client.query(api.roles.me, {}))?.role).toBe("member");
  });

  it("promotes the verified row when a Password sign-up shares the email", async () => {
    const t = convexTest(schema, modules);
    const admin = await asUser(t, { email: "boss@example.com", verified: true });
    // Attacker registers with Password first; the real officer signs in with Google.
    const squatter = await asUser(t, { email: "clerk@example.com" });
    const real = await asUser(t, { email: "clerk@example.com", verified: true });
    const r = await admin.client.mutation(api.roles.setRole, {
      email: "clerk@example.com",
      role: "officer",
    });
    expect(r.userId).toBe(real.userId);
    expect((await real.client.query(api.roles.me, {}))?.role).toBe("officer");
    expect((await squatter.client.query(api.roles.me, {}))?.role).toBe("member");
  });

  it("refuses staff promotion when several verified rows share the email", async () => {
    const t = convexTest(schema, modules);
    const admin = await asUser(t, { email: "boss@example.com", verified: true });
    await asUser(t, { email: "clerk@example.com", verified: true });
    await asUser(t, { email: "clerk@example.com", verified: true });
    await expect(
      admin.client.mutation(api.roles.setRole, { email: "clerk@example.com", role: "officer" })
    ).rejects.toThrow(/verified accounts share/);
  });

  it("lets an admin make a single unverified Password account a kiosk", async () => {
    const t = convexTest(schema, modules);
    const admin = await asUser(t, { email: "boss@example.com", verified: true });
    const kiosk = await asUser(t, { email: "kiosk.pacs01@example.com" });
    await admin.client.mutation(api.roles.setRole, {
      email: "kiosk.pacs01@example.com",
      role: "kiosk",
    });
    expect((await kiosk.client.query(api.roles.me, {}))?.role).toBe("kiosk");
  });

  it("refuses an ambiguous kiosk or member assignment", async () => {
    const t = convexTest(schema, modules);
    const admin = await asUser(t, { email: "boss@example.com", verified: true });
    await asUser(t, { email: "kiosk.pacs01@example.com" });
    await asUser(t, { email: "kiosk.pacs01@example.com", verified: true });
    await expect(
      admin.client.mutation(api.roles.setRole, { email: "kiosk.pacs01@example.com", role: "kiosk" })
    ).rejects.toThrow(/accounts share the email/);
    await expect(
      admin.client.mutation(api.roles.setRole, {
        email: "kiosk.pacs01@example.com",
        role: "member",
      })
    ).rejects.toThrow(/accounts share the email/);
  });

  it("reports a missing user", async () => {
    const t = convexTest(schema, modules);
    const admin = await asUser(t, { email: "boss@example.com", verified: true });
    await expect(
      admin.client.mutation(api.roles.setRole, { email: "nobody@example.com", role: "officer" })
    ).rejects.toThrow(/No user with email/);
  });

  it("rejects an unknown role name", async () => {
    const t = convexTest(schema, modules);
    const admin = await asUser(t, { email: "boss@example.com", verified: true });
    await asUser(t, { email: "clerk@example.com", verified: true });
    await expect(
      admin.client.mutation(api.roles.setRole, { email: "clerk@example.com", role: "superuser" })
    ).rejects.toThrow(/Invalid role/);
  });
});

describe("roles.grantRole (internal, operator bootstrap)", () => {
  it("sets the stored role on the single matching user, even if unverified", async () => {
    const t = convexTest(schema, modules);
    const dev = await asUser(t, { email: "dev@example.com" });
    const r = await t.mutation(internal.roles.grantRole, {
      email: "Dev@Example.com",
      role: "admin",
    });
    expect(r).toEqual({ userId: dev.userId, role: "admin" });
    expect((await dev.client.query(api.roles.me, {}))?.role).toBe("admin");
  });

  it("throws when more than one user matches", async () => {
    const t = convexTest(schema, modules);
    await asUser(t, { email: "dev@example.com" });
    await asUser(t, { email: "dev@example.com", verified: true });
    await expect(
      t.mutation(internal.roles.grantRole, { email: "dev@example.com", role: "admin" })
    ).rejects.toThrow(/accounts share the email/);
  });

  it("throws for an unknown user or role", async () => {
    const t = convexTest(schema, modules);
    await asUser(t, { email: "dev@example.com" });
    await expect(
      t.mutation(internal.roles.grantRole, { email: "nobody@example.com", role: "admin" })
    ).rejects.toThrow(/No user with email/);
    await expect(
      t.mutation(internal.roles.grantRole, { email: "dev@example.com", role: "root" })
    ).rejects.toThrow(/Invalid role/);
  });
});
