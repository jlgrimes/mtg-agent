import { defineAgent } from "eve";

export default defineAgent({
  // Haiku 4.5: fast + reliable tool use + good instruction-following (skips the
  // redundant lookups that made Kimi slow). Cheap enough for a free tier; bump to
  // sonnet-4.6 for a premium tier.
  model: "anthropic/claude-haiku-4.5",
});
