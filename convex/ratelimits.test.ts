import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { testConvex } from "./test.setup";
import { asUser } from "./test.helpers";

type Client = Awaited<ReturnType<typeof asUser>>["client"];

/** Drain a bucket until `consumeChatMessage` returns ok:false. */
async function drainChat(client: Client) {
  let last: { ok: boolean; retryAfter: number } = { ok: true, retryAfter: 0 };
  for (let i = 0; i < 200 && last.ok; i++) {
    last = await client.mutation(api.ratelimits.consumeChatMessage, {});
  }
  return last;
}

describe("ratelimits.consumeChatMessage", () => {
  it("rejects anonymous callers without consuming", async () => {
    const t = testConvex();
    await expect(t.mutation(api.ratelimits.consumeChatMessage, {})).rejects.toThrow(
      /Not authenticated/
    );
  });

  it("lets a member send up to the bucket size, then refuses", async () => {
    const t = testConvex();
    const { client } = await asUser(t, { email: "farmer@example.com" });
    for (let i = 0; i < 20; i++) {
      const r = await client.mutation(api.ratelimits.consumeChatMessage, {});
      expect(r.ok).toBe(true);
    }
    const blocked = await client.mutation(api.ratelimits.consumeChatMessage, {});
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("tracks buckets independently per user", async () => {
    const t = testConvex();
    const first = await asUser(t, { email: "one@example.com" });
    const second = await asUser(t, { email: "two@example.com" });
    const blocked = await drainChat(first.client);
    expect(blocked.ok).toBe(false);
    const r = await second.client.mutation(api.ratelimits.consumeChatMessage, {});
    expect(r.ok).toBe(true);
  });

  it("gives a kiosk account a wider bucket than a member", async () => {
    const t = testConvex();
    const kiosk = await asUser(t, { email: "kiosk@example.com", role: "kiosk" });
    for (let i = 0; i < 20; i++) {
      await kiosk.client.mutation(api.ratelimits.consumeChatMessage, {});
    }
    // A member is already blocked at 21; the shared kiosk terminal is not.
    const r = await kiosk.client.mutation(api.ratelimits.consumeChatMessage, {});
    expect(r.ok).toBe(true);
  });
});

describe("write-path buckets", () => {
  const sample = {
    category: "loan_credit",
    subject: "Loan pending",
    description: "Loan not sanctioned",
  };

  it("blocks grievance filing once the member bucket drains", async () => {
    const t = testConvex();
    const { client } = await asUser(t, { email: "farmer@example.com" });
    for (let i = 0; i < 10; i++) {
      await client.mutation(api.grievances.file, sample);
    }
    await expect(client.mutation(api.grievances.file, sample)).rejects.toThrow(
      /Rate limit exceeded/
    );
  });

  it("gives a kiosk account a wider grievance bucket", async () => {
    const t = testConvex();
    const kiosk = await asUser(t, { email: "kiosk@example.com", role: "kiosk" });
    // A member is already blocked at 11; the shared kiosk terminal is not.
    for (let i = 0; i < 20; i++) {
      await kiosk.client.mutation(api.grievances.file, sample);
    }
  });

  it("blocks attachment URL minting once the storage bucket drains", async () => {
    const t = testConvex();
    const { client } = await asUser(t, { email: "farmer@example.com" });
    for (let i = 0; i < 30; i++) {
      await client.mutation(api.files.generateAttachmentUrl, { contentType: "image/png" });
    }
    await expect(
      client.mutation(api.files.generateAttachmentUrl, { contentType: "image/png" })
    ).rejects.toThrow(/Rate limit exceeded/);
  });
});
