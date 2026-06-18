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
