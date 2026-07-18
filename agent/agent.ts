import { defineAgent } from "eve";
import { AGENT_MODEL } from "./model.js";

export default defineAgent({
  // Kimi K3 (Moonshot AI) — open-weight flagship, strong tool use and
  // reasoning at open-model pricing. The id lives in agent/model.ts so the
  // web app can stamp saved assistant messages with the model that wrote them.
  model: AGENT_MODEL,
  // K3 shipped days ago, so eve's AI Gateway catalog has no context-window
  // metadata for it and refuses to boot without this. The model's native
  // window is 1M tokens; declare a conservative 256k so compaction kicks in
  // well inside whatever the gateway actually serves.
  modelContextWindowTokens: 262_144,
});
