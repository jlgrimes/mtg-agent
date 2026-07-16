import { defineSandbox } from "eve/sandbox";
import { justbash } from "eve/sandbox/just-bash";

// This agent doesn't need a real VM: its tools are plain TypeScript (Scryfall,
// EDHREC, Archidekt fetches) that run in the eve runtime, and the sandbox only
// materializes the markdown skills for load_skill. Pinning the pure-JS
// just-bash backend keeps deploys free of the Vercel Sandbox / OIDC-token
// dependency that defaultBackend() pulls in on hosted Vercel builds.
export default defineSandbox({
  backend: justbash(),
});
