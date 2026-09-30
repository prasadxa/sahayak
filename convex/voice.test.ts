import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import { asUser } from "./test.helpers";

/** transcribe/synthesize consume a rate-limit bucket — register the component. */
function testConvex() {
  const t = convexTest(schema, modules);
  registerRateLimiter(t);
  return t;
}

type Captured = { url: string; body: unknown };

function mockCallmissed(captured: Captured[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      captured.push({ url, body: init?.body });
      if (url.endsWith("/audio/speech")) {
        return new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { "Content-Type": "audio/mpeg" },
        });
      }
      if (url.endsWith("/audio/transcriptions")) {
        return Response.json({ text: "नमस्ते" });
      }
      return new Response("not found", { status: 404 });
    })
  );
}

/**
 * Store a file with `contentType` in its system metadata, as the real upload
 * endpoint records it from the Content-Type header (convex-test doesn't).
 */
async function storeFile(t: ReturnType<typeof convexTest>, body: BlobPart, contentType?: string) {
  const storageId = await t.run((ctx) => ctx.storage.store(new Blob([body], { type: contentType })));
  if (contentType) {
    await t.run(async (ctx) => {
      await (ctx.db as unknown as { patch: (id: unknown, v: object) => Promise<void> }).patch(
        storageId,
        { contentType }
      );
    });
  }
  return storageId;
}

describe("voice", () => {
  let captured: Captured[];

  beforeEach(() => {
    process.env.CALLMISSED_API_KEY = "cm_test";
    captured = [];
    mockCallmissed(captured);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.CALLMISSED_API_KEY;
  });

  it("synthesize sends language and target_language_code as BCP-47 and records the clip", async () => {
    const t = testConvex();
    const { client } = await asUser(t, { email: "farmer@example.com" });

    const { url } = await client.action(api.voice.synthesize, {
      text: "नमस्ते",
      language: "hi",
    });

    expect(url).toBeTruthy();
    const call = captured.find((c) => c.url.endsWith("/audio/speech"));
    const body = JSON.parse(String(call?.body));
    expect(body.language).toBe("hi-IN");
    expect(body.target_language_code).toBe("hi-IN");

    const rows = await t.run((ctx) => ctx.db.query("tts_audio").collect());
    expect(rows).toHaveLength(1);
  });

  it("synthesize omits the language fields when no language is given", async () => {
    const t = testConvex();
    const { client } = await asUser(t, { email: "farmer@example.com" });

    await client.action(api.voice.synthesize, { text: "Hello" });

    const body = JSON.parse(String(captured[0]?.body));
    expect(body.language).toBeUndefined();
    expect(body.target_language_code).toBeUndefined();
  });

  it("synthesize requires sign-in", async () => {
    const t = testConvex();
    await expect(t.action(api.voice.synthesize, { text: "x" })).rejects.toThrow(
      /Not authenticated/
    );
  });

  it("transcribe sends BCP-47 language and deletes the uploaded clip", async () => {
    const t = testConvex();
    const { client } = await asUser(t, { email: "farmer@example.com" });
    const storageId = await storeFile(t, new Uint8Array([9]), "audio/webm;codecs=opus");

    const { text } = await client.action(api.voice.transcribe, {
      storageId,
      language: "mr",
    });

    expect(text).toBe("नमस्ते");
    const form = captured.find((c) => c.url.endsWith("/audio/transcriptions"))
      ?.body as FormData;
    expect(form.get("language")).toBe("mr-IN");
    expect(await t.run((ctx) => ctx.storage.getUrl(storageId))).toBeNull();
  });

  it("transcribe omits the language for English so STT auto-detects", async () => {
    const t = testConvex();
    const { client } = await asUser(t, { email: "farmer@example.com" });
    const storageId = await storeFile(t, new Uint8Array([9]), "audio/webm;codecs=opus");

    await client.action(api.voice.transcribe, { storageId, language: "en" });

    const form = captured[0]?.body as FormData;
    expect(form.get("language")).toBeNull();
  });

  it("transcribe refuses a non-audio file without transcribing or deleting it", async () => {
    const t = testConvex();
    const { client } = await asUser(t, { email: "farmer@example.com" });
    // e.g. someone else's avatar or a KB upload
    const storageId = await storeFile(t, new Uint8Array([137, 80, 78, 71]), "image/png");

    await expect(client.action(api.voice.transcribe, { storageId })).rejects.toThrow(
      /Not an audio file/
    );
    expect(captured).toHaveLength(0);
    expect(await t.run((ctx) => ctx.storage.getUrl(storageId))).not.toBeNull();
  });

  it("transcribe refuses a file with no recorded content type", async () => {
    const t = testConvex();
    const { client } = await asUser(t, { email: "farmer@example.com" });
    const storageId = await storeFile(t, "plain bytes");

    await expect(client.action(api.voice.transcribe, { storageId })).rejects.toThrow(
      /Not an audio file/
    );
    expect(captured).toHaveLength(0);
    expect(await t.run((ctx) => ctx.storage.getUrl(storageId))).not.toBeNull();
  });

  it("transcribe requires sign-in", async () => {
    const t = testConvex();
    const storageId = await storeFile(t, new Uint8Array([9]), "audio/webm");
    await expect(t.action(api.voice.transcribe, { storageId })).rejects.toThrow(
      /Not authenticated/
    );
    expect(await t.run((ctx) => ctx.storage.getUrl(storageId))).not.toBeNull();
  });
});

describe("tts audio cleanup", () => {
  it("deletes clips older than 6 hours along with their files, keeping recent ones", async () => {
    const t = testConvex();
    const now = Date.now();
    const [oldId, newId] = await t.run(async (ctx) => {
      const oldStorage = await ctx.storage.store(new Blob(["old"]));
      const newStorage = await ctx.storage.store(new Blob(["new"]));
      await ctx.db.insert("tts_audio", {
        storageId: oldStorage,
        createdAt: now - 7 * 60 * 60 * 1000,
      });
      await ctx.db.insert("tts_audio", {
        storageId: newStorage,
        createdAt: now - 60 * 60 * 1000,
      });
      return [oldStorage, newStorage];
    });

    const result = await t.mutation(internal.voice.cleanupOldAudio, {});

    expect(result.deleted).toBe(1);
    const rows = await t.run((ctx) => ctx.db.query("tts_audio").collect());
    expect(rows.map((r) => r.storageId)).toEqual([newId]);
    expect(await t.run((ctx) => ctx.storage.getUrl(oldId))).toBeNull();
    expect(await t.run((ctx) => ctx.storage.getUrl(newId))).not.toBeNull();
  });

  it("works in batches of 100 and reschedules itself for the rest", async () => {
    vi.useFakeTimers();
    try {
      const t = testConvex();
      const old = Date.now() - 7 * 60 * 60 * 1000;
      await t.run(async (ctx) => {
        for (let i = 0; i < 130; i++) {
          const storageId = await ctx.storage.store(new Blob([String(i)]));
          await ctx.db.insert("tts_audio", { storageId, createdAt: old + i });
        }
      });

      const first = await t.mutation(internal.voice.cleanupOldAudio, {});
      expect(first.deleted).toBe(100);

      await t.finishAllScheduledFunctions(vi.runAllTimers);
      const rows = await t.run((ctx) => ctx.db.query("tts_audio").collect());
      expect(rows).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
