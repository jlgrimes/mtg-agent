import { auth } from "@clerk/nextjs/server";
import type { ReactNode } from "react";
import { AppShell } from "@/app/_components/app-shell";
import { SignInLanding } from "@/app/_components/sign-in-landing";
import { listChats } from "@/lib/chats";

// Shared shell for the signed-in app: the sidebar (with the server-loaded chat
// list) wraps every chat route. Signed-out visitors get the landing instead.
export default async function AppLayout({ children }: { readonly children: ReactNode }) {
  const { userId } = await auth();
  if (!userId) return <SignInLanding />;

  const chats = await listChats(userId);
  return <AppShell chats={chats}>{children}</AppShell>;
}
