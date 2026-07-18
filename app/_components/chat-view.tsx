"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import {
  ChatComposer,
  ChatComposerDrawer,
  ChatLayout,
  ChatMessage,
  ChatMessageList,
} from "@astryxdesign/core/Chat";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { useAuth } from "@clerk/nextjs";
import { type EveMessage, useEveAgent } from "eve/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AgentMessage } from "./agent-message";
import { type DeckSummary, DeckPicker } from "./deck-picker";
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

// The deck a chat is bound to. `id` is the Archidekt deck id, or null for a
// pasted/manual list. Captured once and persisted with the chat.
export interface PickedDeck {
  id: string | null;
  name: string;
  commanders: string[];
  colors: string[];
  decklistText: string;
}

export interface PersistPayload {
  session: ChatCursor;
  title: string;
  deck?: PickedDeck;
  messages: unknown[];
}

interface UiMessage {
  role: string;
  parts: { type: string; text?: string }[];
}


// Error bodies can be whole HTML error pages (e.g. a Vercel function-crash
// page). Surface the platform error code + request id instead of dumping
// markup into the banner — those two values are what debugging needs.
function friendlyError(error: Error): string {
  const message = error.message.trim();
  if (message.startsWith("<") || message.toLowerCase().includes("<!doctype")) {
    // Vercel error codes look like FUNCTION_INVOCATION_FAILED / NOT_FOUND;
    // request ids look like iad1::abcde-1234567890123-0123456789ab.
    const code = message.match(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/)?.[0];
    const requestId = message.match(/\b[a-z]{3}\d?:{2}[\w:-]+\b/)?.[0];
    const detail = [code && `code ${code}`, requestId && `id ${requestId}`]
      .filter(Boolean)
      .join(", ");
    return detail
      ? `The agent service returned an error page (${detail}).`
      : "The agent service didn’t respond (its routes returned an error page). Try again in a minute — if it persists, check the deployment.";
  }
  return message.length > 300 ? `${message.slice(0, 300)}…` : message;
}

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
  initialDeck,
  onPersist,
}: {
  readonly initialSession?: ChatCursor;
  readonly initialMessages?: readonly EveMessage[];
  readonly initialDeck?: PickedDeck;
  readonly onPersist: (data: PersistPayload) => void;
}) {
  const { getToken } = useAuth();
  const router = useRouter();
  // A chat opened from a deck page arrives with its deck fixed; otherwise the
  // deck can still be set once via paste before the first turn.
  const deckLocked = !!initialDeck;
  const [activeDeck, setActiveDeck] = useState<PickedDeck | null>(initialDeck ?? null);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const activeDeckRef = useRef<PickedDeck | null>(null);
  activeDeckRef.current = activeDeck;

  // Paste path (for Moxfield/MTGGoldfish/text decks Archidekt can't reach):
  // set the pasted list as the active deck so the user can just ask about it.
  const usePastedDeck = () => {
    const text = pasteText.trim();
    if (!text) return;
    setActiveDeck({ id: null, name: "Pasted decklist", decklistText: text, commanders: [], colors: [] });
    setShowPaste(false);
    setPasteText("");
  };

  const agent = useEveAgent({
    initialSession,
    // Clerk loads asynchronously after hydration; a send fired before it's
    // ready would go out with no token and 401. Poll briefly for the token
    // instead of immediately giving up.
    auth: {
      bearer: async () => {
        for (let attempt = 0; attempt < 40; attempt++) {
          const token = await getToken();
          if (token) return token;
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
        return "";
      },
    },
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
      deck: activeDeckRef.current ?? undefined,
      messages: messages as unknown[],
    });
  }, [agent.status]);

  const handleSubmit = (value: string) => {
    const text = value.trim();
    if (!text || isBusy) return;
    void agent.send({ message: text });
  };

  const placeholder = activeDeck
    ? `Ask anything about "${activeDeck.name}" — cuts, curve, upgrades…`
    : "Ask about your Commander deck — upgrades, mana curve, card ideas…";

  // The bound deck rides in the composer drawer so it's visible right above
  // the input, in both the empty hero and the running conversation.
  const composer = (
    <ChatComposer
      drawer={
        activeDeck ? (
          <ChatComposerDrawer label="Context">
            <div className="flex w-full items-center gap-2 text-sm">
              <span aria-hidden>📋</span>
              <span className="min-w-0 flex-1 truncate">
                Active deck: <span className="font-medium">{activeDeck.name}</span>
                {activeDeck.commanders.length ? (
                  <span className="text-muted-foreground">
                    {" "}
                    · {activeDeck.commanders.join(" & ")}
                  </span>
                ) : null}
              </span>
              {deckLocked ? null : (
                <Button
                  label="Clear"
                  onClick={() => setActiveDeck(null)}
                  size="sm"
                  variant="ghost"
                />
              )}
            </div>
          </ChatComposerDrawer>
        ) : undefined
      }
      isStopShown={isBusy}
      onStop={agent.stop}
      onSubmit={handleSubmit}
      placeholder={placeholder}
    />
  );

  return (
    <main className="flex h-full flex-col overflow-hidden bg-background text-foreground">
      {agent.error ? (
        <div className="mx-auto w-full max-w-3xl shrink-0 px-4 pt-2 sm:px-6">
          <Banner description={friendlyError(agent.error)} status="error" title="Request failed" />
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
          <ChatLayout className="min-h-0 flex-1" composer={composer}>
            <ChatMessageList>
              {allMessages.map((message, index) => (
                <AgentMessage
                  canRespond={!isBusy}
                  isStreaming={agent.status === "streaming" && index === allMessages.length - 1}
                  key={message.id}
                  message={message}
                  onInputResponses={(inputResponses) => agent.send({ inputResponses })}
                />
              ))}
              {agent.status === "submitted" ? (
                <ChatMessage sender="assistant">
                  <Spinner label="Thinking…" size="sm" />
                </ChatMessage>
              ) : null}
            </ChatMessageList>
          </ChatLayout>
        </ErrorBoundary>
      )}

      {isEmpty ? (
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 px-4 pb-[8vh] sm:px-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="font-medium text-4xl tracking-tighter sm:text-5xl">{AGENT_NAME}</h1>
            <Text color="secondary" size="sm">
              {AGENT_TAGLINE}
            </Text>
          </div>

          <div className="mx-auto w-full max-w-xl">{composer}</div>
          <div className="flex w-full flex-wrap justify-center gap-2">
              {(activeDeck ? DECK_STARTERS : STARTER_PROMPTS).map((prompt) => (
                <Button
                  isDisabled={isBusy}
                  key={prompt}
                  label={prompt}
                  onClick={() => agent.send({ message: prompt })}
                size="sm"
              />
            ))}
          </div>
          {activeDeck ? null : (
              <div className="flex w-full flex-col items-center gap-3 pt-2">
                <span className="text-muted-foreground text-xs">— or open a deck to analyze —</span>
                <DeckPicker onPick={(deck: DeckSummary) => router.push(`/d/${deck.id}`)} />
                {showPaste ? (
                  <div className="flex w-full max-w-md flex-col gap-2">
                    <TextArea
                      hasAutoFocus
                      isLabelHidden
                      label="Decklist"
                      onChange={setPasteText}
                      placeholder={"Paste a decklist from Moxfield, Archidekt, MTGGoldfish…\n1 Sol Ring\n1 Arcane Signet\n…"}
                      rows={6}
                      value={pasteText}
                    />
                    <div className="flex justify-center gap-2">
                      <Button
                        isDisabled={!pasteText.trim()}
                        label="Use this deck"
                        onClick={usePastedDeck}
                        variant="primary"
                      />
                      <Button label="Cancel" onClick={() => setShowPaste(false)} variant="ghost" />
                    </div>
                  </div>
                ) : (
                  <Button
                    icon={<span aria-hidden>📋</span>}
                    label="or paste a decklist (Moxfield, etc.)"
                    onClick={() => setShowPaste(true)}
                    size="sm"
                    variant="ghost"
                  />
                )}
            </div>
          )}
        </div>
      ) : null}
    </main>
  );
}
