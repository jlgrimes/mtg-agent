import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getDecksSyncedAt, listStoredDecks } from "@/lib/decks";

// GET -> the user's decks from OUR store (never hits Archidekt). Returns the
// last sync time so the UI can offer a refresh.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  try {
    const [decks, syncedAt] = await Promise.all([
      listStoredDecks(userId),
      getDecksSyncedAt(userId),
    ]);
    return NextResponse.json({ decks, syncedAt });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load decks." },
      { status: 500 },
    );
  }
}
