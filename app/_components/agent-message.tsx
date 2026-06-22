"use client";

import type { EveDynamicToolPart, EveMessage, EveMessagePart } from "eve/react";
import { CheckIcon } from "lucide-react";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";

// Human-readable status for each tool, shown instead of raw tool/JSON widgets.
const TOOL_LABELS: Record<string, { running: string; done: string; icon: string }> = {
  edhrec_commander: { running: "Consulting EDHREC", done: "Checked EDHREC", icon: "📖" },
  edhrec_card: { running: "Checking card synergies", done: "Checked synergies", icon: "🔗" },
  scryfall_card: { running: "Looking up a card", done: "Looked up a card", icon: "🔍" },
  scryfall_search: { running: "Searching cards", done: "Searched cards", icon: "🔍" },
  analyze_decklist: { running: "Analyzing your deck", done: "Analyzed your deck", icon: "📊" },
  archidekt_import: { running: "Importing your deck", done: "Imported your deck", icon: "📥" },
  recommend_cards: { running: "Finding the best cards", done: "", icon: "🃏" },
};

export type AgentInputResponse = {
  readonly optionId?: string;
  readonly requestId: string;
  readonly text?: string;
};

export function AgentMessage({
  canRespond,
  isStreaming,
  message,
  onInputResponses,
}: {
  readonly canRespond: boolean;
  readonly isStreaming: boolean;
  readonly message: EveMessage;
  readonly onInputResponses: (responses: readonly AgentInputResponse[]) => void | Promise<void>;
}) {
  const lastTextIndex = message.parts.reduce(
    (last, part, index) => (part.type === "text" ? index : last),
    -1,
  );

  return (
    <Message
      data-optimistic={message.metadata?.optimistic ? "true" : undefined}
      from={message.role}
    >
      <MessageContent>
        {message.parts.map((part, index) => (
          <AgentMessagePart
            canRespond={canRespond}
            key={partKey(part, index)}
            onInputResponses={onInputResponses}
            part={part}
            showCaret={isStreaming && message.role === "assistant" && index === lastTextIndex}
          />
        ))}
      </MessageContent>
    </Message>
  );
}

function AgentMessagePart({
  canRespond,
  onInputResponses,
  part,
  showCaret,
}: {
  readonly canRespond: boolean;
  readonly onInputResponses: (responses: readonly AgentInputResponse[]) => void | Promise<void>;
  readonly part: EveMessagePart;
  readonly showCaret: boolean;
}) {
  switch (part.type) {
    case "step-start":
      return null;
    case "text":
      return (
        <MessageResponse caret="block" isAnimating={showCaret}>
          {part.text}
        </MessageResponse>
      );
    case "reasoning":
      return (
        <Reasoning defaultOpen isStreaming={part.state === "streaming"}>
          <ReasoningTrigger />
          <ReasoningContent>{part.text}</ReasoningContent>
        </Reasoning>
      );
    case "dynamic-tool":
      // A pending human-in-the-loop question/approval rides on the tool part.
      if (part.toolMetadata?.eve?.inputRequest) {
        return (
          <InputRequestActions
            canRespond={canRespond}
            onInputResponses={onInputResponses}
            part={part}
          />
        );
      }
      if (part.toolName === "recommend_cards") {
        return <RecommendationCards part={part} />;
      }
      return <ToolStatus part={part} />;
  }
}

// Compact, human-readable status line for a tool call (replaces raw JSON widgets).
function ToolStatus({ part }: { readonly part: EveDynamicToolPart }) {
  const meta = TOOL_LABELS[part.toolName];
  const running = part.state === "input-available" || part.state === "input-streaming";
  const errored = part.state === "output-error" || part.state === "output-denied";
  const icon = meta?.icon ?? "🔧";

  if (errored) {
    return (
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
        <span aria-hidden>⚠</span> {meta?.done ?? part.toolName} — couldn’t complete
      </div>
    );
  }
  if (running) {
    return (
      <div className="flex items-center gap-1.5 text-xs">
        <span aria-hidden>{icon}</span>
        <Shimmer as="span" className="text-xs">{`${meta?.running ?? part.toolName}…`}</Shimmer>
      </div>
    );
  }
  // completed
  if (!meta?.done) return null; // recommend_cards renders its own cards
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground/80 text-xs">
      <CheckIcon className="size-3 text-green-600" /> {meta.done}
    </div>
  );
}

function InputRequestActions({
  canRespond,
  onInputResponses,
  part,
}: {
  readonly canRespond: boolean;
  readonly onInputResponses: (responses: readonly AgentInputResponse[]) => void | Promise<void>;
  readonly part: EveDynamicToolPart;
}) {
  const inputRequest = part.toolMetadata?.eve?.inputRequest;
  if (!inputRequest) {
    return null;
  }

  const inputResponse = part.toolMetadata?.eve?.inputResponse;
  const selectedOption = inputRequest.options?.find(
    (option) => option.id === inputResponse?.optionId,
  );

  return (
    <div className="space-y-3 rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3">
      <p className="text-muted-foreground text-sm">{inputRequest.prompt}</p>
      {inputResponse ? (
        <p className="font-medium text-sm">
          Responded: {selectedOption?.label ?? inputResponse.text ?? inputResponse.optionId}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {inputRequest.options?.map((option) => (
            <Button
              disabled={!canRespond}
              key={option.id}
              onClick={() => {
                void onInputResponses([
                  {
                    optionId: option.id,
                    requestId: inputRequest.requestId,
                  },
                ]);
              }}
              size="sm"
              type="button"
              variant={option.style === "danger" ? "destructive" : "default"}
            >
              {option.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

interface RecommendedCard {
  name: string;
  role: string | null;
  reason: string;
  priceUsd: number | null;
  artCrop: string | null;
  buyUrl: string | null;
}

const ROLE_TONE: Record<string, string> = {
  Ramp: "bg-green-500/15 text-green-700 dark:text-green-400",
  Draw: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  Removal: "bg-red-500/15 text-red-700 dark:text-red-400",
  Wincon: "bg-amber-500/15 text-amber-700 dark:text-amber-500",
  Synergy: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  Land: "bg-stone-500/15 text-stone-600 dark:text-stone-400",
  Other: "bg-muted text-muted-foreground",
};

function RecommendationCards({ part }: { readonly part: EveDynamicToolPart }) {
  const data = part.output as { intro?: string | null; cards?: RecommendedCard[] } | undefined;

  if (!data?.cards) {
    return (
      <div className="my-1 flex items-center gap-1.5 text-sm">
        <span aria-hidden>🃏</span>
        <Shimmer as="span" className="text-sm">
          Finding the best cards…
        </Shimmer>
      </div>
    );
  }

  return (
    <div className="my-1 flex flex-col gap-2">
      {data.intro ? <p className="text-sm">{data.intro}</p> : null}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {data.cards.map((card) => (
          <div
            className="flex items-center gap-3 border-border border-t px-3 py-2.5 first:border-t-0"
            key={card.name}
          >
            {card.artCrop ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt=""
                className="h-10 w-14 shrink-0 rounded object-cover"
                loading="lazy"
                src={card.artCrop}
              />
            ) : (
              <div className="grid h-10 w-14 shrink-0 place-items-center rounded bg-muted font-medium text-muted-foreground text-sm">
                {card.name.slice(0, 1)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {card.role ? (
                  <span
                    className={`rounded px-1.5 py-0.5 font-medium text-[10px] ${ROLE_TONE[card.role] ?? ROLE_TONE.Other}`}
                  >
                    {card.role}
                  </span>
                ) : null}
                <span className="truncate font-medium text-sm">{card.name}</span>
              </div>
              <div className="truncate text-muted-foreground text-xs">{card.reason}</div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {card.priceUsd != null ? (
                <span className="font-mono text-muted-foreground text-xs">
                  ${card.priceUsd.toFixed(2)}
                </span>
              ) : null}
              {card.buyUrl ? (
                <a
                  className="rounded-md bg-foreground px-2 py-0.5 font-medium text-[11px] text-background transition-opacity hover:opacity-90"
                  href={card.buyUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Buy →
                </a>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function partKey(part: EveMessagePart, index: number): string {
  switch (part.type) {
    case "dynamic-tool":
      return part.toolCallId;
    default:
      return `${part.type}:${index}`;
  }
}
