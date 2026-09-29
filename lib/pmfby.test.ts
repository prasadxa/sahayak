import { describe, expect, it } from "vitest";
import { calculatePmfbyPremium } from "./pmfby";

describe("calculatePmfbyPremium", () => {
  it("charges the farmer 2% of sum insured for kharif crops", () => {
    const r = calculatePmfbyPremium({ season: "kharif", sumInsured: 100000 });
    expect(r.farmerRatePct).toBe(2);
    expect(r.farmerPremium).toBe(2000);
  });

  it("charges 1.5% for rabi crops", () => {
    expect(calculatePmfbyPremium({ season: "rabi", sumInsured: 50000 }).farmerPremium).toBe(750);
  });

  it("charges 5% for annual commercial/horticultural crops", () => {
    expect(
      calculatePmfbyPremium({ season: "commercial_horticulture", sumInsured: 100000 }).farmerPremium
    ).toBe(5000);
  });

  it("rounds the premium to whole rupees", () => {
    expect(calculatePmfbyPremium({ season: "rabi", sumInsured: 33333 }).farmerPremium).toBe(500);
  });

  it("rejects a zero, negative or non-finite sum insured", () => {
    expect(() => calculatePmfbyPremium({ season: "kharif", sumInsured: 0 })).toThrow(RangeError);
    expect(() => calculatePmfbyPremium({ season: "kharif", sumInsured: -5 })).toThrow(RangeError);
    expect(() => calculatePmfbyPremium({ season: "kharif", sumInsured: Number.NaN })).toThrow(RangeError);
  });
});
