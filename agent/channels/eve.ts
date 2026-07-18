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
function clerkAuth(): AuthFn<Request> {
  return async (request) => {
    const token = extractBearerToken(request.headers.get("authorization"));
    if (!token) {
      throw new UnauthenticatedError({
        message: "No sign-in token on the request. If you just loaded the page, wait a moment and retry.",
      });
    }

    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
      throw new UnauthenticatedError({
        message: "Server is missing CLERK_SECRET_KEY for this environment.",
      });
    }

    // Optional but recommended: restrict to your own origins (azp check).
    // When configured, also allow this deployment's own Vercel URLs so the
    // check doesn't reject preview deployments, whose origin is generated
    // per-branch/per-deploy and can't be listed ahead of time.
    const configuredParties = process.env.CLERK_AUTHORIZED_PARTIES
      ? process.env.CLERK_AUTHORIZED_PARTIES.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;
    const ownOrigins = [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]
      .filter((h): h is string => !!h)
      .map((host) => `https://${host}`);
    const authorizedParties = configuredParties
      ? [...configuredParties, ...ownOrigins]
      : undefined;

    let result: {
      sub?: string;
      email?: unknown;
      data?: { sub?: string; email?: unknown };
      errors?: unknown;
    };
    try {
      // @clerk/backend 3.x returns the JWT payload directly (and throws on
      // invalid tokens); newer versions return { data, errors }. Handle both.
      result = (await verifyToken(token, { secretKey, authorizedParties })) as typeof result;
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
