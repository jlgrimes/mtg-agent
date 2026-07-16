"use client";

import { AppShell as AstryxAppShell, useAppShellMobile } from "@astryxdesign/core/AppShell";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { MoreMenu } from "@astryxdesign/core/MoreMenu";
import {
  SideNav,
  SideNavHeading,
  SideNavItem,
  SideNavSection,
} from "@astryxdesign/core/SideNav";
import { Text } from "@astryxdesign/core/Text";
import { UserButton } from "@clerk/nextjs";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { AGENT_NAME } from "./chat-view";

interface ChatSummary {
  id: string;
  title: string;
  updatedAt: number;
}

interface DeckGroup {
  id: string;
  name: string;
  colors: string[];
  chatCount: number;
}

const COLOR_DOT: Record<string, string> = {
  W: "bg-amber-200",
  U: "bg-blue-400",
  B: "bg-neutral-700",
  R: "bg-red-500",
  G: "bg-green-500",
};

export function AppShell({
  decks,
  general,
  chatDeckMap,
  children,
}: {
  readonly decks: DeckGroup[];
  readonly general: ChatSummary[];
  readonly chatDeckMap: Record<string, string>;
  readonly children: ReactNode;
}) {
  return (
    <AstryxAppShell
      height="fill"
      sideNav={<ChatSideNav chatDeckMap={chatDeckMap} decks={decks} general={general} />}
    >
      <div className="relative h-full min-h-0 overflow-hidden">{children}</div>
    </AstryxAppShell>
  );
}

function ColorDots({ colors }: { readonly colors: string[] }) {
  return (
    <span className="flex shrink-0 gap-0.5">
      {(colors.length ? colors : ["C"]).map((c, i) => (
        <span
          className={`size-2 rounded-full ring-1 ring-border ${COLOR_DOT[c] ?? "bg-neutral-400"}`}
          key={`${c}-${i}`}
        />
      ))}
    </span>
  );
}

function ChatSideNav({
  decks,
  general,
  chatDeckMap,
}: {
  readonly decks: DeckGroup[];
  readonly general: ChatSummary[];
  readonly chatDeckMap: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { closeMobileNav } = useAppShellMobile();

  const currentChatId = pathname.startsWith("/c/") ? pathname.slice(3) : null;
  const currentDeckId = pathname.startsWith("/d/")
    ? pathname.slice(3).split("/")[0]
    : currentChatId
      ? (chatDeckMap[currentChatId] ?? null)
      : null;

  const deleteChat = async (id: string) => {
    await fetch(`/api/chats/${id}`, { method: "DELETE" });
    if (id === currentChatId) router.push("/");
    router.refresh();
  };

  return (
    <SideNav
      footer={
        <div className="flex items-center gap-2 px-2 py-1">
          <UserButton />
          <Text color="secondary" size="xsm">
            Account
          </Text>
        </div>
      }
      header={<SideNavHeading heading={AGENT_NAME} headingHref="/" />}
      topContent={
        <Button
          href="/"
          icon={<PlusIcon className="size-4" />}
          label="New chat"
          onClick={closeMobileNav}
        />
      }
    >
      {decks.length > 0 ? (
        <SideNavSection title="Decks">
          {decks.map((deck) => (
            <SideNavItem
              endContent={<Badge label={String(deck.chatCount)} variant="neutral" />}
              href={`/d/${deck.id}`}
              icon={<ColorDots colors={deck.colors} />}
              isSelected={deck.id === currentDeckId}
              key={deck.id}
              label={deck.name}
              onClick={closeMobileNav}
            />
          ))}
        </SideNavSection>
      ) : null}

      <SideNavSection title={decks.length > 0 ? "General" : "Recent"}>
        {general.length === 0 ? (
          <div className="px-2 py-1">
            <Text color="secondary" size="xsm">
              {decks.length > 0 ? "No general chats." : "No conversations yet."}
            </Text>
          </div>
        ) : (
          general.map((chat) => (
            <div className="flex items-center gap-0.5" key={chat.id}>
              <div className="min-w-0 flex-1">
                <SideNavItem
                  href={`/c/${chat.id}`}
                  isSelected={chat.id === currentChatId}
                  label={chat.title || "Untitled"}
                  onClick={closeMobileNav}
                />
              </div>
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
            </div>
          ))
        )}
      </SideNavSection>
    </SideNav>
  );
}
