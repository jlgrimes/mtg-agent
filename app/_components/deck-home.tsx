"use client";

import { MoreHorizontalIcon, PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

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
        <p className="text-muted-foreground text-sm">
          {deck.commanders.length ? deck.commanders.join(" & ") : "Commander deck"}
          {deck.totalCards ? ` · ${deck.totalCards} cards` : ""}
          {deck.hasDecklist ? "" : " · decklist not synced yet"}
        </p>
        <div>
          <Link
            className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm transition-opacity hover:opacity-90"
            href={`/d/${deck.id}/new`}
          >
            <PlusIcon className="size-4" /> New chat
          </Link>
        </div>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
          Conversations
        </h2>
        {chats.length === 0 ? (
          <p className="rounded-lg border border-border border-dashed px-4 py-6 text-center text-muted-foreground text-sm">
            No conversations yet. Start one to analyze, tune, or theorycraft this deck.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {chats.map((chat) => (
              <li className="group flex items-center gap-2 px-3 py-2.5" key={chat.id}>
                <Link className="min-w-0 flex-1" href={`/c/${chat.id}`}>
                  <span className="block truncate text-sm">{chat.title || "Untitled"}</span>
                  <span className="text-muted-foreground text-xs">{relativeTime(chat.updatedAt)}</span>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      aria-label="Chat options"
                      className="shrink-0 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
                      type="button"
                    >
                      <MoreHorizontalIcon className="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => deleteChat(chat.id)}
                    >
                      <Trash2Icon className="size-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
