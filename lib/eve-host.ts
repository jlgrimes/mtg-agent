// Where the browser reaches the eve agent.
//
// Production: the standalone agent deployment (its own Vercel project —
// the co-deployed "services" routing dropped eve's parameterized routes,
// so the agent runs separately). NEXT_PUBLIC_EVE_HOST overrides at build
// time if the agent ever moves.
//
// Local dev: empty string → same-origin, proxied to the eve dev server by
// withEve.
export const EVE_HOST =
  process.env.NEXT_PUBLIC_EVE_HOST ??
  (process.env.NODE_ENV === "production" ? "https://mtg-agent-agent.vercel.app" : "");
