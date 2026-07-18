import { eveChannel } from "eve/channels/eve";
import {
  type AuthFn,
  extractBearerToken,
  localDev,
  UnauthenticatedError,
} from "eve/channels/auth";
import { verifyToken } from "@clerk/backend";

// Verifies the Clerk session token the browser attaches as a Bearer header.
// The web app gets the token from Clerk's useAuth().getToken() and passes it to
// useEveAgent({ auth: { bearer } }), so every agent request carries the caller's
// identity.
//
// This is the LAST entry in the auth walk, so instead of silently returning
// null (which yields a generic 401), it throws UnauthenticatedError with the
// specific rejection reason — the chat UI surfaces that message directly,
// making auth failures diagnosable from the error banner alone.
// The Clerk instance this app authenticates against. This is PUBLIC
// information (it's embedded in the publishable key the browser already
// ships), and its JWKS endpoint serves public signing keys — so the agent
// can verify session tokens networklessly without CLERK_SECRET_KEY.
const CLERK_INSTANCE = "glorious-eel-58.clerk.accounts.dev";

// The web origins allowed to mint tokens for this agent (azp claim).
// CLERK_AUTHORIZED_PARTIES env overrides; these are the known web app
// domains plus local dev.
const DEFAULT_AUTHORIZED_PARTIES = [
  "https://mtg-agent-sand.vercel.app",
  "https://mtg-agent-qrtz.vercel.app",
  "http://localhost:3000",
];

// Fetch Clerk's public JWKS once and convert the signing key to PEM for
// @clerk/backend's networkless `jwtKey` verification path.
let cachedPems: Map<string, string> | null = null;
async function clerkPublicKeyPem(tokenKid: string | undefined): Promise<string> {
  if (!cachedPems) {
    const res = await fetch(`https://${CLERK_INSTANCE}/.well-known/jwks.json`);
    if (!res.ok) throw new Error(`JWKS fetch failed (HTTP ${res.status})`);
    const jwks = (await res.json()) as { keys?: Array<Record<string, unknown>> };
    const { createPublicKey } = await import("node:crypto");
    cachedPems = new Map(
      (jwks.keys ?? []).map((jwk) => [
        String(jwk.kid ?? ""),
        createPublicKey({ key: jwk as never, format: "jwk" })
          .export({ type: "spki", format: "pem" })
          .toString(),
      ]),
    );
  }
  const pem = (tokenKid ? cachedPems.get(tokenKid) : undefined) ?? [...cachedPems.values()][0];
  if (!pem) throw new Error("no signing keys in Clerk JWKS");
  return pem;
}

function tokenKid(token: string): string | undefined {
  try {
    const header = JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString());
    return typeof header.kid === "string" ? header.kid : undefined;
  } catch {
    return undefined;
  }
}

function clerkAuth(): AuthFn<Request> {
  return async (request) => {
    const token = extractBearerToken(request.headers.get("authorization"));
    if (!token) {
      throw new UnauthenticatedError({
        message: "No sign-in token on the request. If you just loaded the page, wait a moment and retry.",
      });
    }

    // Restrict to our own origins (azp check), plus this deployment's own
    // Vercel URLs so previews aren't rejected.
    const configuredParties = process.env.CLERK_AUTHORIZED_PARTIES
      ? process.env.CLERK_AUTHORIZED_PARTIES.split(",").map((s) => s.trim()).filter(Boolean)
      : DEFAULT_AUTHORIZED_PARTIES;
    const ownOrigins = [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]
      .filter((h): h is string => !!h)
      .map((host) => `https://${host}`);
    const authorizedParties = [...configuredParties, ...ownOrigins];

    // Prefer the secret key when configured; otherwise verify networklessly
    // against the instance's public JWKS (no env vars required).
    const secretKey = process.env.CLERK_SECRET_KEY;
    let verifyOptions: { secretKey: string } | { jwtKey: string };
    if (secretKey) {
      verifyOptions = { secretKey };
    } else {
      try {
        verifyOptions = { jwtKey: await clerkPublicKeyPem(tokenKid(token)) };
      } catch (e) {
        const reason = e instanceof Error ? e.message : "unknown error";
        throw new UnauthenticatedError({
          message: `Could not load Clerk signing keys: ${reason}`,
        });
      }
    }

    let result: {
      sub?: string;
      email?: unknown;
      data?: { sub?: string; email?: unknown };
      errors?: unknown;
    };
    try {
      // @clerk/backend 3.x returns the JWT payload directly (and throws on
      // invalid tokens); newer versions return { data, errors }. Handle both.
      result = (await verifyToken(token, { ...verifyOptions, authorizedParties })) as typeof result;
    } catch (e) {
      const reason = e instanceof Error ? e.message.slice(0, 160) : "unknown error";
      throw new UnauthenticatedError({ message: `Clerk rejected the sign-in token: ${reason}` });
    }
    if (result.errors) {
      throw new UnauthenticatedError({
        message: `Clerk rejected the sign-in token: ${JSON.stringify(result.errors).slice(0, 160)}`,
      });
    }
    const claims = (result.data ?? result) as { sub?: string; email?: unknown };
    if (!claims?.sub) {
      throw new UnauthenticatedError({
        message: "Clerk token verified but carried no user id (sub claim).",
      });
    }
    const attributes: Record<string, string> = {};
    if (typeof claims.email === "string") attributes.email = claims.email;
    return {
      authenticator: "clerk",
      principalId: claims.sub, // Clerk user id (e.g. "user_2ab...")
      principalType: "user",
      attributes,
    };
  };
}

export default eveChannel({
  // The agent deploys as its own Vercel project; the web app calls it
  // cross-origin from the browser. Permissive CORS is fine here because
  // every session route still requires a verified Clerk bearer token —
  // CORS isn't the auth boundary, clerkAuth() is.
  cors: true,
  auth: [
    // Open on localhost for `eve dev` and the REPL; ignored in production.
    localDev(),
    // Production browser traffic: require a valid signed-in Clerk user.
    clerkAuth(),
  ],
});
