"use client";

import { UserButton } from "@clerk/nextjs";
import { PlusIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { AGENT_NAME } from "./chat-view";

interface ChatSummary {
  id: string;
  title: string;
  updatedAt: number;
}

export function AppShell({
  chats,
  children,
}: {
  readonly chats: ChatSummary[];
  readonly children: ReactNode;
}) {
  return (
    <SidebarProvider>
      <ChatSidebar chats={chats} />
      <SidebarInset className="h-svh overflow-hidden">
        <header className="flex h-12 shrink-0 items-center gap-2 border-border border-b px-3">
          <SidebarTrigger />
          <Link className="font-medium text-sm transition-opacity hover:opacity-70" href="/">
            {AGENT_NAME}
          </Link>
        </header>
        <div className="relative min-h-0 flex-1">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function ChatSidebar({ chats }: { readonly chats: ChatSummary[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const currentChatId = pathname.startsWith("/c/") ? pathname.slice(3) : null;

  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  const deleteChat = async (id: string) => {
    await fetch(`/api/chats/${id}`, { method: "DELETE" });
    if (id === currentChatId) router.push("/");
    router.refresh();
  };

  return (
    <Sidebar>
      <SidebarHeader className="gap-2">
        <Link
          className="px-1 text-left font-semibold text-sm transition-opacity hover:opacity-70"
          href="/"
          onClick={closeOnMobile}
        >
          Commander <span className="font-normal text-muted-foreground">Copilot</span>
        </Link>
        <SidebarMenuButton asChild className="border border-border">
          <Link href="/" onClick={closeOnMobile}>
            <PlusIcon className="size-4" /> New chat
          </Link>
        </SidebarMenuButton>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Recent</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {chats.length === 0 ? (
                <p className="px-2 py-1 text-muted-foreground text-xs">No conversations yet.</p>
              ) : (
                chats.map((chat) => (
                  <SidebarMenuItem key={chat.id}>
                    <SidebarMenuButton asChild isActive={chat.id === currentChatId}>
                      <Link href={`/c/${chat.id}`} onClick={closeOnMobile}>
                        <span className="truncate">{chat.title || "Untitled"}</span>
                      </Link>
                    </SidebarMenuButton>
                    <SidebarMenuAction
                      aria-label="Delete chat"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => deleteChat(chat.id)}
                    >
                      <XIcon className="size-3.5" />
                    </SidebarMenuAction>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-2 px-1 py-1">
          <UserButton />
          <span className="text-muted-foreground text-xs">Account</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
