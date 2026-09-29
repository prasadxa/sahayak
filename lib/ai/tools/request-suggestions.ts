import { DataStreamWriter, streamObject, tool } from "ai";
import { z } from "zod";

import { generateUUID } from "@/lib/utils";

import { myProvider } from "@/lib/ai/models";

import { fetchQuery, fetchMutation } from "convex/nextjs";
import { Doc } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";

type Suggestion = {
  originalText: string;
  suggestedText: string;
  description: string;
  isResolved: boolean;
  userId: Doc<"users">["_id"];
  documentId: string;
  suggestionId: string;
};

interface RequestSuggestionsProps {
  user: Doc<"users">;
  dataStream: DataStreamWriter;
  /** Convex Auth token of the signed-in user. */
  token: string;
}

export const requestSuggestions = ({
  user,
  dataStream,
  token,
}: RequestSuggestionsProps) =>
  tool({
    description: "Request suggestions for a document",
    parameters: z.object({
      documentId: z
        .string()
        .describe("The ID of the document to request edits"),
    }),
    execute: async ({ documentId }) => {
      const document = await fetchQuery(
        api.documents.getDocumentById,
        { documentId: documentId },
        { token },
      );

      if (!document || !document.content) {
        return {
          error: "Document not found",
        };
      }

      const suggestions: Array<Omit<Suggestion, "userId" | "createdAt">> = [];

      const { elementStream } = streamObject({
        model: myProvider.languageModel("block-model"),
        system:
          "You are a help writing assistant. Given a piece of writing, please offer suggestions to improve the piece of writing and describe the change. It is very important for the edits to contain full sentences instead of just words. Max 5 suggestions.",
        prompt: document.content,
        output: "array",
        schema: z.object({
          originalSentence: z.string().describe("The original sentence"),
          suggestedSentence: z.string().describe("The suggested sentence"),
          description: z.string().describe("The description of the suggestion"),
        }),
      });

      for await (const element of elementStream) {
        // The owner is set server-side from the token, so it is not sent to Convex.
        const suggestion = {
          originalText: element.originalSentence,
          suggestedText: element.suggestedSentence,
          description: element.description,
          isResolved: false,
          documentId: documentId,
          suggestionId: generateUUID(),
        };

        dataStream.writeData({
          type: "suggestion",
          content: { ...suggestion, userId: user._id },
        });

        suggestions.push(suggestion);
      }

      if (user) {
        await fetchMutation(
          api.suggestions.saveSuggestions,
          { suggestions },
          { token },
        );
      }

      return {
        documentId: documentId,
        title: document.title,
        kind: document.kind,
        message: "Suggestions have been added to the document",
      };
    },
  });
