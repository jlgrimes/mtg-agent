import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { deleteChat, getChat, getChatMessages, updateChat } from "@/lib/chats";

// GET -> one chat's record (cursor to continue) plus its stored messages so the
// UI can render the conversation instantly without replaying eve's session.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await ctx.params;
  const chat = await getChat(userId, id);
  if (!chat) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const messages = await getChatMessages(userId, id);
  return NextResponse.json({ chat, messages });
}

// PATCH { title?, sessionId?, continuationToken?, streamIndex? } -> update a chat.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const chat = await updateChat(userId, id, {
    title: typeof body.title === "string" ? body.title : undefined,
    sessionId: typeof body.sessionId === "string" ? body.sessionId : undefined,
    continuationToken:
      typeof body.continuationToken === "string" ? body.continuationToken : undefined,
    streamIndex: typeof body.streamIndex === "number" ? body.streamIndex : undefined,
    messages: Array.isArray(body.messages) ? body.messages : undefined,
  });
  if (!chat) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ chat });
}

// DELETE -> remove a chat.
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await ctx.params;
  const ok = await deleteChat(userId, id);
  return NextResponse.json({ deleted: ok }, { status: ok ? 200 : 404 });
}
