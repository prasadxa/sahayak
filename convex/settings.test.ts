import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import { asUser } from "./test.helpers";
import { CALLMISSED_MODELS } from "@/lib/callmissed";

/** transcribe/synthesize/searchKnowledgeBase consume rate-limit buckets. */
function testConvex() {
  const t = convexTest(schema, modules);
  registerRateLimiter(t);
  return t;
}

type Captured = { url: string; body: unknown };

/** Mock the CallMissed HTTP endpoints the voice/kb actions call. */
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
      if (url.endsWith("/embeddings")) {
        return Response.json({
          object: "list",
          data: [{ object: "embedding", index: 0, embedding: Array<number>(1536).fill(0.01) }],
          model: "text-embedding-3-small",
          usage: { prompt_tokens: 1, total_tokens: 1 },
        });
      }
      return new Response("not found", { status: 404 });
    })
  );
}

/** Store an audio clip and record its content type like the upload endpoint does. */
async function storeAudio(t: ReturnType<typeof convexTest>) {
  const storageId = await t.run((ctx) =>
    ctx.storage.store(new Blob([new Uint8Array([9])], { type: "audio/webm" }))
  );
  await t.run(async (ctx) => {
    await (ctx.db as unknown as { patch: (id: unknown, v: object) => Promise<void> }).patch(
      storageId,
      { contentType: "audio/webm" }
    );
  });
  return storageId;
}

describe("model settings access", () => {
  it("rejects setModel from anyone who is not an admin", async () => {
    const t = testConvex();
    const member = await asUser(t, { email: "farmer@example.com" });
    const officer = await asUser(t, { email: "clerk@example.com", role: "officer" });
    const kiosk = await asUser(t, { email: "kiosk@example.com", role: "kiosk" });
    const args = { function: "stt", provider: "callmissed", model: "saaras:v4" };

    await expect(member.client.mutation(api.settings.setModel, args)).rejects.toThrow(/Forbidden/);
    await expect(officer.client.mutation(api.settings.setModel, args)).rejects.toThrow(/Forbidden/);
    await expect(kiosk.client.mutation(api.settings.setModel, args)).rejects.toThrow(/Forbidden/);
    await expect(t.mutation(api.settings.setModel, args)).rejects.toThrow(/Not authenticated/);
  });

  it("rejects listModels from anyone who is not an admin", async () => {
    const t = testConvex();
    const member = await asUser(t, { email: "farmer@example.com" });
    const officer = await asUser(t, { email: "clerk@example.com", role: "officer" });

    await expect(member.client.query(api.settings.listModels, {})).rejects.toThrow(/Forbidden/);
    await expect(officer.client.query(api.settings.listModels, {})).rejects.toThrow(/Forbidden/);
    await expect(t.query(api.settings.listModels, {})).rejects.toThrow(/Not authenticated/);
  });

  it("requires sign-in to read the effective model", async () => {
    const t = testConvex();
    await expect(
      t.query(api.settings.effectiveModel, { function: "stt" })
    ).rejects.toThrow(/Not authenticated/);
  });
});

describe("model settings", () => {
  it("returns catalog defaults when nothing is stored", async () => {
    const t = testConvex();
    const { client } = await asUser(t, { email: "boss@example.com", role: "admin" });

    const rows = await client.query(api.settings.listModels, {});
    const byFn = Object.fromEntries(rows.map((r) => [r.function, r]));
    expect(byFn.stt).toMatchObject({
      provider: "callmissed",
      model: CALLMISSED_MODELS.stt,
      overridden: false,
    });
    expect(byFn.tts.model).toBe(CALLMISSED_MODELS.tts);
    expect(byFn.ttsVoice.model).toBe(CALLMISSED_MODELS.ttsVoice);
    expect(byFn.chatSmall.model).toBe(CALLMISSED_MODELS.chatSmall);
  });

  it("lets an admin set, read and reset a selection", async () => {
    const t = testConvex();
    const { client } = await asUser(t, { email: "boss@example.com", role: "admin" });

    await client.mutation(api.settings.setModel, {
      function: "stt",
      provider: "callmissed",
      model: "saaras:v4",
    });

    const effective = await client.query(api.settings.effectiveModel, { function: "stt" });
    expect(effective).toEqual({ provider: "callmissed", model: "saaras:v4" });

    const rows = await client.query(api.settings.listModels, {});
    const stt = rows.find((r) => r.function === "stt");
    expect(stt).toMatchObject({ model: "saaras:v4", overridden: true });

    await client.mutation(api.settings.resetModel, { function: "stt" });
    expect(await client.query(api.settings.effectiveModel, { function: "stt" })).toEqual({
      provider: "callmissed",
      model: CALLMISSED_MODELS.stt,
    });
  });

  it("rejects an unknown function", async () => {
    const t = testConvex();
    const { client } = await asUser(t, { email: "boss@example.com", role: "admin" });
    await expect(
      client.mutation(api.settings.setModel, {
        function: "embedding",
        provider: "callmissed",
        model: "text-embedding-3-large",
      })
    ).rejects.toThrow(/Unknown model function/);
    await expect(
      client.query(api.settings.effectiveModel, { function: "wat" })
    ).rejects.toThrow(/Unknown model function/);
  });

  it("rejects a model that is not in the function's catalog", async () => {
    const t = testConvex();
    const { client } = await asUser(t, { email: "boss@example.com", role: "admin" });
    await expect(
      client.mutation(api.settings.setModel, {
        function: "stt",
        provider: "callmissed",
        model: "bulbul:v3",
      })
    ).rejects.toThrow(/not in the catalog/);
    await expect(
      client.mutation(api.settings.setModel, {
        function: "chatSmall",
        provider: "openai",
        model: "gpt-4o",
      })
    ).rejects.toThrow(/not in the catalog/);
  });
});

describe("voice reads the stored selection", () => {
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

  it("transcribe and synthesize send the stored models and voice", async () => {
    const t = testConvex();
    const admin = await asUser(t, { email: "boss@example.com", role: "admin" });
    await admin.client.mutation(api.settings.setModel, {
      function: "stt",
      provider: "callmissed",
      model: "saaras:v4",
    });
    await admin.client.mutation(api.settings.setModel, {
      function: "tts",
      provider: "callmissed",
      model: "bulbul:v3",
    });
    await admin.client.mutation(api.settings.setModel, {
      function: "ttsVoice",
      provider: "callmissed",
      model: "kavya",
    });

    const { client } = await asUser(t, { email: "farmer@example.com" });
    const storageId = await storeAudio(t);
    await client.action(api.voice.transcribe, { storageId, language: "hi" });
    const form = captured.find((c) => c.url.endsWith("/audio/transcriptions"))?.body as FormData;
    expect(form.get("model")).toBe("saaras:v4");

    await client.action(api.voice.synthesize, { text: "नमस्ते", language: "hi" });
    const body = JSON.parse(
      String(captured.find((c) => c.url.endsWith("/audio/speech"))?.body)
    );
    expect(body.model).toBe("bulbul:v3");
    expect(body.voice).toBe("kavya");
  });

  it("falls back to the catalog defaults when nothing is stored", async () => {
    const t = testConvex();
    const { client } = await asUser(t, { email: "farmer@example.com" });

    const storageId = await storeAudio(t);
    await client.action(api.voice.transcribe, { storageId });
    const form = captured.find((c) => c.url.endsWith("/audio/transcriptions"))?.body as FormData;
    expect(form.get("model")).toBe(CALLMISSED_MODELS.stt);

    await client.action(api.voice.synthesize, { text: "hello" });
    const body = JSON.parse(
      String(captured.find((c) => c.url.endsWith("/audio/speech"))?.body)
    );
    expect(body.model).toBe(CALLMISSED_MODELS.tts);
    expect(body.voice).toBe(CALLMISSED_MODELS.ttsVoice);
  });

  it("an explicit voice argument still wins over the stored voice", async () => {
    const t = testConvex();
    const admin = await asUser(t, { email: "boss@example.com", role: "admin" });
    await admin.client.mutation(api.settings.setModel, {
      function: "ttsVoice",
      provider: "callmissed",
      model: "kavya",
    });
    const { client } = await asUser(t, { email: "farmer@example.com" });

    await client.action(api.voice.synthesize, { text: "hi", voice: "rohan" });
    const body = JSON.parse(
      String(captured.find((c) => c.url.endsWith("/audio/speech"))?.body)
    );
    expect(body.voice).toBe("rohan");
  });
});

describe("kb stays on the fixed embedding model", () => {
  beforeEach(() => {
    process.env.CALLMISSED_API_KEY = "cm_test";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.CALLMISSED_API_KEY;
  });

  it("searchKnowledgeBase embeds with text-embedding-3-small even with other overrides stored", async () => {
    const t = testConvex();
    const captured: Captured[] = [];
    mockCallmissed(captured);

    const admin = await asUser(t, { email: "boss@example.com", role: "admin" });
    await admin.client.mutation(api.settings.setModel, {
      function: "chatSmall",
      provider: "callmissed",
      model: "glm-4.7-flash",
    });

    await t.mutation(internal.kb.insertChunks, {
      entryId: "kcc",
      title: "KCC basics",
      category: "finance",
      chunks: [{ content: "Kisan Credit Card short-term crop loans." }],
    });

    const { client } = await asUser(t, { email: "farmer@example.com" });
    await client.action(api.kb.searchKnowledgeBase, { query: "crop loan" });

    const embedCall = captured.find((c) => c.url.endsWith("/embeddings"));
    const body = JSON.parse(String(embedCall?.body));
    expect(body.model).toBe("text-embedding-3-small");
  });
});
