import { defineTool } from "eve/tools";
import { z } from "zod";
import { getCardByName } from "../lib/scryfall.js";

export default defineTool({
  description:
    "Look up a single Magic: The Gathering card by name and return its full details: " +
    "mana cost, CMC, type line, oracle text, color identity, power/toughness, rarity, " +
    "price (USD), EDHREC rank, and Commander legality. Use this whenever you need the " +
    "exact rules text, cost, or color identity of a specific card. Fuzzy matching tolerates " +
    "typos and partial names.",
  inputSchema: z.object({
    name: z.string().min(1).describe("Card name (or close partial), e.g. 'sol ring' or 'Atraxa'"),
    fuzzy: z
      .boolean()
      .default(true)
      .describe("Tolerate typos/partial names. Set false to require an exact name match."),
  }),
  async execute({ name, fuzzy }) {
    return getCardByName(name, fuzzy);
  },
});
