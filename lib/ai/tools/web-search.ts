import { tool } from "ai";
import { z } from "zod";

import { callmissedFetch } from "@/lib/callmissed";

interface SearchResult {
  title?: string;
  url?: string;
  snippet?: string;
  published_date?: string | null;
  source?: string;
}

/**
 * Live web search via CallMissed POST /v1/search — replaces the
 * OpenAI-only `webSearchPreview` tool. Flat ₹1/search on the account.
 */
export const webSearch = tool({
  description:
    "Search the live web for current information — latest scheme notifications, dates, circulars, news. Returns titles, URLs and snippets.",
  parameters: z.object({
    query: z.string().describe("Search query"),
    numResults: z
      .number()
      .min(1)
      .max(10)
      .optional()
      .describe("Number of results (default 5)"),
  }),
  execute: async ({ query, numResults }) => {
    try {
      const res = await callmissedFetch("/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          mode: "shorter",
          num_results: numResults ?? 5,
          gl: "in",
        }),
      });
      const json = (await res.json()) as {
        results?: SearchResult[];
        answer?: string;
      };
      const results = (json.results ?? []).slice(0, numResults ?? 5);
      if (results.length === 0) return "No results found.";
      const lines = results.map(
        (r, i) =>
          `[${i + 1}] ${r.title ?? "Untitled"}\n${r.url ?? ""}\n${r.snippet ?? ""}${r.published_date ? `\nPublished: ${r.published_date}` : ""}`
      );
      return `${json.answer ? `Summary: ${json.answer}\n\n` : ""}${lines.join("\n\n")}`;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return `Web search failed: ${msg}`;
    }
  },
});
