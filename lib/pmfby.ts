/**
 * PMFBY farmer premium share (Pradhan Mantri Fasal Bima Yojana).
 * Farmers pay a fixed share of the sum insured; the Centre and State pay the
 * rest of the actuarial premium. Source: https://pmfby.gov.in
 */
export const PMFBY_SEASONS = ["kharif", "rabi", "commercial_horticulture"] as const;
export type PmfbySeason = (typeof PMFBY_SEASONS)[number];

const FARMER_RATE_PCT: Record<PmfbySeason, number> = {
  kharif: 2,
  rabi: 1.5,
  commercial_horticulture: 5,
};

export interface PmfbyPremium {
  season: PmfbySeason;
  sumInsured: number;
  farmerRatePct: number;
  farmerPremium: number;
}

export function calculatePmfbyPremium(input: {
  season: PmfbySeason;
  sumInsured: number;
}): PmfbyPremium {
  const { season, sumInsured } = input;
  if (!Number.isFinite(sumInsured) || sumInsured <= 0) {
    throw new RangeError("sumInsured must be a positive number of rupees");
  }
  const farmerRatePct = FARMER_RATE_PCT[season];
  return {
    season,
    sumInsured,
    farmerRatePct,
    farmerPremium: Math.round((sumInsured * farmerRatePct) / 100),
  };
}
