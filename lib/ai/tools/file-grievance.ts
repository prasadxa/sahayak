import { tool } from "ai";
import { z } from "zod";

import { api } from "@/convex/_generated/api";
import { fetchMutation } from "convex/nextjs";
import { GRIEVANCE_CATEGORIES } from "@/lib/constants";

/**
 * @param token    Convex auth token of the signed-in user (or kiosk account).
 * @param language UI language code, stored on the grievance for analytics.
 */
export const fileGrievance = (token: string | null, language: string) =>
  tool({
    description:
      "File a cooperative grievance on behalf of the user when they want to lodge a complaint. " +
      "Before calling this tool, collect ALL of the following, asking for missing details one or two at a time: " +
      "(1) category, (2) a one-line subject, (3) a clear description of what happened, when and with whom, " +
      "(4) a contact phone number for follow-up (this is important at a kiosk, where the citizen has no account; ask for it explicitly), " +
      "and (5) the district and the name of the cooperative society concerned. " +
      "Confirm the details back to the user briefly, then file. After filing, tell the user their reference ID " +
      "and that they can track it at /track.",
    parameters: z.object({
      category: z.enum(GRIEVANCE_CATEGORIES).describe("Grievance category"),
      subject: z.string().describe("One-line subject of the grievance"),
      description: z
        .string()
        .describe("Full description: what happened, when, which society/office, any amounts or dates"),
      contact: z
        .string()
        .optional()
        .describe("Contact phone number (or email) for follow-up. Always ask for it."),
      district: z.string().optional().describe("District where the society is located"),
      societyName: z
        .string()
        .optional()
        .describe("Name of the cooperative society (e.g. the PACS) the grievance is about"),
    }),
    execute: async ({ category, subject, description, contact, district, societyName }) => {
      if (!token) {
        return "Please sign in to file a grievance — authentication is required.";
      }
      try {
        const result = await fetchMutation(
          api.grievances.file,
          { category, subject, description, contact, district, societyName, language },
          { token }
        );
        return {
          filed: true,
          refId: result.refId,
          message: `Grievance filed. Reference ID: ${result.refId}. Track it at /track?ref=${result.refId} or in the Grievances section.`,
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return `Failed to file grievance: ${msg}`;
      }
    },
  });
