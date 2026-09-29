"use server";

import { myProvider } from "@/lib/ai/models";
import { generateText } from "ai";
import type { UIMessage } from "ai";

import { cookies } from "next/headers";

import { fetchQuery } from "convex/nextjs";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "@/convex/_generated/api";

export async function saveChatModelAsCookie(model: string) {
  const cookieStore = await cookies();
  cookieStore.set("chat-model", model);
}

export async function getSuggestions({ documentId }: { documentId: string }) {
  // Suggestions are owner-only, so the query must run as the signed-in user.
  const token = await convexAuthNextjsToken().catch(() => undefined);
  if (!token) return [];
  const suggestions = await fetchQuery(
    api.suggestions.getSuggestionsByDocumentId,
    { documentId },
    { token }
  );
  return suggestions ?? [];
}

export async function generateTitleFromUserMessage({ message }: { message: UIMessage }) {
  const { text: title } = await generateText({
    model: myProvider.languageModel("title-model"),
    system: `\n
    - You will generate a short title based on the first message a user begins a conversation with
    - Ensure it is not more than 80 characters long
    - The title should be a summary of the user's message
    - Do not use quotes or colons`,
    prompt: JSON.stringify(message),
  });

  return title;
}
