import { defineTool } from "eve/tools";
import { z } from "zod";
import { searchCards } from "../lib/scryfall.js";

export default defineTool({
  description:
    "Search for Magic cards using Scryfall's full query syntax. Powerful for finding cards " +
    "that fit a need, color identity, budget, or theme. Examples of `query`:\n" +
    "  id<=WUB type:instant o:counter            (mono/multi within Esper color identity counterspells)\n" +
    "  id:G o:'draw a card' cmc<=3               (cheap green card draw)\n" +
    "  type:creature o:'whenever ~ attacks' id:R (red attack-trigger creatures)\n" +
    "  o:'add' type:land id:GW                   (Selesnya mana-producing lands)\n" +
    "  is:commander id=jund                      (legendary creatures that can be Jund commanders)\n" +
    "  usd<=2 type:artifact o:'mana'             (budget mana rocks under $2)\n" +
    "Key filters: id: / id<= (color identity, vital for Commander), type:, o: (oracle text), " +
    "cmc, pow/tou, usd<= (price), is:commander, r: (rarity), -t:land (exclude). " +
    "Default order is 'edhrec' (most-played first), which surfaces the most relevant cards.",
  inputSchema: z.object({
    query: z.string().min(1).describe("A Scryfall syntax query (see examples in the description)."),
    max: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(25)
      .describe("Max cards to return (default 25)."),
    order: z
      .enum(["edhrec", "name", "cmc", "usd", "released", "power", "toughness"])
      .default("edhrec")
      .describe("Sort order. 'edhrec' = most-played first (best for recommendations)."),
  }),
  async execute({ query, max, order }) {
    return searchCards(query, { max, order });
  },
});
