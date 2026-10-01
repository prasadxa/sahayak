import { CALLMISSED_MODELS } from "@/lib/callmissed";
import type { ModelFunction } from "@/lib/constants";

/**
 * Provider/model catalog behind the admin "Models & voice" page
 * (/admin/models). It decides which provider and model each AI function
 * (MODEL_FUNCTIONS, lib/constants.ts) may be pointed at; the operator's
 * pick is stored in Convex `app_settings` and resolved at call time.
 *
 * CallMissed is the only provider today. To add another OpenAI-compatible
 * provider: extend MODEL_PROVIDERS + MODEL_PROVIDER_INFO, tag its catalog
 * options with the new provider id, and resolve its base URL + env-var key
 * where selections are turned into client calls. API keys always stay in
 * env vars — never in the DB or client bundles.
 */
export const MODEL_PROVIDERS = ["callmissed"] as const;
export type ModelProvider = (typeof MODEL_PROVIDERS)[number];

export const MODEL_PROVIDER_INFO: Record<
  ModelProvider,
  { name: string; apiKeyEnv: string }
> = {
  callmissed: { name: "CallMissed", apiKeyEnv: "CALLMISSED_API_KEY" },
};

export interface ModelOption {
  provider: ModelProvider;
  /** Id sent to the provider API — a model id, or a speaker id for ttsVoice. */
  id: string;
  label: string;
}

export interface ModelFunctionSpec {
  label: string;
  description: string;
  options: ModelOption[];
}

const cm = (id: string, label: string): ModelOption => ({
  provider: "callmissed",
  id,
  label,
});

/** CallMissed `bulbul:v3` speakers (docs.callmissed.com/docs/tts-voices). */
const BULBUL_V3_VOICES = [
  "shubh",
  "aditya",
  "ritu",
  "priya",
  "neha",
  "rahul",
  "pooja",
  "rohan",
  "simran",
  "kavya",
  "amit",
  "dev",
  "ishita",
  "shreya",
  "ratan",
  "varun",
  "manan",
  "sumit",
  "roopa",
  "kabir",
  "aayan",
  "ashutosh",
  "advait",
  "anand",
  "tanya",
  "tarun",
  "sunny",
  "mani",
  "gokul",
  "vijay",
  "shruti",
  "suhani",
  "mohit",
  "kavitha",
  "rehan",
  "soham",
  "rupali",
] as const;

/**
 * Selectable options per function — CallMissed free-tier ids
 * (docs.callmissed.com/docs/models). The first option is the shipped
 * default; a `CALLMISSED_MODEL_*` env var overrides it at deploy time.
 */
export const MODEL_CATALOG: Record<ModelFunction, ModelFunctionSpec> = {
  chatSmall: {
    label: "Chat · Sahayak Fast",
    description: "Backs the default chat tier for everyday questions.",
    options: [
      cm("sarvam-105b-conversations", "sarvam-105b-conversations — Indic, tool calling"),
      cm("glm-4.7-flash", "glm-4.7-flash — fast inference"),
      cm("mistral-small-3.1", "mistral-small-3.1 — 24B instruct, tool use"),
      cm("gemma-4-26b-a4b-it", "gemma-4-26b-a4b-it — instruct"),
      cm("kimi-k2.5", "kimi-k2.5 — 256K context"),
    ],
  },
  chatLarge: {
    label: "Chat · Sahayak Pro",
    description: "Backs the larger tier for detailed legal and scheme guidance.",
    options: [
      cm("sarvam-105b", "sarvam-105b — Indic flagship"),
      cm("gpt-oss-120b", "gpt-oss-120b — open-weights large model"),
      cm("glm-5.2", "glm-5.2 — agentic, tools + reasoning"),
      cm("nemotron-3-super", "nemotron-3-super — Nvidia"),
      cm("kimi-k2.6", "kimi-k2.6 — reasoning + coding"),
    ],
  },
  reasoning: {
    label: "Chat · Sahayak Reasoning",
    description: "Backs the step-by-step reasoning tier (think-tag middleware applies).",
    options: [
      cm("kimi-k2.6", "kimi-k2.6 — improved reasoning"),
      cm("kimi-k2.5", "kimi-k2.5 — reasoning"),
      cm("kimi-k2.7-code", "kimi-k2.7-code — agentic coding"),
      cm("glm-5.2", "glm-5.2 — tools + reasoning"),
      cm("sarvam-105b", "sarvam-105b — hybrid thinking mode"),
    ],
  },
  stt: {
    label: "Speech-to-text",
    description: "Transcribes the citizen's voice clip (voice.transcribe).",
    options: [
      cm("saaras:v3", "saaras:v3 — 23 Indic languages, code-mixed"),
      cm("saaras:v4", "saaras:v4 — 24 languages, five output modes"),
      cm("whisper-large-v3-turbo", "whisper-large-v3-turbo — 99 languages"),
      cm("nova-3", "nova-3 — 11 languages, diarization"),
    ],
  },
  tts: {
    label: "Text-to-speech",
    description: "Reads answers aloud (voice.synthesize).",
    options: [
      cm("bulbul:v3", "bulbul:v3 — 37 voices, 11 Indic languages"),
      cm("gnani-timbre-v2.0", "gnani-timbre-v2.0 — 73 Indic voices"),
      cm("aura-2-en", "aura-2-en — 40 English voices"),
      cm("aura-2-es", "aura-2-es — 10 Spanish voices"),
      cm("melotts", "melotts — en + fr, cheapest"),
    ],
  },
  ttsVoice: {
    label: "TTS voice",
    description: "Speaker id for bulbul:v3; other TTS models ignore it.",
    options: BULBUL_V3_VOICES.map((id) => cm(id, id)),
  },
};

/**
 * The env-resolved default for a function: the `CALLMISSED_MODEL_*` /
 * `CALLMISSED_TTS_VOICE` env var when set, else the shipped id. A missing
 * `app_settings` row resolves to this.
 */
export function defaultModelId(fn: ModelFunction): string {
  return CALLMISSED_MODELS[fn];
}

export function isCatalogChoice(
  fn: ModelFunction,
  provider: string,
  model: string
): boolean {
  return MODEL_CATALOG[fn].options.some(
    (o) => o.provider === provider && o.id === model
  );
}
