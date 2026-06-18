import { defineAgent } from "eve";

export default defineAgent({
  // Haiku 4.5: fast and much cheaper than Sonnet — a better fit for a free tier.
  // (Bump to anthropic/claude-sonnet-4.6 for a future premium tier.)
  model: "anthropic/claude-haiku-4.5",
});
