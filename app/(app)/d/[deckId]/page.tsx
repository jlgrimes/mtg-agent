import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { DeckHome, type DeckHeader } from "@/app/_components/deck-home";
import { fetchDeckDetail } from "@/lib/archidekt";
import { listChatsForDeck } from "@/lib/chats";

// A deck's "project" page: live Archidekt detail (when connected) plus the
// conversations already bound to this deck. Falls back to the cached deck info
// from existing chats when Archidekt is disconnected/unreachable.
export default async function DeckPage({ params }: { params: Promise<{ deckId: string }> }) {
  const { userId } = await auth();
  if (!userId) notFound();

  const { deckId } = await params;
  const [detail, chats] = await Promise.all([
    fetchDeckDetail(deckId),
    listChatsForDeck(userId, deckId),
  ]);

  // Unknown deck: no live data and no history to fall back on.
  if (!detail && chats.length === 0) notFound();

  const cached = chats[0]?.deck;
  const header: DeckHeader = {
    id: deckId,
    name: detail?.name ?? cached?.name ?? "Deck",
    colors: detail?.colors ?? cached?.colors ?? [],
    commanders: detail?.commanders ?? [],
    totalCards: detail?.totalCards ?? null,
    connected: !!detail,
  };

  return (
    <DeckHome
      chats={chats.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt }))}
      deck={header}
    />
  );
}
