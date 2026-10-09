import { createOpenAI } from "@ai-sdk/openai";

/**
 * CallMissed OpenAI-compatible gateway.
 * Docs: https://docs.callmissed.com/docs/quickstart
 *
 * One `cm_` API key covers chat completions, embeddings, STT, TTS and web
 * search. This module is isomorphic — it runs inside Next.js route handlers
 * and Convex actions (both expose `process.env`).
 */

export const CALLMISSED_BASE_URL =
  process.env.CALLMISSED_BASE_URL ?? "https://api.callmissed.com/v1";

/** Model ids on the CallMissed catalogue (https://docs.callmissed.com/docs/models). */
export const CALLMISSED_MODELS = {
  // Free-tier Indic LLM tuned for conversation + tool calling.
  chatSmall: process.env.CALLMISSED_MODEL_SMALL ?? "sarvam-105b-conversations",
  chatLarge: process.env.CALLMISSED_MODEL_LARGE ?? "sarvam-105b",
  reasoning: process.env.CALLMISSED_MODEL_REASONING ?? "kimi-k2.6",
  title: process.env.CALLMISSED_MODEL_TITLE ?? "glm-4.7-flash",
  block: process.env.CALLMISSED_MODEL_BLOCK ?? "sarvam-105b-conversations",
  // 1536-dim, matches the `memories`/`kb_entries` vector indexes.
  // Served at 3072 dims natively, so it is always requested with
  // `dimensions: EMBEDDING_DIMENSIONS`. (-3-small was returning 502 on 2026-10-09.)
  embedding: process.env.CALLMISSED_MODEL_EMBEDDING ?? "text-embedding-3-large",
  // Tried when `embedding` errors.
  embeddingFallback:
    process.env.CALLMISSED_MODEL_EMBEDDING_FALLBACK ?? "text-embedding-3-small",
  stt: process.env.CALLMISSED_MODEL_STT ?? "saaras:v3",
  tts: process.env.CALLMISSED_MODEL_TTS ?? "bulbul:v3",
  ttsVoice: process.env.CALLMISSED_TTS_VOICE ?? "shubh",
  // bulbul:v3 502s on Arabic-script text; Urdu is read by this model instead.
  ttsUrdu: process.env.CALLMISSED_MODEL_TTS_URDU ?? "gpt-4o-mini-tts",
  imageSmall: process.env.CALLMISSED_IMAGE_SMALL ?? "sdxl-lightning",
  imageLarge: process.env.CALLMISSED_IMAGE_LARGE ?? "flux-2-klein-9b",
} as const;

/** Must match the vector index dimensions in convex/schema.ts. */
export const EMBEDDING_DIMENSIONS = 1536;

let _provider: ReturnType<typeof createOpenAI> | null = null;

/** Lazily-created OpenAI-compatible provider pointed at CallMissed. */
export function callmissed() {
  if (!_provider) {
    _provider = createOpenAI({
      name: "callmissed",
      baseURL: CALLMISSED_BASE_URL,
      apiKey: process.env.CALLMISSED_API_KEY ?? "",
    });
  }
  return _provider;
}

export function callmissedApiKey(): string {
  const key = process.env.CALLMISSED_API_KEY;
  if (!key) {
    throw new Error("CALLMISSED_API_KEY is not configured");
  }
  return key;
}

/** fetch() against the CallMissed API with auth + error envelope handling. */
export async function callmissedFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${callmissedApiKey()}`);
  const res = await fetch(`${CALLMISSED_BASE_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `CallMissed ${path} failed (${res.status}): ${body.slice(0, 400)}`
    );
  }
  return res;
}
