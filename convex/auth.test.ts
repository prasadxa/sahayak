import { describe, expect, it } from "vitest";
import { passwordProfile } from "./auth";

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
