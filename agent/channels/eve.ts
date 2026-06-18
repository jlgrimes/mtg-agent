import { eveChannel } from "eve/channels/eve";
import { localDev, none, vercelOidc } from "eve/channels/auth";

export default eveChannel({
  auth: [
    // Open on localhost for `eve dev` and the REPL; ignored in production.
    localDev(),
    // Lets the eve TUI and your Vercel deployments reach the deployed agent.
    vercelOidc(),
    // PUBLIC DEMO: anyone with the URL can chat (and use your AI Gateway credits).
    // To lock this down, swap none() for your app's auth provider (Auth.js / Clerk),
    // or restore placeholderAuth() to block all browser requests in production.
    none(),
  ],
});
