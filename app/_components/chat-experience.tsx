"use client";

import type { EveMessage } from "eve/react";
import { useRouter } from "next/navigation";
import { useCallback, useRef } from "react";
import { type ChatCursor, ChatView, type PersistPayload } from "./chat-view";

// Client wrapper that owns chat persistence. On a brand-new chat (`id`
// undefined) the first completed turn POSTs a new chat record, then navigates
// to its /c/[id] URL so it's bookmarkable, refreshable, and back-button-able.
// Existing chats PATCH in place and refresh the sidebar ordering/title.
export function ChatExperience({
  id,
  initialSession,
  initialMessages,
}: {
  readonly id?: string;
  readonly initialSession?: ChatCursor;
  readonly initialMessages?: readonly EveMessage[];
}) {
  const router = useRouter();
  const chatIdRef = useRef<string | null>(id ?? null);
  const creatingRef = useRef(false);

  const handlePersist = useCallback(
    async ({ session, title, messages }: PersistPayload) => {
      try {
        if (chatIdRef.current) {
          await fetch(`/api/chats/${chatIdRef.current}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...session, messages }),
          });
          router.refresh();
          return;
        }
        if (creatingRef.current) return;
        creatingRef.current = true;
        const res = await fetch("/api/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, ...session, messages }),
        });
        if (res.ok) {
          const { chat } = await res.json();
          chatIdRef.current = chat.id;
          // The turn is already persisted, so the /c/[id] server load renders
          // the same conversation; navigating gives it a real URL.
          router.replace(`/c/${chat.id}`);
        } else {
          creatingRef.current = false;
        }
      } catch (e) {
        creatingRef.current = false;
        console.error("Failed to persist chat:", e);
      }
    },
    [router],
  );

  return (
    <ChatView
      initialMessages={initialMessages}
      initialSession={initialSession}
      key={id ?? "new"}
      onPersist={handlePersist}
    />
  );
}
