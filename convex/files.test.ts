import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import { asUser } from "./test.helpers";

const MB = 1024 * 1024;

/** A base64 string that decodes to exactly `bytes` bytes. */
function base64OfSize(bytes: number): string {
  const full = Math.floor(bytes / 3) * 4;
  const rest = bytes % 3;
  return "A".repeat(full) + (rest === 0 ? "" : rest === 1 ? "AA==" : "AAA=");
}

describe("files.storeAiImage size cap", () => {
  it("rejects a payload that decodes to more than 5 MB, before storing anything", async () => {
    const t = convexTest(schema, modules);
    const { client } = await asUser(t, { email: "alice@example.com" });
    await expect(
      client.action(api.files.storeAiImage, {
        base64Image: `data:image/png;base64,${base64OfSize(5 * MB + 1)}`,
      })
    ).rejects.toThrow("Image too large");
    expect(await t.run((ctx) => ctx.db.system.query("_storage").collect())).toEqual([]);
  });

  it("stores a payload of exactly 5 MB", async () => {
    const t = convexTest(schema, modules);
    const { client } = await asUser(t, { email: "alice@example.com" });
    const { storageId } = await client.action(api.files.storeAiImage, {
      base64Image: base64OfSize(5 * MB),
    });
    const meta = await t.run((ctx) => ctx.db.system.get(storageId));
    expect(meta?.size).toBe(5 * MB);
  });
});
