// Post-build patch for the generated eve service Build Output.
//
// On deployed Vercel routing, the service config's parameterized routes
// (e.g. "/eve/v1/session/(?<sessionId>[^/]+)/stream") fail to match, so
// stream/continue requests fall through to the Next app's 404 while the
// literal routes (/health, /info, /session) work. The service's Nitro
// server has its own internal router that handles every eve path, so a
// trailing catch-all into the server function is always safe and makes
// route matching independent of Vercel's regex handling.
//
// Runs as part of the eve service buildCommand (see next.config.ts); a
// missing output config (plain local builds) is a no-op.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const outputDir = process.env.EVE_INTERNAL_BUILD_OUTPUT_DIRECTORY;
if (!outputDir) {
  console.log("[patch-eve-service-routes] EVE_INTERNAL_BUILD_OUTPUT_DIRECTORY unset — skipping.");
  process.exit(0);
}
const configPath = join(outputDir, "config.json");
if (!existsSync(configPath)) {
  console.log(`[patch-eve-service-routes] no config at ${configPath} — skipping.`);
  process.exit(0);
}

const config = JSON.parse(readFileSync(configPath, "utf8"));
const routes = Array.isArray(config.routes) ? config.routes : [];

// Find the server function destination from the existing generated routes.
const serverDest = routes.find((r) => typeof r?.dest === "string")?.dest;
if (!serverDest) {
  console.log("[patch-eve-service-routes] no dest routes found — skipping.");
  process.exit(0);
}

const catchAll = { src: "/(.*)", dest: serverDest };
const alreadyPatched = routes.some((r) => r?.src === catchAll.src && r?.dest === catchAll.dest);
if (!alreadyPatched) {
  routes.push(catchAll);
  config.routes = routes;
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`[patch-eve-service-routes] appended catch-all → ${serverDest} in ${configPath}`);
} else {
  console.log("[patch-eve-service-routes] catch-all already present.");
}
