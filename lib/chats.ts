// Server-only chat history store (Upstash Redis).
// We persist only a tiny per-chat record: the eve session resume handles
// (sessionId + continuationToken) plus a title and timestamps. The full message
// history lives in eve's durable session and is replayed on resume — we never
// store message content here.
import "server-only";
import { Redis } from "@upstash/redis";
import { nanoid } from "nanoid";

export interface ChatCursor {
  sessionId: string;
  continuationToken: string;
  streamIndex?: number;
}

export interface ChatRecord extends ChatCursor {
  id: string;
  userId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export type ChatSummary = Pick<ChatRecord, "id" | "title" | "updatedAt">;

let client: Redis | null = null;
function redis(): Redis {
  if (!client) {
    // Reads UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN. Lazy so the build
    // doesn't fail when env isn't present at module-eval time.
    client = Redis.fromEnv();
  }
  return client;
}

const chatKey = (id: string) => `chat:${id}`;
const userIndexKey = (userId: string) => `user:${userId}:chats`;

/** List a user's chats, newest-updated first. */
export async function listChats(userId: string): Promise<ChatSummary[]> {
  const r = redis();
  const ids = await r.zrange<string[]>(userIndexKey(userId), 0, -1, { rev: true });
  if (!ids.length) return [];
  const records = await Promise.all(ids.map((id) => r.get<ChatRecord>(chatKey(id))));
  return records
    .filter((c): c is ChatRecord => !!c && c.userId === userId)
    .map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt }));
}

/** Create a new chat record and index it for the user. */
export async function createChat(
  userId: string,
  data: ChatCursor & { title: string },
): Promise<ChatRecord> {
  const now = Date.now();
  const record: ChatRecord = {
    id: nanoid(12),
    userId,
    title: data.title.slice(0, 120) || "New chat",
    sessionId: data.sessionId,
    continuationToken: data.continuationToken,
    streamIndex: data.streamIndex,
    createdAt: now,
    updatedAt: now,
  };
  const r = redis();
  await r.set(chatKey(record.id), record);
  await r.zadd(userIndexKey(userId), { score: now, member: record.id });
  return record;
}

/** Fetch a single chat, enforcing ownership. */
export async function getChat(userId: string, id: string): Promise<ChatRecord | null> {
  const c = await redis().get<ChatRecord>(chatKey(id));
  if (!c || c.userId !== userId) return null;
  return c;
}

/** Patch a chat's title and/or session cursor; bumps updatedAt + reorders. */
export async function updateChat(
  userId: string,
  id: string,
  patch: Partial<Pick<ChatRecord, "title">> & Partial<ChatCursor>,
): Promise<ChatRecord | null> {
  const existing = await getChat(userId, id);
  if (!existing) return null;
  const now = Date.now();
  const updated: ChatRecord = {
    ...existing,
    ...patch,
    title: patch.title ? patch.title.slice(0, 120) : existing.title,
    updatedAt: now,
  };
  const r = redis();
  await r.set(chatKey(id), updated);
  await r.zadd(userIndexKey(userId), { score: now, member: id });
  return updated;
}

/** Delete a chat and remove it from the user's index. */
export async function deleteChat(userId: string, id: string): Promise<boolean> {
  const existing = await getChat(userId, id);
  if (!existing) return false;
  const r = redis();
  await r.del(chatKey(id));
  await r.zrem(userIndexKey(userId), id);
  return true;
}
