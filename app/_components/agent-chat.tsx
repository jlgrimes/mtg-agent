"use client";

import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import type { EveMessage } from "eve/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AGENT_NAME,
  AGENT_TAGLINE,
  type ChatCursor,
  ChatView,
  type PersistPayload,
} from "./chat-view";
import { ChatList, type ChatSummary } from "./chat-list";

export function AgentChat() {
  return (
    <>
      <Show when="signed-out">
        <SignInLanding />
      </Show>
      <Show when="signed-in">
        <SignedInApp />
      </Show>
    </>
  );
}

function SignedInApp() {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [initialSession, setInitialSession] = useState<ChatCursor | undefined>(undefined);
  const [initialMessages, setInitialMessages] = useState<readonly EveMessage[] | undefined>(
    undefined,
  );
  const [opening, setOpening] = useState(false);
  const [viewKey, setViewKey] = useState("new-0");

  // chatIdRef is the source of truth for persistence (create vs. update) and
  // avoids stale closures inside the ChatView onPersist callback.
  const chatIdRef = useRef<string | null>(null);
  const creatingRef = useRef(false);
  const nonceRef = useRef(0);

  const loadChats = useCallback(async () => {
    try {
      const res = await fetch("/api/chats");
      const data = await res.json();
      if (res.ok) setChats(data.chats ?? []);
    } finally {
      setLoadingChats(false);
    }
  }, []);

  useEffect(() => {
    void loadChats();
  }, [loadChats]);

  const startNewChat = useCallback(() => {
    chatIdRef.current = null;
    creatingRef.current = false;
    nonceRef.current += 1;
    setCurrentChatId(null);
    setInitialSession(undefined);
    setInitialMessages(undefined);
    setViewKey(`new-${nonceRef.current}`);
  }, []);

  const openChat = useCallback(async (id: string) => {
    setOpening(true);
    try {
      const res = await fetch(`/api/chats/${id}`);
      if (!res.ok) return;
      // Messages come straight from Redis — instant, no session replay.
      const { chat, messages } = await res.json();
      chatIdRef.current = id;
      creatingRef.current = false;
      setCurrentChatId(id);
      setInitialSession({
        sessionId: chat.sessionId,
        continuationToken: chat.continuationToken,
        streamIndex: chat.streamIndex ?? 0,
      });
      setInitialMessages((messages ?? []) as EveMessage[]);
      setViewKey(`open-${id}-${nonceRef.current++}`);
    } finally {
      setOpening(false);
    }
  }, []);

  const deleteChat = useCallback(
    async (id: string) => {
      await fetch(`/api/chats/${id}`, { method: "DELETE" });
      setChats((prev) => prev.filter((c) => c.id !== id));
      if (chatIdRef.current === id) startNewChat();
    },
    [startNewChat],
  );

  // Called by ChatView after each settled turn with the latest cursor + messages.
  const handlePersist = useCallback(
    async ({ session, title, messages }: PersistPayload) => {
      if (chatIdRef.current) {
        await fetch(`/api/chats/${chatIdRef.current}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...session, messages }),
        });
        void loadChats();
        return;
      }
      if (creatingRef.current) return; // a create is already in flight
      creatingRef.current = true;
      const res = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, ...session, messages }),
      });
      if (res.ok) {
        const { chat } = await res.json();
        chatIdRef.current = chat.id;
        setCurrentChatId(chat.id);
        void loadChats();
      } else {
        creatingRef.current = false;
      }
    },
    [loadChats],
  );

  return (
    <div className="flex h-dvh">
      <ChatList
        chats={chats}
        currentChatId={currentChatId}
        loading={loadingChats}
        onDelete={deleteChat}
        onNew={startNewChat}
        onOpen={openChat}
      />
      <div className="relative min-w-0 flex-1">
        <div className="absolute top-3 right-4 z-10">
          <UserButton />
        </div>
        {opening ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/70 text-muted-foreground text-sm">
            Loading conversation…
          </div>
        ) : null}
        <ChatView
          initialMessages={initialMessages}
          initialSession={initialSession}
          key={viewKey}
          onPersist={handlePersist}
        />
      </div>
    </div>
  );
}

function SignInLanding() {
  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-6 bg-background px-6 text-center text-foreground">
      <div className="flex flex-col items-center gap-2">
        <h1 className="font-medium text-5xl tracking-tighter">{AGENT_NAME}</h1>
        <p className="text-muted-foreground text-sm">{AGENT_TAGLINE}</p>
      </div>
      <p className="max-w-sm text-muted-foreground text-sm">
        Sign in to analyze your decks, get upgrade recommendations, and find spicy cards for your
        commander.
      </p>
      <SignInButton mode="modal">
        <button
          className="rounded-full bg-foreground px-6 py-2.5 font-medium text-background text-sm transition-opacity hover:opacity-90"
          type="button"
        >
          Sign in to start
        </button>
      </SignInButton>
    </main>
  );
}
