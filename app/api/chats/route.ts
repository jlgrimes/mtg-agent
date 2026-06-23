import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { type ChatDeck, createChat, listChats } from "@/lib/chats";

// Coerce an untrusted request body into a ChatDeck snapshot (or undefined).
function parseDeck(raw: unknown): ChatDeck | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const d = raw as Record<string, unknown>;
  if (typeof d.name !== "string" || typeof d.decklistText !== "string") return undefined;
  return {
    id: typeof d.id === "string" ? d.id : null,
    name: d.name.slice(0, 200),
    commanders: Array.isArray(d.commanders) ? d.commanders.map(String).slice(0, 4) : [],
    colors: Array.isArray(d.colors) ? d.colors.map(String).slice(0, 5) : [],
    decklistText: d.decklistText.slice(0, 20000),
  };
}

// GET -> the signed-in user's chats (newest first).
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  try {
    const chats = await listChats(userId);
    return NextResponse.json({ chats });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load chats." },
      { status: 500 },
    );
  }
}

// POST { title, sessionId, continuationToken, streamIndex? } -> create a chat.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.sessionId) {
    return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
  }
  try {
    const chat = await createChat(userId, {
      title: String(body.title ?? "New chat"),
      deck: parseDeck(body.deck),
      sessionId: String(body.sessionId),
      continuationToken: String(body.continuationToken ?? ""),
      streamIndex: typeof body.streamIndex === "number" ? body.streamIndex : undefined,
      messages: Array.isArray(body.messages) ? body.messages : undefined,
    });
    return NextResponse.json({ chat });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create chat." },
      { status: 500 },
    );
  }
}
