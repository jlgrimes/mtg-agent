import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChatExperience } from "@/app/_components/chat-experience";
import type { PickedDeck } from "@/app/_components/chat-view";
import { fetchDeckDetail } from "@/lib/archidekt";
import { getDeckSnapshot } from "@/lib/chats";

// A brand-new chat already bound to a deck. The deck snapshot comes from live
// Archidekt detail when connected, otherwise from a prior chat's stored copy.
export default async function NewDeckChatPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const { userId } = await auth();
  if (!userId) notFound();

  const { deckId } = await params;
  const detail = await fetchDeckDetail(deckId);
  const deck: PickedDeck | null = detail
    ? {
        id: deckId,
        name: detail.name,
        commanders: detail.commanders,
        colors: detail.colors,
        decklistText: detail.decklistText,
      }
    : await getDeckSnapshot(userId, deckId);

  // Can't start a deck-bound chat without a decklist to ground it.
  if (!deck) {
    return (
      <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-muted-foreground text-sm">
          Connect Archidekt to load this deck before starting a chat.
        </p>
        <Link className="text-sm underline underline-offset-2 hover:opacity-70" href="/">
          Back to home
        </Link>
      </div>
    );
  }

  return <ChatExperience initialDeck={deck} key={`new-${deckId}`} />;
}
