import type { NextConfig } from "next";
import { withEve } from "eve/next";

const nextConfig: NextConfig = {};

// Split-deployment topology: in production the eve agent runs as its OWN
// Vercel project (built with `eve build`), and the browser talks to it
// directly via NEXT_PUBLIC_EVE_HOST. Vercel's Build-Output "services" merge
// — the co-deployment path withEve uses — drops every non-literal eve route
// (session stream/continue), which broke chat, so the web app no longer
// co-deploys the agent at all.
//
// Local dev keeps withEve: it boots the eve dev server next to `next dev`
// and proxies /eve/v1/* same-origin.
// On Vercel (or with an explicit host override) skip withEve entirely: the
// web project must not co-deploy the agent service. Locally, withEve boots
// the eve dev server and proxies same-origin.
const config =
  process.env.VERCEL || process.env.NEXT_PUBLIC_EVE_HOST ? nextConfig : withEve(nextConfig);

export default config;
