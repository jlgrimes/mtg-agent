"use client";

import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import {
  ChatMessage,
  ChatMessageBubble,
  type ChatMessageSender,
  ChatToolCalls,
} from "@astryxdesign/core/Chat";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { Markdown } from "@astryxdesign/core/Markdown";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Text } from "@astryxdesign/core/Text";
import type { EveDynamicToolPart, EveMessage, EveMessagePart } from "eve/react";

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

// Plain status tools (lookups) get grouped into one ChatToolCalls block;
// HITL requests and recommendation cards render standalone.
function isStatusTool(part: EveDynamicToolPart): boolean {
  return !part.toolMetadata?.eve?.inputRequest && part.toolName !== "recommend_cards";
}

type RenderItem =
  | { readonly kind: "tools"; readonly parts: EveDynamicToolPart[]; readonly key: string }
  | { readonly kind: "part"; readonly part: EveMessagePart; readonly key: string; readonly index: number };

// Consecutive status-tool parts merge into one group (step-start markers in
// between don't break a run — the agent often looks several things up back
// to back across steps).
function groupParts(parts: readonly EveMessagePart[]): RenderItem[] {
  const items: RenderItem[] = [];
  parts.forEach((part, index) => {
    if (part.type === "step-start") return;
    if (part.type === "dynamic-tool" && isStatusTool(part)) {
      const last = items[items.length - 1];
      if (last?.kind === "tools") {
        last.parts.push(part);
        return;
      }
      items.push({ kind: "tools", parts: [part], key: part.toolCallId });
      return;
    }
    items.push({ kind: "part", part, key: partKey(part, index), index });
  });
  return items;
}

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
  const sender: ChatMessageSender = message.role === "user" ? "user" : "assistant";
  const lastTextIndex = message.parts.reduce(
    (last, part, index) => (part.type === "text" ? index : last),
    -1,
  );

  return (
    <ChatMessage sender={sender}>
      {groupParts(message.parts).map((item) =>
        item.kind === "tools" ? (
          <ToolCallGroup key={item.key} parts={item.parts} />
        ) : (
          <AgentMessagePart
            canRespond={canRespond}
            isStreaming={
              isStreaming &&
              sender === "assistant" &&
              item.part.type === "text" &&
              item.index === lastTextIndex
            }
            key={item.key}
            onInputResponses={onInputResponses}
            part={item.part}
            sender={sender}
          />
        ),
      )}
    </ChatMessage>
  );
}

function AgentMessagePart({
  canRespond,
  isStreaming,
  onInputResponses,
  part,
  sender,
}: {
  readonly canRespond: boolean;
  readonly isStreaming: boolean;
  readonly onInputResponses: (responses: readonly AgentInputResponse[]) => void | Promise<void>;
  readonly part: EveMessagePart;
  readonly sender: ChatMessageSender;
}) {
  switch (part.type) {
    case "step-start":
      return null;
    case "text":
      // Users get a filled bubble; assistant prose renders as a ghost bubble
      // so markdown (tables, code blocks) isn't boxed in.
      return (
        <ChatMessageBubble variant={sender === "user" ? "filled" : "ghost"}>
          <Markdown isStreaming={isStreaming}>{part.text}</Markdown>
        </ChatMessageBubble>
      );
    case "reasoning":
      return (
        <Collapsible
          trigger={
            part.state === "streaming" ? (
              <span className="flex items-center gap-2">
                <Spinner size="sm" /> Thinking…
              </span>
            ) : (
              "Thought process"
            )
          }
        >
          <Text as="div" color="secondary" size="sm">
            <Markdown isStreaming={part.state === "streaming"}>{part.text}</Markdown>
          </Text>
        </Collapsible>
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
      // Grouped status tools are handled by ToolCallGroup; only
      // recommend_cards reaches here.
      if (part.toolName === "recommend_cards") {
        return <RecommendationCards part={part} />;
      }
      return null;
  }
}

// What the tool was pointed at, pulled from its arguments (commander name,
// search query, deck URL, …) so the activity log reads like a story.
function toolTarget(part: EveDynamicToolPart): string | undefined {
  const input = part.input;
  if (!input || typeof input !== "object") return undefined;
  const args = input as Record<string, unknown>;
  if (typeof args.decklist === "string") return "pasted decklist";
  for (const key of ["commander", "card", "name", "query", "urlOrId"]) {
    const value = args[key];
    if (typeof value === "string" && value.trim()) {
      return value.length > 48 ? `${value.slice(0, 48)}…` : value;
    }
  }
  return undefined;
}

// One-line result summary shown inline after the label once a call completes.
function toolSummary(part: EveDynamicToolPart): string | undefined {
  if (part.state !== "output-available") return undefined;
  const out = part.output as Record<string, any> | null | undefined;
  if (!out || typeof out !== "object") return undefined;
  switch (part.toolName) {
    case "edhrec_commander":
      return typeof out.decksAnalyzed === "number"
        ? `${out.decksAnalyzed.toLocaleString()} decks analyzed`
        : undefined;
    case "edhrec_card":
      return Array.isArray(out.sections) ? `${out.sections.length} synergy sections` : undefined;
    case "scryfall_search":
      return typeof out.total === "number" ? `${out.total.toLocaleString()} matches` : undefined;
    case "scryfall_card":
      return typeof out.name === "string" ? out.name : undefined;
    case "analyze_decklist": {
      const stats = out.stats;
      return stats && typeof stats.totalCards === "number"
        ? `${stats.totalCards} cards · ${stats.lands} lands · avg CMC ${stats.avgCmcNonland}`
        : undefined;
    }
    case "archidekt_import":
      return typeof out.totalCards === "number" ? `${out.totalCards} cards imported` : undefined;
    default:
      return undefined;
  }
}

// A run of consecutive lookups rendered as one activity block: single calls
// show inline, larger runs collapse into a summary with per-call status.
function ToolCallGroup({ parts }: { readonly parts: readonly EveDynamicToolPart[] }) {
  return (
    <ChatToolCalls
      calls={parts.map((part) => {
        const meta = TOOL_LABELS[part.toolName];
        const running = part.state === "input-available" || part.state === "input-streaming";
        const errored = part.state === "output-error" || part.state === "output-denied";
        const summary = toolSummary(part);
        return {
          key: part.toolCallId,
          name: running ? (meta?.running ?? part.toolName) : (meta?.done ?? part.toolName),
          target: toolTarget(part),
          status: errored ? ("error" as const) : running ? ("running" as const) : ("complete" as const),
          errorMessage: errored ? (part.errorText ?? "Couldn’t complete") : undefined,
          stats: summary ? (
            <Text color="secondary" size="xsm">
              {summary}
            </Text>
          ) : undefined,
        };
      })}
    />
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
    <Card padding={3} variant="yellow">
      <div className="space-y-3">
        <Text as="p" color="secondary" size="sm">
          {inputRequest.prompt}
        </Text>
        {inputResponse ? (
          <Text as="p" size="sm" weight="medium">
            Responded: {selectedOption?.label ?? inputResponse.text ?? inputResponse.optionId}
          </Text>
        ) : (
          <div className="flex flex-wrap gap-2">
            {inputRequest.options?.map((option) => (
              <Button
                isDisabled={!canRespond}
                key={option.id}
                label={option.label}
                onClick={() => {
                  void onInputResponses([
                    {
                      optionId: option.id,
                      requestId: inputRequest.requestId,
                    },
                  ]);
                }}
                size="sm"
                variant={option.style === "danger" ? "destructive" : "secondary"}
              />
            ))}
          </div>
        )}
      </div>
    </Card>
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
    // Skeleton card rows while the recommendations are being assembled, so
    // the block "develops" in place instead of appearing all at once.
    return (
      <div className="my-1 flex flex-col gap-2">
        <Spinner label="Finding the best cards…" size="sm" />
        <Card padding={0}>
          {[0, 1, 2].map((i) => (
            <div
              className="flex items-center gap-3 border-border border-t px-3 py-2.5 first:border-t-0"
              key={i}
            >
              <Skeleton height={40} radius={1} width={56} />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Skeleton height={12} width="40%" />
                <Skeleton height={10} width="70%" />
              </div>
            </div>
          ))}
        </Card>
      </div>
    );
  }

  return (
    <div className="my-1 flex flex-col gap-2">
      {data.intro ? (
        <Text as="p" size="sm">
          {data.intro}
        </Text>
      ) : null}
      <Card padding={0}>
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
                <Button
                  href={card.buyUrl}
                  label="Buy"
                  rel="noreferrer"
                  size="sm"
                  target="_blank"
                />
              ) : null}
            </div>
          </div>
        ))}
      </Card>
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
