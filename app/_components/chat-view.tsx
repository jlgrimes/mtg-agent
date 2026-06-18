"use client";

import { useAuth } from "@clerk/nextjs";
import { type EveMessage, useEveAgent } from "eve/react";
import { AlertCircleIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  PromptInput,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { cn } from "@/lib/utils";
import { AgentMessage } from "./agent-message";
import { DeckPicker, type PickedDeck } from "./deck-picker";
import { ErrorBoundary } from "./error-boundary";

export const AGENT_NAME = "Commander Copilot";
export const AGENT_TAGLINE = "Your MTG Commander deckbuilding sidekick";

const STARTER_PROMPTS = [
  "What's a good mana curve and land count for Commander?",
  "Find budget mana rocks under $2 for a Golgari deck",
  "Any spicy cards for an Atraxa superfriends deck?",
];

const DECK_STARTERS = [
  "Give me an overview of this deck",
  "What should I cut, and why?",
  "Is my mana curve and land count okay?",
  "Suggest 5 upgrades that fit this deck",
];

export interface ChatCursor {
  sessionId: string;
  continuationToken: string;
  streamIndex: number;
}

export interface PersistPayload {
  session: ChatCursor;
  title: string;
  messages: unknown[];
}

interface UiMessage {
  role: string;
  parts: { type: string; text?: string }[];
}

type AgentStatus = ReturnType<typeof useEveAgent>["status"];

function messageText(message: { parts: { type: string; text?: string }[] }): string {
  return message.parts
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text)
    .join(" ")
    .trim();
}

export function ChatView({
  initialSession,
  initialMessages,
  onPersist,
}: {
  readonly initialSession?: ChatCursor;
  readonly initialMessages?: readonly EveMessage[];
  readonly onPersist: (data: PersistPayload) => void;
}) {
  const { getToken } = useAuth();
  const [activeDeck, setActiveDeck] = useState<PickedDeck | null>(null);
  const activeDeckRef = useRef<PickedDeck | null>(null);
  activeDeckRef.current = activeDeck;

  const agent = useEveAgent({
    initialSession,
    auth: { bearer: async () => (await getToken()) ?? "" },
    prepareSend: (input) => {
      const deck = activeDeckRef.current;
      if (!deck) return input;
      const cmdr = deck.commanders.length ? ` (commander: ${deck.commanders.join(" & ")})` : "";
      return {
        ...input,
        clientContext:
          `The user's currently selected deck is "${deck.name}"${cmdr}. Treat their question ` +
          `as being about THIS deck unless they clearly say otherwise. When they ask for ` +
          `analysis or upgrades, run analyze_decklist on it first. Full decklist:\n${deck.decklistText}`,
      };
    },
  });

  const isBusy = agent.status === "submitted" || agent.status === "streaming";

  // Full conversation = stored history (loaded instantly from Redis) + any new
  // turns produced by the live hook this session. Defensively drop anything that
  // doesn't have a parts array so a malformed stored message can't crash render.
  const allMessages: EveMessage[] = [...(initialMessages ?? []), ...agent.data.messages].filter(
    (m): m is EveMessage => !!m && Array.isArray((m as { parts?: unknown }).parts),
  );
  const isEmpty = allMessages.length === 0;

  // Persist the chat each time a turn completes (status returns to "ready").
  // Refs keep the effect reading current values without re-subscribing on every
  // streamed delta.
  const onPersistRef = useRef(onPersist);
  onPersistRef.current = onPersist;
  const sessionRef = useRef(agent.session);
  sessionRef.current = agent.session;
  const allMessagesRef = useRef(allMessages);
  allMessagesRef.current = allMessages;
  const prevStatusRef = useRef(agent.status);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = agent.status;
    if (agent.status !== "ready" || (prev !== "streaming" && prev !== "submitted")) return;
    const s = sessionRef.current;
    if (!s?.sessionId) return;
    const messages = allMessagesRef.current;
    const firstUser = (messages as unknown as UiMessage[]).find((m) => m.role === "user");
    const title = (firstUser ? messageText(firstUser).slice(0, 80) : "") || "New chat";
    onPersistRef.current({
      session: {
        sessionId: s.sessionId,
        continuationToken: s.continuationToken ?? "",
        streamIndex: s.streamIndex,
      },
      title,
      messages: messages as unknown[],
    });
  }, [agent.status]);

  const handleSubmit = async (message: PromptInputMessage) => {
    const text = message.text.trim();
    if (!text || isBusy) return;
    await agent.send({ message: text });
  };

  const placeholder = activeDeck
    ? `Ask anything about "${activeDeck.name}" — cuts, curve, upgrades…`
    : "Ask about your Commander deck — upgrades, mana curve, card ideas…";

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      {isEmpty ? null : (
        <header className="flex h-14 shrink-0 items-center justify-center gap-3 pr-16 pl-4">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-muted-foreground text-sm">{AGENT_NAME}</span>
            <StatusDot status={agent.status} />
          </span>
        </header>
      )}

      {agent.error ? (
        <div className="mx-auto w-full max-w-3xl shrink-0 px-4 pt-2 sm:px-6">
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm">
            <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div>
              <p className="font-medium">Request failed</p>
              <p className="mt-0.5 text-muted-foreground">{agent.error.message}</p>
            </div>
          </div>
        </div>
      ) : null}

      {isEmpty ? null : (
        <ErrorBoundary
          fallback={
            <div className="mx-auto w-full max-w-3xl px-4 py-6 text-muted-foreground text-sm sm:px-6">
              Couldn’t render this conversation. Start a new chat to keep going.
            </div>
          }
        >
          <Conversation className="min-h-0 flex-1">
            <ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-4 py-6 sm:px-6">
              {allMessages.map((message, index) => (
                <AgentMessage
                  canRespond={!isBusy}
                  isStreaming={agent.status === "streaming" && index === allMessages.length - 1}
                  key={message.id}
                  message={message}
                  onInputResponses={(inputResponses) => agent.send({ inputResponses })}
                />
              ))}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
        </ErrorBoundary>
      )}

      <div
        className={cn(
          "mx-auto w-full px-4 sm:px-6",
          isEmpty
            ? "flex max-w-xl flex-1 flex-col items-center justify-center gap-6 pb-[8vh]"
            : "max-w-3xl shrink-0 pb-6",
        )}
      >
        {isEmpty ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="font-medium text-5xl tracking-tighter">{AGENT_NAME}</h1>
            <p className="text-muted-foreground text-sm">{AGENT_TAGLINE}</p>
          </div>
        ) : null}

        <div className="w-full">
          {activeDeck ? (
            <div className="mb-2 flex w-full items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
              <span aria-hidden>📋</span>
              <span className="min-w-0 flex-1 truncate">
                Active deck: <span className="font-medium">{activeDeck.name}</span>
                {activeDeck.commanders.length ? (
                  <span className="text-muted-foreground"> · {activeDeck.commanders.join(" & ")}</span>
                ) : null}
              </span>
              <button
                className="shrink-0 text-muted-foreground text-xs hover:text-foreground"
                onClick={() => setActiveDeck(null)}
                type="button"
              >
                Clear
              </button>
            </div>
          ) : null}
          <PromptInput onSubmit={handleSubmit}>
            <PromptInputTextarea placeholder={placeholder} />
            <PromptInputSubmit onStop={agent.stop} status={agent.status} />
          </PromptInput>
        </div>

        {isEmpty ? (
          <>
            <div className="flex w-full flex-wrap justify-center gap-2">
              {(activeDeck ? DECK_STARTERS : STARTER_PROMPTS).map((prompt) => (
                <button
                  className="rounded-full border border-border bg-muted/40 px-3 py-1.5 text-left text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground"
                  disabled={isBusy}
                  key={prompt}
                  onClick={() => agent.send({ message: prompt })}
                  type="button"
                >
                  {prompt}
                </button>
              ))}
            </div>
            {activeDeck ? null : (
              <div className="flex w-full flex-col items-center gap-2 pt-2">
                <span className="text-muted-foreground text-xs">— or analyze one of your decks —</span>
                <DeckPicker onSelect={setActiveDeck} />
              </div>
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}

function StatusDot({ status }: { readonly status: AgentStatus }) {
  const isLive = status === "submitted" || status === "streaming";
  const tone =
    status === "error"
      ? "bg-destructive"
      : isLive
        ? "bg-emerald-500"
        : status === "ready"
          ? "bg-muted-foreground"
          : "bg-muted-foreground/50";

  return (
    <span className="relative flex size-1">
      {isLive ? (
        <span
          className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-75", tone)}
        />
      ) : null}
      <span className={cn("relative inline-flex size-1 rounded-full transition-colors", tone)} />
    </span>
  );
}
