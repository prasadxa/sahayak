import { tool } from "ai";
import { z } from "zod";

import { api } from "@/convex/_generated/api";
import { fetchAction } from "convex/nextjs";
import { KB_CATEGORIES } from "@/lib/constants";

/**
 * Shared knowledge base for cooperative laws, schemes, PMFBY and member
 * services. The Convex action requires sign-in (each search costs an
 * embedding call and is logged), so `token` is the caller's Convex Auth JWT.
 * `language` is the caller's UI language, logged with the query for analytics.
 */
export const searchKnowledgeBase = (language: string, token: string) =>
  tool({
    description:
      "Search the cooperative-governance knowledge base (laws, by-laws, government schemes, PMFBY crop insurance, financial literacy, grievance procedures). Use proactively for any domain question before answering from general knowledge. Write the query in English or the user's language.",
    parameters: z.object({
      question: z.string().describe("The question or topic to search for"),
      category: z.enum(KB_CATEGORIES).optional().describe("Optional category filter"),
    }),
    execute: async ({ question, category }) => {
      try {
        return await fetchAction(
          api.kb.searchKnowledgeBase,
          { query: question, category, language },
          { token }
        );
      } catch {
        return "Failed to search the knowledge base.";
      }
    },
  });
