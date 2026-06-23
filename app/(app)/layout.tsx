import { auth } from "@clerk/nextjs/server";
import type { ReactNode } from "react";
import { AppShell } from "@/app/_components/app-shell";
import { SignInLanding } from "@/app/_components/sign-in-landing";
import { getSidebarData } from "@/lib/chats";

// Shared shell for the signed-in app: the sidebar (decks + general chats) wraps
// every route. Signed-out visitors get the landing instead.
export default async function AppLayout({ children }: { readonly children: ReactNode }) {
  const { userId } = await auth();
  if (!userId) return <SignInLanding />;

  const { decks, general, chatDeckMap } = await getSidebarData(userId);
  return (
    <AppShell chatDeckMap={chatDeckMap} decks={decks} general={general}>
      {children}
    </AppShell>
  );
}
