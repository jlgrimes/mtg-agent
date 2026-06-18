import { defineAgent } from "eve";

export default defineAgent({
  // Trying Kimi K2.7 (strong agentic/tool use, cheaper than Haiku) as a free-tier
  // model. Fallbacks: anthropic/claude-haiku-4.5 (reliable), sonnet-4.6 (premium).
  model: "moonshotai/kimi-k2.7-code",
});
