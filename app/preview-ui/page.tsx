"use client";

// THROWAWAY preview page to visually verify the sidebar + loading UI. Delete after.
import { CheckIcon, PlusIcon, XIcon } from "lucide-react";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/sidebar";

const CHATS = [
  "Krenko goblins — budget upgrades",
  "Miirym dragons mana curve",
  "Atraxa superfriends — power level",
  "Best budget mana rocks under $2",
];
const RECS = [
  { name: "Skirk Prospector", role: "Ramp", price: "0.24", reason: "Sac a Goblin for {R} — explosive ramp", art: "https://cards.scryfall.io/art_crop/front/8/2/824b2d73-2151-4e5e-9f05-8f63e2bdcaa9.jpg?1730632010" },
  { name: "Impact Tremors", role: "Wincon", price: "2.13", reason: "Each Goblin pings the table", art: "https://cards.scryfall.io/art_crop/front/5/0/508b1442-bf2c-4ad6-9bcf-bd894e081ab6.jpg?1743207181" },
];
const TONE: Record<string, string> = { Ramp: "bg-green-500/15 text-green-700", Wincon: "bg-amber-500/15 text-amber-700" };

export default function PreviewUI() {
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="gap-2">
          <div className="px-1 font-semibold text-sm">
            Commander <span className="font-normal text-muted-foreground">Copilot</span>
          </div>
          <Button className="w-full justify-start gap-2" size="sm" variant="outline">
            <PlusIcon className="size-4" /> New chat
          </Button>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Recent</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {CHATS.map((c, i) => (
                  <SidebarMenuItem key={c}>
                    <SidebarMenuButton isActive={i === 0}>
                      <span className="truncate">{c}</span>
                    </SidebarMenuButton>
                    <SidebarMenuAction className="text-muted-foreground hover:text-destructive">
                      <XIcon className="size-3.5" />
                    </SidebarMenuAction>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <div className="flex items-center gap-2 px-1 py-1">
            <span className="size-7 rounded-full bg-muted" />
            <span className="text-muted-foreground text-xs">Account</span>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="h-svh overflow-hidden">
        <header className="flex h-12 shrink-0 items-center gap-2 border-border border-b px-3">
          <SidebarTrigger />
          <span className="font-medium text-sm">Commander Copilot</span>
        </header>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-6">
          <div className="self-end rounded-2xl rounded-br-sm border border-border bg-muted px-4 py-2.5 text-sm">
            Budget upgrades for my Krenko deck?
          </div>
          {/* loading states */}
          <div className="flex items-center gap-1.5 text-muted-foreground/80 text-xs">
            <CheckIcon className="size-3 text-green-600" /> Checked EDHREC
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <span>🃏</span>
            <Shimmer as="span" className="text-sm">Finding the best cards…</Shimmer>
          </div>
          {/* rec cards */}
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            {RECS.map((c) => (
              <div className="flex items-center gap-3 border-border border-t px-3 py-2.5 first:border-t-0" key={c.name}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="" className="h-10 w-14 shrink-0 rounded object-cover" src={c.art} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`rounded px-1.5 py-0.5 font-medium text-[10px] ${TONE[c.role]}`}>{c.role}</span>
                    <span className="truncate font-medium text-sm">{c.name}</span>
                  </div>
                  <div className="truncate text-muted-foreground text-xs">{c.reason}</div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="font-mono text-muted-foreground text-xs">${c.price}</span>
                  <span className="rounded-md bg-foreground px-2 py-0.5 font-medium text-[11px] text-background">Buy →</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <span>✦</span>
            <Shimmer as="span" className="text-sm">Thinking…</Shimmer>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
