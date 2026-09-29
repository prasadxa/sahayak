import { tool } from "ai";
import { z } from "zod";

import { calculatePmfbyPremium as calculate, PMFBY_SEASONS } from "@/lib/pmfby";

export const PMFBY_NOTE =
  "Farmer's share only. The Central and State governments pay the remaining premium. Confirm the notified sum insured for your crop and district with your bank, CSC or pmfby.gov.in.";

/** PMFBY farmer-premium calculator. The rates live in lib/pmfby.ts. */
export const calculatePmfbyPremium = tool({
  description:
    "Calculate the farmer's PMFBY crop-insurance premium for a season and sum insured (in rupees). Use for ANY PMFBY premium question instead of doing the arithmetic yourself. Seasons: kharif (2%), rabi (1.5%), commercial_horticulture (annual commercial/horticultural crops, 5%).",
  parameters: z.object({
    season: z.enum(PMFBY_SEASONS).describe("kharif, rabi, or commercial_horticulture"),
    sumInsured: z.number().describe("Sum insured in rupees, e.g. 50000"),
  }),
  execute: async ({ season, sumInsured }) => {
    try {
      return { ...calculate({ season, sumInsured }), note: PMFBY_NOTE };
    } catch (error) {
      if (error instanceof RangeError) {
        return `Could not calculate the premium: ${error.message}.`;
      }
      throw error;
    }
  },
});
