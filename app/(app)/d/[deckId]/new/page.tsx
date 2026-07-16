import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { ChatExperience } from "@/app/_components/chat-experience";
import type { PickedDeck } from "@/app/_components/chat-view";
import { getDeckSnapshot } from "@/lib/chats";
import { getDeckWithDetail } from "@/lib/decks";

// A brand-new chat already bound to a deck. The deck snapshot comes from our
// store (refreshed from Archidekt as needed), falling back to a prior chat's
// stored copy if the deck isn't in the store and Archidekt is unreachable.
export default async function NewDeckChatPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  // Signed out: render nothing — the (app) layout shows the sign-in landing,
  // and notFound() here would override it with a 404.
  const { userId } = await auth();
  if (!userId) return null;

  const { deckId } = await params;
  const stored = await getDeckWithDetail(userId, deckId);
  const deck: PickedDeck | null = stored?.decklistText
    ? {
        id: deckId,
        name: stored.name,
        commanders: stored.commanders ?? [],
        colors: stored.colors,
        decklistText: stored.decklistText,
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
