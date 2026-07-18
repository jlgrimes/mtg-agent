import { defineAgent } from "eve";
import { AGENT_MODEL } from "../lib/model.js";

export default defineAgent({
  // Kimi K3 (Moonshot AI): open-weight, 1M-token context, thinking always on.
  // Previous pick was anthropic/claude-haiku-4.5 after a bake-off — cheaper
  // models (flash-lite, nemotron) hallucinated subtle rules interactions, so
  // if K3 regresses on rules accuracy, that's the fallback.
  model: AGENT_MODEL,
});
