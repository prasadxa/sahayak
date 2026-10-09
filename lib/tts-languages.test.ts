import { describe, expect, it } from "vitest";
import { LANGUAGES, TTS_LANGUAGES } from "./languages";
import { canReadAloud, ttsRouteFor } from "./tts-languages";

describe("ttsRouteFor", () => {
  it("uses the configured TTS model for languages bulbul speaks", () => {
    for (const code of TTS_LANGUAGES) {
      expect(ttsRouteFor(code)).toEqual({ kind: "default" });
    }
  });

  it("routes Urdu to a model that reads Urdu script (bulbul 502s on it)", () => {
    expect(ttsRouteFor("ur")).toEqual({
      kind: "override",
      model: "gpt-4o-mini-tts",
      voice: "alloy",
    });
  });

  it("reports Sindhi and Kashmiri as having no usable TTS", () => {
    expect(ttsRouteFor("sd")).toEqual({ kind: "none" });
    expect(ttsRouteFor("ks")).toEqual({ kind: "none" });
  });

  it("canReadAloud covers bulbul languages and overrides only", () => {
    expect(canReadAloud("hi")).toBe(true);
    expect(canReadAloud("ur")).toBe(true);
    expect(canReadAloud("sd")).toBe(false);
    expect(canReadAloud("ks")).toBe(false);
  });

  it("every app language has a route", () => {
    for (const l of LANGUAGES) expect(ttsRouteFor(l.code).kind).toBeTruthy();
  });
});
