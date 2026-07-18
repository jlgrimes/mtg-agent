import type { NextConfig } from "next";
import { withEve } from "eve/next";

const nextConfig: NextConfig = {};

export default withEve(nextConfig, {
  // After the standard eve build, append a catch-all route to the generated
  // service config: deployed Vercel routing failed to match the config's
  // parameterized regex routes (session stream/continue), 404ing them into
  // the Next app while literal routes worked. The catch-all sends every
  // service-scoped request to the eve server function, whose internal router
  // handles all eve paths. See scripts/patch-eve-service-routes.mjs.
  eveBuildCommand:
    "node node_modules/eve/bin/eve.js build && node scripts/patch-eve-service-routes.mjs",
});
