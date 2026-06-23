// Server-only deck store (Upstash Redis): our own copy of the user's Archidekt
// decks. Everything in the app reads decks from HERE — Archidekt is only touched
// by the sync paths below, so the app keeps working if Archidekt is unreachable.
import "server-only";
import { Redis } from "@upstash/redis";
import { fetchDeckDetail, fetchDeckSummaries } from "@/lib/archidekt";

// One stored deck: summary fields (always synced) plus the decklist/commanders
// (filled lazily the first time a deck is opened, then kept fresh on a TTL).
export interface StoredDeck {
  id: string;
  name: string;
  size: number;
  colors: string[];
  bracket: number | null;
  private: boolean;
  unlisted: boolean;
  featured: string | null;
  updatedAt: string; // Archidekt's deck-edited timestamp
  commanders?: string[];
  decklistText?: string;
  detailSyncedAt?: number; // when we last pulled the decklist
  summarySyncedAt: number; // when this card was last summary-synced
}

// How long a stored decklist is considered fresh before an on-open refresh.
const DETAIL_TTL_MS = 15 * 60 * 1000;

let client: Redis | null = null;
function redis(): Redis {
  if (!client) client = Redis.fromEnv();
  return client;
}

const deckKey = (userId: string, deckId: string) => `deck:${userId}:${deckId}`;
const indexKey = (userId: string) => `user:${userId}:decks`;
const metaKey = (userId: string) => `user:${userId}:decksMeta`;

async function putDeck(userId: string, deck: StoredDeck): Promise<void> {
  const r = redis();
  await r.set(deckKey(userId, deck.id), deck);
  const score = Date.parse(deck.updatedAt) || deck.summarySyncedAt;
  await r.zadd(indexKey(userId), { score, member: deck.id });
}

/** Read all of a user's stored decks, newest-updated first. */
export async function listStoredDecks(userId: string): Promise<StoredDeck[]> {
  const r = redis();
  const ids = await r.zrange<string[]>(indexKey(userId), 0, -1, { rev: true });
  if (!ids.length) return [];
  const decks = await Promise.all(ids.map((id) => r.get<StoredDeck>(deckKey(userId, id))));
  return decks.filter((d): d is StoredDeck => !!d);
}

/** When the user's decks were last summary-synced (ms epoch), or null. */
export async function getDecksSyncedAt(userId: string): Promise<number | null> {
  const meta = await redis().get<{ syncedAt: number }>(metaKey(userId));
  return meta?.syncedAt ?? null;
}

export async function getStoredDeck(userId: string, deckId: string): Promise<StoredDeck | null> {
  return (await redis().get<StoredDeck>(deckKey(userId, deckId))) ?? null;
}

/**
 * Pull fresh deck summaries from Archidekt into our store (upserting, preserving
 * each deck's cached decklist) and prune decks that no longer exist upstream.
 * On an Archidekt failure it leaves the store untouched and returns what we have.
 */
export async function syncDecks(userId: string): Promise<StoredDeck[]> {
  const summaries = await fetchDeckSummaries();
  if (!summaries) return listStoredDecks(userId); // offline / not connected → keep DB

  const now = Date.now();
  const r = redis();
  const existing = await listStoredDecks(userId);
  const existingById = new Map(existing.map((d) => [d.id, d]));
  const nextIds = new Set(summaries.map((s) => String(s.id)));

  for (const s of summaries) {
    const id = String(s.id);
    const prev = existingById.get(id);
    await putDeck(userId, {
      id,
      name: s.name,
      size: s.size,
      colors: s.colors,
      bracket: s.bracket,
      private: s.private,
      unlisted: s.unlisted,
      featured: s.featured,
      updatedAt: s.updatedAt,
      // Preserve the cached decklist across summary syncs.
      commanders: prev?.commanders,
      decklistText: prev?.decklistText,
      detailSyncedAt: prev?.detailSyncedAt,
      summarySyncedAt: now,
    });
  }

  // Drop decks deleted on Archidekt (their chats still survive via chat snapshots).
  const removed = existing.filter((d) => !nextIds.has(d.id));
  if (removed.length) {
    await r.del(...removed.map((d) => deckKey(userId, d.id)));
    await r.zrem(indexKey(userId), ...removed.map((d) => d.id));
  }

  await r.set(metaKey(userId), { syncedAt: now });
  return listStoredDecks(userId);
}

/**
 * A deck with its decklist, read from our store. Refreshes the decklist from
 * Archidekt when it's missing or stale (or when forced), then writes it back.
 * If Archidekt is unreachable, returns whatever we already have.
 */
export async function getDeckWithDetail(
  userId: string,
  deckId: string,
  opts: { refresh?: boolean } = {},
): Promise<StoredDeck | null> {
  const existing = await getStoredDeck(userId, deckId);
  const fresh =
    existing?.decklistText &&
    existing.detailSyncedAt &&
    Date.now() - existing.detailSyncedAt < DETAIL_TTL_MS;
  if (existing && fresh && !opts.refresh) return existing;

  const detail = await fetchDeckDetail(deckId);
  if (!detail) return existing; // offline → serve cached (may lack decklist)

  const merged: StoredDeck = {
    id: deckId,
    name: detail.name,
    size: detail.totalCards || existing?.size || 0,
    colors: detail.colors.length ? detail.colors : (existing?.colors ?? []),
    bracket: existing?.bracket ?? null,
    private: existing?.private ?? false,
    unlisted: existing?.unlisted ?? false,
    featured: existing?.featured ?? null,
    updatedAt: existing?.updatedAt ?? "",
    commanders: detail.commanders,
    decklistText: detail.decklistText,
    detailSyncedAt: Date.now(),
    summarySyncedAt: existing?.summarySyncedAt ?? Date.now(),
  };
  await putDeck(userId, merged);
  return merged;
}
