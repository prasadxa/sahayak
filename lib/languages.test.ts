import { describe, expect, it } from "vitest";
import { isTtsLanguage, toBcp47, TTS_LANGUAGES } from "./languages";

describe("language helpers", () => {
  it("maps short codes to Indian BCP-47 tags", () => {
    expect(toBcp47("mr")).toBe("mr-IN");
    expect(toBcp47("en")).toBe("en-IN");
  });

  it("lists exactly the 11 bulbul TTS languages", () => {
    expect([...TTS_LANGUAGES].sort()).toEqual(
      ["bn", "en", "gu", "hi", "kn", "ml", "mr", "or", "pa", "ta", "te"]
    );
  });

  it("reports Urdu as not TTS-capable and Hindi as capable", () => {
    expect(isTtsLanguage("ur")).toBe(false);
    expect(isTtsLanguage("hi")).toBe(true);
  });
});
