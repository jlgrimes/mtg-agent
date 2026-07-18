// Post-build patch for the generated eve Build Output route configs.
//
// Deployed Vercel routing serves the three LITERAL eve routes (/health,
// /info, /session) but drops every parameterized one (session stream/
// continue), 404ing them into the Next app. The generated patterns use
// PCRE-style named groups ("(?<sessionId>[^/]+)"), which RE2 — used by
// newer Vercel routing — cannot compile, so those routes die silently.
//
// Fix: append dialect-neutral equivalents (plain groups, no named
// captures) plus a namespace-scoped catch-all to both the service config
// and the host config. Additive only — generated routes stay untouched.
//
// Runs as part of the eve service buildCommand (see next.config.ts); a
// missing config (plain local builds) is a no-op.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

function patchServiceConfig(outputDir) {
  const configPath = join(outputDir, "config.json");
  if (!existsSync(configPath)) {
    console.log(`[patch-eve-routes] no service config at ${configPath} — skipping.`);
    return;
  }
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const routes = Array.isArray(config.routes) ? config.routes : [];
  const serverDest = routes.find((r) => typeof r?.dest === "string")?.dest;
  if (!serverDest) {
    console.log("[patch-eve-routes] no dest routes in service config — skipping.");
    return;
  }
  const additions = [
    { src: "/eve/v1/session/([^/]+)/stream", dest: serverDest },
    { src: "/eve/v1/session/([^/]+)/cancel", dest: serverDest },
    { src: "/eve/v1/session/([^/]+)", dest: serverDest },
    { src: "/eve/v1/connections/([^/]+)/callback/([^/]+)", dest: serverDest },
    { src: "/eve/v1/callback/([^/]+)", dest: serverDest },
    { src: "/eve/v1/(.*)", dest: serverDest },
  ];
  let added = 0;
  for (const route of additions) {
    if (!routes.some((r) => r?.src === route.src && r?.dest === route.dest)) {
      routes.push(route);
      added++;
    }
  }
  config.routes = routes;
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`[patch-eve-routes] service config: +${added} routes (${configPath})`);
}

function patchHostConfig(hostDir) {
  const configPath = join(hostDir, "config.json");
  if (!existsSync(configPath)) {
    console.log(`[patch-eve-routes] no host config at ${configPath} — skipping.`);
    return;
  }
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const routes = Array.isArray(config.routes) ? config.routes : [];
  const serviceRoute = routes.find((r) => r?.destination?.type === "service");
  if (!serviceRoute) {
    console.log("[patch-eve-routes] no service destination in host config — skipping.");
    return;
  }
  const destination = serviceRoute.destination;
  const additions = [
    { src: "^/eve/v1/session/([^/]+)/stream$", destination },
    { src: "^/eve/v1/session/([^/]+)/cancel$", destination },
    { src: "^/eve/v1/session/([^/]+)$", destination },
  ];
  let added = 0;
  for (const route of additions) {
    if (!routes.some((r) => r?.src === route.src)) {
      routes.push(route);
      added++;
    }
  }
  config.routes = routes;
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`[patch-eve-routes] host config: +${added} routes (${configPath})`);
}

const serviceDir = process.env.EVE_INTERNAL_BUILD_OUTPUT_DIRECTORY;
const hostDir = process.env.EVE_INTERNAL_HOST_BUILD_OUTPUT_DIRECTORY;
if (serviceDir) patchServiceConfig(serviceDir);
else console.log("[patch-eve-routes] EVE_INTERNAL_BUILD_OUTPUT_DIRECTORY unset — skipping service.");
if (hostDir) patchHostConfig(hostDir);
else console.log("[patch-eve-routes] EVE_INTERNAL_HOST_BUILD_OUTPUT_DIRECTORY unset — skipping host.");
