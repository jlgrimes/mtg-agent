import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getDecksSyncedAt, syncDecks } from "@/lib/decks";

// POST -> pull fresh deck summaries from Archidekt into our store, then return
// the updated list. Survives Archidekt outages (leaves the store as-is).
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  try {
    const decks = await syncDecks(userId);
    const syncedAt = await getDecksSyncedAt(userId);
    return NextResponse.json({ decks, syncedAt });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to sync decks." },
      { status: 502 },
    );
  }
}
