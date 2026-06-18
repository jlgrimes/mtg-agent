import { eveChannel } from "eve/channels/eve";
import { type AuthFn, extractBearerToken, localDev } from "eve/channels/auth";
import { verifyToken } from "@clerk/backend";

// Verifies the Clerk session token the browser attaches as a Bearer header.
// The web app gets the token from Clerk's useAuth().getToken() and passes it to
// useEveAgent({ auth: { bearer } }), so every agent request carries the caller's
// identity. Anyone without a valid Clerk session falls through to a 401.
function clerkAuth(): AuthFn<Request> {
  return async (request) => {
    const token = extractBearerToken(request.headers.get("authorization"));
    if (!token) return null;

    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) return null; // not configured yet -> skip (fails closed downstream)

    // Optional but recommended: restrict to your own origins (azp check).
    const authorizedParties = process.env.CLERK_AUTHORIZED_PARTIES
      ? process.env.CLERK_AUTHORIZED_PARTIES.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;

    try {
      const result = await verifyToken(token, { secretKey, authorizedParties });
      if (result.errors) return null;
      const claims = result.data as { sub?: string; email?: unknown } | undefined;
      if (!claims?.sub) return null;
      const attributes: Record<string, string> = {};
      if (typeof claims.email === "string") attributes.email = claims.email;
      return {
        authenticator: "clerk",
        principalId: claims.sub, // Clerk user id (e.g. "user_2ab...")
        principalType: "user",
        attributes,
      };
    } catch {
      return null; // network/verify failure -> skip; request gets 401
    }
  };
}

export default eveChannel({
  auth: [
    // Open on localhost for `eve dev` and the REPL; ignored in production.
    localDev(),
    // Production browser traffic: require a valid signed-in Clerk user.
    clerkAuth(),
  ],
});
