import { describe, expect, it } from "vitest";
import { STRINGS, translate } from "./i18n";
import { TTS_LANGUAGES } from "./languages";

const REQUIRED_KEYS = [
  "greeting",
  "greetingNamed",
  "askMe",
  "askHint",
  "inputPlaceholder",
  ...["laws", "schemes", "pmfby", "finance", "grievance", "services"].flatMap((s) => [
    `suggest.${s}.title`,
    `suggest.${s}.prompt`,
  ]),
  "recording",
  "transcribing",
  "micDenied",
  "transcribeFailed",
  "noSpeech",
  "readAloud",
  "stop",
  "ttsUnavailable",
  "nav.grievances",
  "nav.knowledge",
  "nav.dashboard",
  "nav.track",
  "grievances.title",
  "grievances.empty",
  "track.title",
  "track.subtitle",
  "track.placeholder",
  "track.button",
  "track.notFound",
  "status.submitted",
  "status.in_review",
  "status.resolved",
  "status.rejected",
  "pmfby.note",
];

describe("i18n dictionary", () => {
  it("English has every required key", () => {
    for (const key of REQUIRED_KEYS) expect(STRINGS.en[key], key).toBeTruthy();
  });

  it.each(TTS_LANGUAGES)(
    "%s has a non-empty translation for every English key",
    (lang) => {
      const dict = STRINGS[lang];
      expect(dict, lang).toBeDefined();
      const missing = Object.keys(STRINGS.en).filter((k) => !dict[k]?.trim());
      expect(missing).toEqual([]);
    }
  );

  it.each(TTS_LANGUAGES)("%s keeps the {name} placeholder", (lang) => {
    expect(STRINGS[lang].greetingNamed).toContain("{name}");
  });

  it("translates with variables and falls back to English", () => {
    expect(translate("hi", "greetingNamed", { name: "Asha" })).toContain("Asha");
    expect(translate("ur", "readAloud")).toBe(STRINGS.en.readAloud);
    expect(translate("hi", "no.such.key")).toBe("no.such.key");
  });
});

describe("pmfby.note", () => {
  it("English matches the note the PMFBY tool gives the model", async () => {
    const { PMFBY_NOTE } = await import("./ai/tools/pmfby-premium");
    expect(STRINGS.en["pmfby.note"]).toBe(PMFBY_NOTE);
  });
});
