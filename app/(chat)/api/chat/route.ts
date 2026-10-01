import {
  UIMessage,
  appendResponseMessages,
  appendClientMessage,
  createDataStream,
  smoothStream,
  streamText,
} from "ai";

import { myProvider } from "@/lib/ai/models";
import { generateTitleFromUserMessage } from "@/lib/ai/utils";
import { systemPrompt } from "@/lib/ai/prompts";

import { generateUUID, getTrailingMessageId, convertToUIMessages } from "@/lib/utils";
import { DEFAULT_LANGUAGE, LANGUAGE_COOKIE, LANGUAGES } from "@/lib/languages";

import { createDocument } from "@/lib/ai/tools/create-document";
import { updateDocument } from "@/lib/ai/tools/update-document";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { addResource, getInformation } from "@/lib/ai/tools/handle-memory";
import { searchKnowledgeBase } from "@/lib/ai/tools/search-kb";
import { fileGrievance } from "@/lib/ai/tools/file-grievance";
import { calculatePmfbyPremium } from "@/lib/ai/tools/pmfby-premium";
import { webSearch } from "@/lib/ai/tools/web-search";

import { cookies } from "next/headers";

import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery, fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from "resumable-stream";
import { after } from "next/server";

export const maxDuration = 60;

// Never log message content, request bodies or other PII in this route.

let globalStreamContext: ResumableStreamContext | null = null;

function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes("REDIS_URL")) {
        console.log(" > Resumable streams are disabled due to missing REDIS_URL");
      } else {
        console.error("[api/chat] Could not create resumable stream context");
      }
    }
  }

  return globalStreamContext;
}

export async function POST(request: Request) {
  const {
    id,
    message: userMessage,
    selectedChatModel,
    data,
  }: {
    id: string;
    message: UIMessage;
    selectedChatModel: string;
    data?: { useWebSearch?: boolean };
  } = await request.json();

  const token = await convexAuthNextjsToken().catch(() => null);
  const user = token
    ? await fetchQuery(api.users.getUser, {}, { token }).catch(() => null)
    : null;

  if (!user || !token) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!userMessage || !userMessage.content) {
    return new Response("User message or message content is missing", {
      status: 400,
    });
  }

  // Per-user token bucket (wider for kiosk accounts); consume before any
  // model work. Buckets refill continuously — this only bites a script.
  const chatRate = await fetchMutation(api.ratelimits.consumeChatMessage, {}, { token });
  if (!chatRate.ok) {
    return new Response("Too many messages — please wait a moment and try again.", {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(chatRate.retryAfter / 1000)) },
    });
  }

  // Same check as RootLayout: only a known code. The raw cookie value is
  // stored on chats, grievances and kb_queries rows (and reaches the admin
  // dashboard's byLanguage counts), so an arbitrary value must not propagate.
  const cookieLang = (await cookies()).get(LANGUAGE_COOKIE)?.value;
  const language = LANGUAGES.some((l) => l.code === cookieLang)
    ? (cookieLang as string)
    : DEFAULT_LANGUAGE;
  const me = await fetchQuery(api.roles.me, {}, { token }).catch(() => null);
  const role = me?.role ?? "member";
  const isKiosk = role === "kiosk";

  // getChatById returns null for another user's private chat; saveChat then
  // refuses the duplicate id, so both cases end in 403 below.
  const chat = await fetchQuery(api.chats.getChatById, { chatId: id }, { token });
  if (chat && chat.userId !== user._id) {
    return new Response("Forbidden", { status: 403 });
  }
  if (!chat) {
    // Best effort: a title-model outage must not 500 the whole chat — fall
    // back to the start of the user's message.
    const title = await generateTitleFromUserMessage({ message: userMessage }).catch(
      () => userMessage.content.trim().slice(0, 80) || "New chat"
    );
    try {
      await fetchMutation(
        api.chats.saveChat,
        { title, chatId: id, visibility: "private", language },
        { token }
      );
    } catch {
      return new Response("Forbidden", { status: 403 });
    }
  }

  await fetchMutation(
    api.messages.saveMessages,
    {
      messages: [
        {
          messageId: userMessage.id,
          chatId: id,
          role: "user",
          parts: userMessage.parts,
          attachments: userMessage.experimental_attachments
            ?.filter((att) => att.name !== undefined && att.contentType !== undefined)
            .map((att) => ({
              ...att,
              name: att.name!,
              contentType: att.contentType!,
            })),
        },
      ],
    },
    { token }
  );

  const dbMessages = await fetchQuery(
    api.messages.getMessagesByChatId,
    { chatId: id },
    { token }
  );
  const previousMessages = convertToUIMessages(dbMessages);

  const allMessages = appendClientMessage({
    messages: previousMessages.filter((m) => m.id !== userMessage.id),
    message: userMessage,
  });

  const streamId = generateUUID();
  await fetchMutation(api.streams.createStreamId, { streamId, chatId: id }, { token });

  const useWebSearch = Boolean(data?.useWebSearch);

  const stream = createDataStream({
    execute: (dataStream) => {
      const tools = {
        createDocument: createDocument({ user, dataStream, chatId: id, token }),
        updateDocument: updateDocument({ user, dataStream, chatId: id, token }),
        requestSuggestions: requestSuggestions({ user, dataStream, token }),
        addResource: addResource(token),
        getInformation: getInformation(token),
        searchKnowledgeBase: searchKnowledgeBase(language, token),
        fileGrievance: fileGrievance(token, language),
        calculatePmfbyPremium,
        webSearch,
      };
      type ToolName = keyof typeof tools;

      // Domain tools every model gets (including the reasoning model).
      const domainTools: ToolName[] = [
        "searchKnowledgeBase",
        "fileGrievance",
        "calculatePmfbyPremium",
      ];
      const activeTools: ToolName[] = [
        ...domainTools,
        // Personal memory is per user; a kiosk account serves many citizens.
        ...(selectedChatModel === "chat-model-reasoning" || isKiosk
          ? []
          : (["addResource", "getInformation"] as ToolName[])),
        // The kiosk cannot show documents.
        ...(selectedChatModel === "chat-model-reasoning" || isKiosk
          ? []
          : (["createDocument", "updateDocument", "requestSuggestions"] as ToolName[])),
        ...(useWebSearch ? (["webSearch"] as ToolName[]) : []),
      ];

      const result = streamText({
        model: myProvider.languageModel(selectedChatModel),
        system: systemPrompt({ selectedChatModel, language, role }),
        messages: allMessages,
        maxSteps: 5,
        experimental_activeTools: activeTools,
        experimental_transform: smoothStream({ chunking: "word" }),
        experimental_generateMessageId: generateUUID,
        experimental_telemetry: { isEnabled: true, functionId: "stream-text" },
        tools,
        onFinish: async ({ response }) => {
          try {
            const assistantId = getTrailingMessageId({
              messages: response.messages.filter(
                (message) => message.role === "assistant"
              ),
            });

            if (!assistantId) {
              throw new Error("No assistant message found!");
            }

            const [, assistantMessage] = appendResponseMessages({
              messages: [userMessage],
              responseMessages: response.messages,
            });
            await fetchMutation(
              api.messages.saveMessages,
              {
                messages: [
                  {
                    messageId: assistantId,
                    chatId: id,
                    role: assistantMessage.role as "user" | "assistant",
                    parts: assistantMessage.parts as UIMessage["parts"],
                    attachments: assistantMessage.experimental_attachments
                      ?.filter(
                        (att) => att.name !== undefined && att.contentType !== undefined
                      )
                      .map((att) => ({
                        ...att,
                        name: att.name!,
                        contentType: att.contentType!,
                      })),
                  },
                ],
              },
              { token }
            );
          } catch (dbError) {
            // Only the error class: Convex validator messages can echo message content.
            console.error(
              "[api/chat] Failed to save assistant message:",
              dbError instanceof Error ? dbError.name : "unknown error"
            );
          }
        },
      });
      result.consumeStream();
      result.mergeIntoDataStream(dataStream, { sendReasoning: true });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(
        "[api/chat] Stream error:",
        error instanceof Error ? error.name : "unknown error"
      );
      return `Oops, an error occurred during streaming: ${errorMessage}`;
    },
  });

  const streamContext = getStreamContext();

  if (streamContext) {
    return new Response(await streamContext.resumableStream(streamId, () => stream));
  }
  return new Response(stream);
}

export async function GET(request: Request) {
  const streamContext = getStreamContext();

  if (!streamContext) {
    return new Response(null, { status: 204 });
  }

  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get("chatId");

  if (!chatId) {
    return new Response("id is required", { status: 400 });
  }

  const token = await convexAuthNextjsToken().catch(() => null);
  const user = token
    ? await fetchQuery(api.users.getUser, {}, { token }).catch(() => null)
    : null;

  if (!user || !token) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const chat = await fetchQuery(api.chats.getChatById, { chatId }, { token });
    if (!chat) {
      return new Response("Not found", { status: 404 });
    }

    if (chat.visibility === "private" && chat.userId !== user._id) {
      return new Response("Forbidden", { status: 403 });
    }

    const streamIds = await fetchQuery(
      api.streams.getStreamIdsByChatId,
      { chatId },
      { token }
    );

    if (!streamIds.length) {
      return new Response("No streams found", { status: 404 });
    }

    const recentStreamId = streamIds.at(-1);

    if (!recentStreamId) {
      return new Response("No recent stream found", { status: 404 });
    }

    const emptyDataStream = createDataStream({
      execute: () => {},
    });

    return new Response(
      await streamContext.resumableStream(recentStreamId, () => emptyDataStream),
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("[api/chat GET] Error:", error);
    return new Response("An error occurred while processing your request", {
      status: 500,
    });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new Response("Not Found", { status: 404 });
  }

  const token = await convexAuthNextjsToken().catch(() => null);
  const user = token
    ? await fetchQuery(api.users.getUser, {}, { token }).catch(() => null)
    : null;

  if (!user || !token) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const chat = await fetchQuery(api.chats.getChatById, { chatId: id }, { token });
    if (!chat || chat.userId !== user._id) {
      return new Response("Unauthorized", { status: 401 });
    }

    await fetchMutation(api.chats.deleteChatById, { id }, { token });
    return new Response("Chat deleted", { status: 200 });
  } catch {
    return new Response("An error occurred while processing your request", {
      status: 500,
    });
  }
}
