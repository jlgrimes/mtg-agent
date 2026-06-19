import { defineAgent } from "eve";

export default defineAgent({
  // Locked in after a bake-off: Haiku 4.5 is the accuracy/speed sweet spot.
  // Cheaper/faster models (flash-lite, nemotron) hallucinated subtle rules
  // interactions. Bump to anthropic/claude-sonnet-4.6 for a max-accuracy tier.
  model: "anthropic/claude-haiku-4.5",
});
