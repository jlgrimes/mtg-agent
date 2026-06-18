import { defineTool } from "eve/tools";
import { z } from "zod";
import { getCommanderPage } from "../lib/edhrec.js";

export default defineTool({
  description:
    "Get EDHREC's crowd-sourced card recommendations for a given commander: the cards most " +
    "commonly and most synergistically played in real decks for that commander, grouped into " +
    "sections (High Synergy Cards, Top Cards, and by card type). Use this to suggest cards to " +
    "ADD to a deck, find staples for a commander, or see what an average build looks like. " +
    "Each card includes a synergy score (how much MORE it appears in this commander's decks vs " +
    "decks generally) and an inclusion rate (what % of decks run it). Optionally pass a theme " +
    "or 'budget' to get a focused list.",
  inputSchema: z.object({
    commander: z
      .string()
      .min(1)
      .describe("The commander's exact card name, e.g. 'Atraxa, Praetors' Voice'."),
    theme: z
      .string()
      .optional()
      .describe(
        "Optional EDHREC sub-page: a theme/tribe (e.g. 'lifegain', 'tokens', 'superfriends') " +
          "or 'budget' for cheaper recommendations. Falls back to the main page if not found.",
      ),
    topPerSection: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(15)
      .describe("Max cards to return per section (default 15)."),
  }),
  async execute({ commander, theme, topPerSection }) {
    const page = await getCommanderPage(commander, theme);
    if (!page.found) {
      return {
        found: false,
        message:
          `No EDHREC page found for "${commander}". Check the exact spelling (use the ` +
          `scryfall_card tool to confirm the name), or the commander may be too new/obscure.`,
      };
    }
    return {
      found: true,
      commander: page.commander,
      avgDeckPriceUsd: page.avgPrice,
      decksAnalyzed: page.numDecks,
      similarCommanders: page.similarCommanders.slice(0, 10),
      sections: page.sections.map((s) => ({
        header: s.header,
        cards: s.cards.slice(0, topPerSection).map((c) => ({
          name: c.name,
          synergy: Number(c.synergy.toFixed(3)),
          inclusionPct: Math.round(c.inclusionRate * 100),
        })),
      })),
    };
  },
});
