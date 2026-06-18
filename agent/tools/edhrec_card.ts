import { defineTool } from "eve/tools";
import { z } from "zod";
import { getCardPage } from "../lib/edhrec.js";

export default defineTool({
  description:
    "Get EDHREC data for a single card: which other cards are most often played alongside it " +
    "and synergize with it, across all decks (not tied to one commander). Use this for " +
    "'what pairs well with X?', finding combo pieces, or building around a specific card.",
  inputSchema: z.object({
    card: z.string().min(1).describe("The exact card name, e.g. 'Cathars' Crusade'."),
    topPerSection: z.number().int().min(1).max(50).default(15),
  }),
  async execute({ card, topPerSection }) {
    const page = await getCardPage(card);
    if (!page.found) {
      return {
        found: false,
        message: `No EDHREC page found for "${card}". Confirm the exact name with scryfall_card.`,
      };
    }
    return {
      found: true,
      card: page.card,
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
