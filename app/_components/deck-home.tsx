"use client";

import { Button } from "@astryxdesign/core/Button";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { MoreMenu } from "@astryxdesign/core/MoreMenu";
import { Text } from "@astryxdesign/core/Text";
import { Timestamp } from "@astryxdesign/core/Timestamp";
import { PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export interface DeckHeader {
  id: string;
  name: string;
  colors: string[];
  commanders: string[];
  totalCards: number | null;
  hasDecklist: boolean;
}

export interface DeckChat {
  id: string;
  title: string;
  updatedAt: number;
}

const COLOR_DOT: Record<string, string> = {
  W: "bg-amber-200",
  U: "bg-blue-400",
  B: "bg-neutral-700",
  R: "bg-red-500",
  G: "bg-green-500",
};

// A deck's "project" page: deck header, a button to start a new chat bound to
// this deck, and the list of conversations already in it.
export function DeckHome({ deck, chats }: { readonly deck: DeckHeader; readonly chats: DeckChat[] }) {
  const router = useRouter();

  const deleteChat = async (id: string) => {
    await fetch(`/api/chats/${id}`, { method: "DELETE" });
    router.refresh();
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-6 overflow-y-auto px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {(deck.colors.length ? deck.colors : ["C"]).map((c, i) => (
              <span
                className={`size-3 rounded-full ring-1 ring-border ${COLOR_DOT[c] ?? "bg-neutral-400"}`}
                key={`${c}-${i}`}
              />
            ))}
          </div>
          <h1 className="font-semibold text-2xl tracking-tight">{deck.name}</h1>
        </div>
        <Text color="secondary" size="sm">
          {deck.commanders.length ? deck.commanders.join(" & ") : "Commander deck"}
          {deck.totalCards ? ` · ${deck.totalCards} cards` : ""}
          {deck.hasDecklist ? "" : " · decklist not synced yet"}
        </Text>
        <div>
          <Button
            href={`/d/${deck.id}/new`}
            icon={<PlusIcon className="size-4" />}
            label="New chat"
            variant="primary"
          />
        </div>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
          Conversations
        </h2>
        {chats.length === 0 ? (
          <EmptyState
            description="Start one to analyze, tune, or theorycraft this deck."
            title="No conversations yet"
          />
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {chats.map((chat) => (
              <li className="flex items-center gap-2 px-3 py-2.5" key={chat.id}>
                <Link className="min-w-0 flex-1" href={`/c/${chat.id}`}>
                  <span className="block truncate text-sm">{chat.title || "Untitled"}</span>
                  <Text color="secondary" size="xsm">
                    <Timestamp format="relative" value={chat.updatedAt} />
                  </Text>
                </Link>
                <MoreMenu
                  items={[
                    {
                      label: "Delete",
                      icon: <Trash2Icon className="size-4" />,
                      onClick: () => deleteChat(chat.id),
                    },
                  ]}
                  label="Chat options"
                  size="sm"
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
