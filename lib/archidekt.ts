// Server-only Archidekt account integration.
// Logs in via Archidekt's (unofficial) dj-rest-auth JWT endpoint, stores the
// token in the signed-in user's Clerk privateMetadata, and makes authed calls
// (including the user's private/unlisted decks). The user's password is never
// stored — only the resulting JWT.
import "server-only";
import { auth, clerkClient } from "@clerk/nextjs/server";

const API = "https://archidekt.com/api";
const UA = "mtg-commander-agent/0.1 (eve agent; deckbuilding assistant)";

export interface ArchidektConn {
  token: string;
  refreshToken?: string;
  userId: number;
  username: string;
  connectedAt: string;
}

/** Exchange Archidekt credentials for a JWT + the account's id/username. */
export async function loginArchidekt(
  identifier: string,
  password: string,
): Promise<Omit<ArchidektConn, "connectedAt">> {
  // Archidekt's login accepts `username` or `email`; route by whether it's an email.
  const isEmail = identifier.includes("@");
  const body = isEmail ? { email: identifier, password } : { username: identifier, password };

  const res = await fetch(`${API}/rest-auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": UA },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}) as Record<string, unknown>);
    const msg =
      (Array.isArray(err.non_field_errors) && err.non_field_errors[0]) ||
      err.detail ||
      `Archidekt login failed (HTTP ${res.status}).`;
    throw new Error(String(msg));
  }

  const data = await res.json();
  // dj-rest-auth field names vary across versions; accept the common shapes.
  const token = data.access ?? data.access_token ?? data.key;
  const refreshToken = data.refresh ?? data.refresh_token;
  if (!token) throw new Error("Archidekt did not return an auth token.");

  // Resolve the account's numeric id + username for later deck queries.
  let userId: number | undefined = data.user?.id;
  let username: string | undefined = data.user?.username;
  if (!userId) {
    const me = await fetch(`${API}/rest-auth/user/`, {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": UA },
    });
    if (me.ok) {
      const u = await me.json();
      userId = u.id;
      username = u.username ?? username;
    }
  }
  if (!userId) throw new Error("Could not resolve your Archidekt account id.");

  return { token, refreshToken, userId, username: username ?? identifier };
}

async function refreshAccess(conn: ArchidektConn): Promise<string | null> {
  if (!conn.refreshToken) return null;
  const res = await fetch(`${API}/rest-auth/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": UA },
    body: JSON.stringify({ refresh: conn.refreshToken }),
  });
  if (!res.ok) return null;
  const d = await res.json();
  return d.access ?? d.access_token ?? null;
}

/** Authed GET against Archidekt, refreshing the JWT once on 401/403. */
export async function archidektGet(conn: ArchidektConn, path: string): Promise<Response> {
  const call = (token: string) =>
    fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}`, "User-Agent": UA } });

  let res = await call(conn.token);
  if (res.status === 401 || res.status === 403) {
    const next = await refreshAccess(conn);
    if (next) {
      conn.token = next;
      await storeConn(conn); // persist the refreshed token
      res = await call(next);
    }
  }
  return res;
}

export interface DeckSummary {
  id: number;
  name: string;
  size: number;
  colors: string[];
  bracket: number | null;
  updatedAt: string;
  private: boolean;
  unlisted: boolean;
  featured: string | null;
}

/**
 * The signed-in user's Commander decks (public + private), newest first.
 * Returns null when Archidekt isn't connected or is unreachable, so callers can
 * fall back to our own stored copy.
 */
export async function fetchDeckSummaries(): Promise<DeckSummary[] | null> {
  const conn = await getStoredConn();
  if (!conn) return null;

  // deckFormat=3 is Commander/EDH. ownerUsername (not owner) actually filters;
  // with the user's own token this also surfaces their private/unlisted decks.
  const res = await archidektGet(
    conn,
    `/decks/v3/?ownerUsername=${encodeURIComponent(conn.username)}&deckFormat=3&orderBy=-updatedAt&pageSize=50`,
  );
  if (!res.ok) return null;
  const data = await res.json();
  return (data.results ?? []).map((d: Record<string, unknown>) => ({
    id: d.id as number,
    name: (d.name as string) ?? "Untitled",
    size: (d.size as number) ?? 0,
    colors: (d.colors as string[]) ?? [],
    bracket: (d.edhBracket as number) ?? null,
    updatedAt: (d.updatedAt as string) ?? "",
    private: Boolean(d.private),
    unlisted: Boolean(d.unlisted),
    featured: typeof d.featured === "string" && d.featured ? (d.featured as string) : null,
  }));
}

export interface DeckDetail {
  id: number;
  name: string;
  commanders: string[];
  colors: string[];
  totalCards: number;
  decklistText: string;
}

/**
 * One deck's commander(s), color identity, and a plain-text decklist ready for
 * the agent. Returns null when Archidekt isn't connected or the fetch fails, so
 * callers can degrade gracefully. Used by both the API route and server pages.
 */
export async function fetchDeckDetail(id: string): Promise<DeckDetail | null> {
  if (!/^\d+$/.test(id)) return null;
  const conn = await getStoredConn();
  if (!conn) return null;

  const res = await archidektGet(conn, `/decks/${id}/`);
  if (!res.ok) return null;
  const data = await res.json();

  const entries: { qty: number; name: string; isCommander: boolean }[] = (data.cards ?? []).map(
    (c: Record<string, unknown>) => {
      const oracle = (c.card as Record<string, unknown>)?.oracleCard as Record<string, unknown>;
      const categories = (c.categories as string[]) ?? [];
      return {
        qty: (c.quantity as number) ?? 1,
        name: (oracle?.name as string) ?? "Unknown",
        isCommander: categories.includes("Commander"),
      };
    },
  );

  return {
    id: Number(id),
    name: (data.name as string) ?? "Untitled deck",
    commanders: entries.filter((e) => e.isCommander).map((e) => e.name),
    colors: Array.isArray(data.colors) ? (data.colors as string[]) : [],
    totalCards: entries.reduce((n, e) => n + e.qty, 0),
    decklistText: entries.map((e) => `${e.qty} ${e.name}`).join("\n"),
  };
}

// --- Clerk privateMetadata storage (per signed-in user) ---

export async function getStoredConn(): Promise<ArchidektConn | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  return (user.privateMetadata?.archidekt as ArchidektConn | undefined) ?? null;
}

export async function storeConn(conn: ArchidektConn): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in.");
  const client = await clerkClient();
  await client.users.updateUserMetadata(userId, { privateMetadata: { archidekt: conn } });
}

export async function clearConn(): Promise<void> {
  const { userId } = await auth();
  if (!userId) return;
  const client = await clerkClient();
  await client.users.updateUserMetadata(userId, { privateMetadata: { archidekt: null } });
}
