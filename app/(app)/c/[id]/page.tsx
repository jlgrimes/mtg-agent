import { auth } from "@clerk/nextjs/server";
import type { EveMessage } from "eve/react";
import { notFound } from "next/navigation";
import { ChatExperience } from "@/app/_components/chat-experience";
import { getChat, getChatMessages } from "@/lib/chats";

// A single chat, server-rendered: load its cursor + stored messages so the
// conversation paints immediately (no client fetch waterfall) and the URL is
// shareable/refreshable.
export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) notFound();

  const { id } = await params;
  const chat = await getChat(userId, id);
  if (!chat) notFound();

  const messages = (await getChatMessages(userId, id)) as EveMessage[];
  return (
    <ChatExperience
      key={chat.id}
      id={chat.id}
      initialDeck={chat.deck}
      initialMessages={messages}
      initialSession={{
        sessionId: chat.sessionId,
        continuationToken: chat.continuationToken,
        streamIndex: chat.streamIndex ?? 0,
      }}
    />
  );
}
