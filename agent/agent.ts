import { defineAgent } from "eve";

export default defineAgent({
  // GPT-5.6 Sol — the flagship of the 5.6 family, picked for accuracy on
  // subtle rules interactions (Haiku 4.5 was too error-prone). Drop to
  // openai/gpt-5.6-terra (balanced) or -luna (fast/cheap) if cost or
  // latency becomes a problem.
  model: "openai/gpt-5.6-sol",
});
