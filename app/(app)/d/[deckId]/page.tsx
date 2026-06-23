import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { DeckHome, type DeckHeader } from "@/app/_components/deck-home";
import { listChatsForDeck } from "@/lib/chats";
import { getDeckWithDetail } from "@/lib/decks";

// A deck's "project" page: deck info from OUR store (refreshed from Archidekt on
// a TTL) plus the conversations bound to it. Falls back to the cached deck info
// from existing chats if the deck isn't in the store yet.
export default async function DeckPage({ params }: { params: Promise<{ deckId: string }> }) {
  const { userId } = await auth();
  if (!userId) notFound();

  const { deckId } = await params;
  const [deck, chats] = await Promise.all([
    getDeckWithDetail(userId, deckId),
    listChatsForDeck(userId, deckId),
  ]);

  // Unknown deck: not in our store and no history to fall back on.
  if (!deck && chats.length === 0) notFound();

  const cached = chats[0]?.deck;
  const header: DeckHeader = {
    id: deckId,
    name: deck?.name ?? cached?.name ?? "Deck",
    colors: deck?.colors ?? cached?.colors ?? [],
    commanders: deck?.commanders ?? [],
    totalCards: deck?.decklistText ? (deck.size ?? null) : null,
    hasDecklist: !!deck?.decklistText,
  };

  return (
    <DeckHome
      chats={chats.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt }))}
      deck={header}
    />
  );
}
