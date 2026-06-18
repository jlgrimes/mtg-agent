"use client";

import { Show, SignInButton, UserButton, useAuth } from "@clerk/nextjs";
import { useEveAgent } from "eve/react";
import { AlertCircleIcon } from "lucide-react";
import { DeckSidebar } from "./deck-sidebar";
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

const AGENT_NAME = "Commander Copilot";
const AGENT_TAGLINE = "Your MTG Commander deckbuilding sidekick";
const BETA_TERMS_HREF = "https://vercel.com/docs/release-phases/public-beta-agreement";

const STARTER_PROMPTS = [
  "Recommend 5 upgrades for my Miirym, Sentinel Wyrm deck",
  "Find budget mana rocks under $2 for a Golgari deck",
  "What's a good mana curve and land count for Commander?",
  "Any spicy cards for an Atraxa superfriends deck?",
];

type AgentStatus = ReturnType<typeof useEveAgent>["status"];

export function AgentChat() {
  const { getToken } = useAuth();
  // Attach the signed-in user's Clerk token to every agent request. useEveAgent
  // re-resolves this before each call (and on reconnects), so short-lived Clerk
  // session tokens stay fresh automatically.
  const agent = useEveAgent({
    auth: { bearer: async () => (await getToken()) ?? "" },
  });
  const isBusy = agent.status === "submitted" || agent.status === "streaming";
  const isEmpty = agent.data.messages.length === 0;

  const handleSubmit = async (message: PromptInputMessage) => {
    const text = message.text.trim();
    if (!text || isBusy) return;

    await agent.send({ message: text });
  };

  const handlePickDeck = (deck: {
    name: string;
    decklistText: string;
    commanders: string[];
  }) => {
    if (isBusy || !deck.decklistText) return;
    const cmdr = deck.commanders.length ? ` My commander is ${deck.commanders.join(" & ")}.` : "";
    void agent.send({
      message:
        `Here's my Archidekt deck "${deck.name}".${cmdr} Please analyze it — mana curve, ` +
        `land count, and a quick assessment with any upgrade ideas:\n\n${deck.decklistText}`,
    });
  };

  const composer = (
    <PromptInput onSubmit={handleSubmit}>
      <PromptInputTextarea placeholder="Ask about your Commander deck — upgrades, mana curve, card ideas…" />
      <PromptInputSubmit onStop={agent.stop} status={agent.status} />
    </PromptInput>
  );

  const chat = (
    <main className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      {isEmpty ? null : (
        <header className="flex h-14 shrink-0 items-center justify-center gap-3 pl-4 pr-2">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-muted-foreground text-sm">{AGENT_NAME}</span>
            <StatusDot status={agent.status} />
          </span>
          <a
            className="rounded-full border border-amber-500/30 px-2 py-0.5 font-medium text-amber-700 text-xs transition-colors hover:bg-amber-500/10 dark:text-amber-300"
            href={BETA_TERMS_HREF}
            rel="noreferrer"
            target="_blank"
          >
            Public preview
          </a>
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
        <Conversation className="min-h-0 flex-1">
          <ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-4 py-6 sm:px-6">
            {agent.data.messages.map((message, index) => (
              <AgentMessage
                canRespond={!isBusy}
                isStreaming={
                  agent.status === "streaming" && index === agent.data.messages.length - 1
                }
                key={message.id}
                message={message}
                onInputResponses={(inputResponses) => agent.send({ inputResponses })}
              />
            ))}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      )}

      <div
        className={cn(
          "mx-auto w-full px-4 sm:px-6",
          isEmpty
            ? "flex max-w-xl flex-1 flex-col items-center justify-center gap-8 pb-[10vh]"
            : "max-w-3xl shrink-0 pb-6",
        )}
      >
        {isEmpty ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <h1 className="font-medium text-5xl tracking-tighter">{AGENT_NAME}</h1>
            <p className="text-muted-foreground text-sm">{AGENT_TAGLINE}</p>
            <a
              className="rounded-full border border-amber-500/30 px-2 py-0.5 font-medium text-amber-700 text-xs transition-colors hover:bg-amber-500/10 dark:text-amber-300"
              href={BETA_TERMS_HREF}
              rel="noreferrer"
              target="_blank"
            >
              Public preview
            </a>
          </div>
        ) : null}
        <div className="w-full">{composer}</div>
        {isEmpty ? (
          <div className="flex w-full flex-wrap justify-center gap-2">
            {STARTER_PROMPTS.map((prompt) => (
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
        ) : null}
      </div>
    </main>
  );

  return (
    <>
      <Show when="signed-out">
        <SignInLanding />
      </Show>
      <Show when="signed-in">
        <div className="flex h-dvh">
          <DeckSidebar busy={isBusy} onPickDeck={handlePickDeck} />
          <div className="relative min-w-0 flex-1">
            <div className="absolute top-3 right-4 z-10">
              <UserButton />
            </div>
            {chat}
          </div>
        </div>
      </Show>
    </>
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
          className={cn(
            "absolute inline-flex size-full animate-ping rounded-full opacity-75",
            tone,
          )}
        />
      ) : null}
      <span className={cn("relative inline-flex size-1 rounded-full transition-colors", tone)} />
    </span>
  );
}
