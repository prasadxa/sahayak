import { describe, expect, it } from "vitest";
import { calculatePmfbyPremium } from "./pmfby-premium";

const opts = { toolCallId: "t1", messages: [] };

describe("calculatePmfbyPremium tool", () => {
  it("returns the farmer premium plus the government-share note", async () => {
    const r = await calculatePmfbyPremium.execute!(
      { season: "rabi", sumInsured: 50000 },
      opts
    );
    expect(r).toMatchObject({
      season: "rabi",
      sumInsured: 50000,
      farmerRatePct: 1.5,
      farmerPremium: 750,
    });
    expect((r as { note: string }).note).toMatch(/^Farmer's share only\./);
  });

  it("returns an error string for an invalid sum insured", async () => {
    const r = await calculatePmfbyPremium.execute!(
      { season: "kharif", sumInsured: -5 },
      opts
    );
    expect(typeof r).toBe("string");
    expect(r as string).toMatch(/sumInsured/);
  });
});
