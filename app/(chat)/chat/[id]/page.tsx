import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { convertToUIMessages } from "@/lib/utils";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";

import { Chat } from "@/components/chat";
import { DataStreamHandler } from "@/components/data-stream-handler";

import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

import { getCurrentUser } from "@/lib/auth";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";

export default async function ChatPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id: chatId } = params;

  // Pass the caller's token: Convex only returns private chats to their owner.
  const token = (await convexAuthNextjsToken().catch(() => undefined)) ?? undefined;
  const [user, chat] = await Promise.all([
    getCurrentUser(),
    fetchQuery(api.chats.getChatById, { chatId }, { token }),
  ]);

  if (!chat) {
    notFound();
  }

  if (chat.visibility === "private") {
    if (!user) {
      return notFound();
    }

    if (user._id !== chat.userId) {
      return notFound();
    }
  }

  const messagesFromDb = await fetchQuery(
    api.messages.getMessagesByChatId,
    { chatId },
    { token }
  );

  const cookieStore = await cookies();
  const chatModelFromCookie = cookieStore.get("chat-model");

  if (!chatModelFromCookie) {
    return (
      <>
        <Chat
          id={chat.chatId}
          initialMessages={convertToUIMessages(messagesFromDb)}
          selectedChatModel={DEFAULT_CHAT_MODEL}
          selectedVisibilityType={chat.visibility}
          isReadonly={user?._id !== chat.userId}
          isChatSelected={true}
          user={user}
          autoResume={true}
        />
        <DataStreamHandler id={chat.chatId} />
      </>
    );
  }

  return (
    <>
      <Chat
        id={chat.chatId}
        initialMessages={convertToUIMessages(messagesFromDb)}
        selectedChatModel={chatModelFromCookie.value}
        selectedVisibilityType={chat.visibility}
        isReadonly={user?._id !== chat.userId}
        isChatSelected={true}
        user={user}
        autoResume={true}
      />
      <DataStreamHandler id={chat.chatId} />
    </>
  );
}
