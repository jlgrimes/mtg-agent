import { defineAgent } from "eve";

export default defineAgent({
  // GPT-5.6 Luna — the fast/cheap tier of the 5.6 family ($1/$6 per 1M
  // tokens, close to Haiku 4.5 pricing) but a generation smarter. Bump to
  // openai/gpt-5.6-terra (balanced) or -sol (flagship) if it still trips
  // on subtle rules interactions.
  model: "openai/gpt-5.6-luna",
});
