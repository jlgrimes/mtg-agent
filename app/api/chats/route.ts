import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createChat, listChats } from "@/lib/chats";

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
  if (!body?.sessionId || !body?.continuationToken) {
    return NextResponse.json({ error: "sessionId and continuationToken are required." }, { status: 400 });
  }
  try {
    const chat = await createChat(userId, {
      title: String(body.title ?? "New chat"),
      sessionId: String(body.sessionId),
      continuationToken: String(body.continuationToken),
      streamIndex: typeof body.streamIndex === "number" ? body.streamIndex : undefined,
    });
    return NextResponse.json({ chat });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create chat." },
      { status: 500 },
    );
  }
}
