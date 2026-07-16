import { defineAgent } from "eve";

export default defineAgent({
  // GPT-5.6 Luna — the fast/cheap tier of the 5.6 family ($1/$6 per 1M
  // tokens, close to Haiku 4.5 pricing) but a generation smarter. Bump to
  // openai/gpt-5.6-terra (balanced) or -sol (flagship) if it still trips
  // on subtle rules interactions.
  model: "openai/gpt-5.6-luna",
  // eve 0.24's AI Gateway catalog predates the GPT-5.6 family, so it can't
  // resolve the context window and refuses to boot without this. Luna's real
  // window is 1.05M tokens, but input above 272k bills at 2x — declaring the
  // cheap tier as the window keeps compaction inside it.
  modelContextWindowTokens: 272_000,
});
