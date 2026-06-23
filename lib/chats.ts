// Server-only chat history store (Upstash Redis).
// Stores per-chat: a small metadata record (eve session cursor + title) and,
// separately, the rendered message list. Storing the messages lets a chat open
// instantly from one Redis read instead of replaying eve's durable session.
import "server-only";
import { Redis } from "@upstash/redis";
import { nanoid } from "nanoid";

export interface ChatCursor {
  sessionId: string;
  continuationToken: string;
  streamIndex?: number;
}

// A snapshot of the deck a chat is bound to, captured at creation and never
// changed. `id` is the Archidekt deck id (string) or null for pasted/manual
// lists. The decklist snapshot lets the agent reason about the deck on every
// turn without re-fetching Archidekt (and works even if it's later disconnected).
export interface ChatDeck {
  id: string | null;
  name: string;
  commanders: string[];
  colors: string[];
  decklistText: string;
}

export interface ChatRecord extends ChatCursor {
  id: string;
  userId: string;
  title: string;
  deck?: ChatDeck;
  createdAt: number;
  updatedAt: number;
}

// Lightweight deck info carried on summaries so the sidebar can group chats by
// deck without loading every full record's decklist.
export type ChatDeckRef = Pick<ChatDeck, "id" | "name" | "colors">;
export type ChatSummary = Pick<ChatRecord, "id" | "title" | "updatedAt"> & {
  deck?: ChatDeckRef;
};

// A deck that has at least one conversation (derived from chats, not Archidekt).
export interface DeckGroup {
  id: string;
  name: string;
  colors: string[];
  chatCount: number;
  updatedAt: number;
}

let client: Redis | null = null;
function redis(): Redis {
  if (!client) client = Redis.fromEnv();
  return client;
}

const metaKey = (id: string) => `chat:${id}`;
const msgsKey = (id: string) => `chat:${id}:msgs`;
const userIndexKey = (userId: string) => `user:${userId}:chats`;

/** List a user's chats (metadata only — fast), newest-updated first. */
export async function listChats(userId: string): Promise<ChatSummary[]> {
  const r = redis();
  const ids = await r.zrange<string[]>(userIndexKey(userId), 0, -1, { rev: true });
  if (!ids.length) return [];
  const records = await Promise.all(ids.map((id) => r.get<ChatRecord>(metaKey(id))));
  return records
    .filter((c): c is ChatRecord => !!c && c.userId === userId)
    .map((c) => ({
      id: c.id,
      title: c.title,
      updatedAt: c.updatedAt,
      deck: c.deck ? { id: c.deck.id, name: c.deck.name, colors: c.deck.colors } : undefined,
    }));
}

/** A user's chats for one Archidekt deck (newest-updated first). */
export async function listChatsForDeck(userId: string, deckId: string): Promise<ChatSummary[]> {
  const chats = await listChats(userId);
  return chats.filter((c) => c.deck?.id === deckId);
}

/**
 * The full deck snapshot (incl. decklist) from this deck's newest chat, if any.
 * Lets a new deck chat reuse a stored decklist when Archidekt is unreachable.
 */
export async function getDeckSnapshot(userId: string, deckId: string): Promise<ChatDeck | null> {
  const chats = await listChatsForDeck(userId, deckId);
  if (!chats.length) return null;
  const record = await getChat(userId, chats[0].id);
  return record?.deck ?? null;
}

/**
 * Sidebar data: the decks the user has conversations with (grouped) plus any
 * chats not bound to an Archidekt deck ("General"). Pasted/manual decks have a
 * null id and fall into General since they have no deck page.
 */
export async function getSidebarData(
  userId: string,
): Promise<{ decks: DeckGroup[]; general: ChatSummary[]; chatDeckMap: Record<string, string> }> {
  const chats = await listChats(userId); // newest-updated first
  const byDeck = new Map<string, DeckGroup>();
  const general: ChatSummary[] = [];
  const chatDeckMap: Record<string, string> = {};
  for (const c of chats) {
    const id = c.deck?.id;
    if (!id) {
      general.push(c);
      continue;
    }
    chatDeckMap[c.id] = id;
    const existing = byDeck.get(id);
    if (existing) {
      existing.chatCount += 1;
    } else {
      // First occurrence is the newest chat, so it seeds the display name/colors.
      byDeck.set(id, {
        id,
        name: c.deck?.name ?? "Untitled deck",
        colors: c.deck?.colors ?? [],
        chatCount: 1,
        updatedAt: c.updatedAt,
      });
    }
  }
  return { decks: [...byDeck.values()], general, chatDeckMap };
}

/** Create a new chat (metadata + messages) and index it for the user. */
export async function createChat(
  userId: string,
  data: ChatCursor & { title: string; deck?: ChatDeck; messages?: unknown[] },
): Promise<ChatRecord> {
  const now = Date.now();
  const record: ChatRecord = {
    id: nanoid(12),
    userId,
    title: data.title.slice(0, 120) || "New chat",
    deck: data.deck,
    sessionId: data.sessionId,
    continuationToken: data.continuationToken,
    streamIndex: data.streamIndex,
    createdAt: now,
    updatedAt: now,
  };
  const r = redis();
  // Write metadata + index first so the chat always exists/lists, then store
  // messages best-effort (a messages failure must not lose the chat).
  await r.set(metaKey(record.id), record);
  await r.zadd(userIndexKey(userId), { score: now, member: record.id });
  if (data.messages) {
    try {
      await r.set(msgsKey(record.id), data.messages);
    } catch (e) {
      console.error("createChat: failed to store messages", e);
    }
  }
  return record;
}

/** Fetch a chat's metadata, enforcing ownership. */
export async function getChat(userId: string, id: string): Promise<ChatRecord | null> {
  const c = await redis().get<ChatRecord>(metaKey(id));
  if (!c || c.userId !== userId) return null;
  return c;
}

/** Fetch a chat's stored messages (after an ownership check). */
export async function getChatMessages(userId: string, id: string): Promise<unknown[]> {
  const meta = await getChat(userId, id);
  if (!meta) return [];
  return (await redis().get<unknown[]>(msgsKey(id))) ?? [];
}

/** Patch a chat's title, cursor, and/or messages; bumps updatedAt + reorders. */
export async function updateChat(
  userId: string,
  id: string,
  patch: Partial<Pick<ChatRecord, "title">> & Partial<ChatCursor> & { messages?: unknown[] },
): Promise<ChatRecord | null> {
  const existing = await getChat(userId, id);
  if (!existing) return null;
  const now = Date.now();
  const { messages, ...meta } = patch;
  const updated: ChatRecord = {
    ...existing,
    ...meta,
    title: patch.title ? patch.title.slice(0, 120) : existing.title,
    updatedAt: now,
  };
  const r = redis();
  await r.set(metaKey(id), updated);
  if (messages) await r.set(msgsKey(id), messages);
  await r.zadd(userIndexKey(userId), { score: now, member: id });
  return updated;
}

/** Delete a chat (metadata + messages) and remove it from the user's index. */
export async function deleteChat(userId: string, id: string): Promise<boolean> {
  const existing = await getChat(userId, id);
  if (!existing) return false;
  const r = redis();
  await r.del(metaKey(id), msgsKey(id));
  await r.zrem(userIndexKey(userId), id);
  return true;
}
