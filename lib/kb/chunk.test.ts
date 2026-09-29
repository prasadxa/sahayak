import { describe, expect, it } from "vitest";
import { chunkText } from "./chunk";

describe("chunkText", () => {
  it("returns no chunks for whitespace-only input", () => {
    expect(chunkText("   \n\t  ")).toEqual([]);
  });

  it("keeps every chunk within 1.5x the target size", () => {
    const sentence = "PACS members can apply for crop loans at the society office. ";
    const chunks = chunkText(sentence.repeat(90), 1200);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(1800);
  });

  it("hard-splits a single run-on unit with no sentence breaks", () => {
    const chunks = chunkText("a".repeat(5000), 1200);
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(1800);
  });

  it("drops fragments shorter than 20 characters", () => {
    expect(chunkText("Too short.")).toEqual([]);
  });
});
