import { CALLMISSED_MODELS } from "./callmissed";
import { isTtsLanguage } from "./languages";

/**
 * How read-aloud is produced for an app language.
 * - `default`: the admin-selected TTS model/voice (bulbul:v3 speaks these).
 * - `override`: a different CallMissed model; no `language` field is sent.
 * - `none`: no CallMissed TTS reads this language honestly.
 *
 * Probed 2026-10-09 against api.callmissed.com (round-tripped via STT):
 * bulbul:v3 returns 502 for Arabic-script text (ur, sd, ks) whatever the
 * language code. gpt-4o-mini-tts and sonic-3.6 read Urdu correctly; for Sindhi
 * and Kashmiri every model returned audio that was Urdu/Hindi-like or garbled.
 */
export type TtsRoute =
  | { kind: "default" }
  | { kind: "override"; model: string; voice: string }
  | { kind: "none" };

const OVERRIDES: Record<string, TtsRoute> = {
  ur: { kind: "override", model: CALLMISSED_MODELS.ttsUrdu, voice: "alloy" },
  sd: { kind: "none" },
  ks: { kind: "none" },
};

export function ttsRouteFor(code: string): TtsRoute {
  return OVERRIDES[code] ?? { kind: "default" };
}

/** Whether the UI should offer read-aloud for this language. */
export function canReadAloud(code: string): boolean {
  return isTtsLanguage(code) || ttsRouteFor(code).kind === "override";
}
