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
    .map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt }));
}

/** Create a new chat (metadata + messages) and index it for the user. */
export async function createChat(
  userId: string,
  data: ChatCursor & { title: string; messages?: unknown[] },
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
  await r.set(metaKey(record.id), record);
  if (data.messages) await r.set(msgsKey(record.id), data.messages);
  await r.zadd(userIndexKey(userId), { score: now, member: record.id });
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
