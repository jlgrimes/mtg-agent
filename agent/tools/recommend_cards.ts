import { defineTool } from "eve/tools";
import { z } from "zod";
import { getCollection } from "../lib/scryfall.js";

const ROLES = ["Ramp", "Draw", "Removal", "Wincon", "Synergy", "Land", "Other"] as const;

export default defineTool({
  description:
    "Present a set of recommended cards to the user as rich, visual cards (with art, price, and a " +
    "buy link). ALWAYS call this when you recommend specific cards to ADD to a deck, suggest cards " +
    "to try, or answer 'any cool cards?'. Pass each card's exact name, a one-line reason, and its " +
    "role. The tool enriches them with current price + art + a purchase link, and the app renders " +
    "them as cards. After calling it, do NOT re-list the same cards in prose — just add a short " +
    "framing sentence or a note about cuts.",
  inputSchema: z.object({
    intro: z
      .string()
      .optional()
      .describe("One short sentence of framing shown above the cards (e.g. 'Budget Krenko staples:')."),
    cards: z
      .array(
        z.object({
          name: z.string().describe("Exact card name (as printed)."),
          role: z.enum(ROLES).optional().describe("The role this card fills in the deck."),
          reason: z.string().describe("One short line: what it does / why add it."),
        }),
      )
      .min(1)
      .max(12)
      .describe("The recommended cards, best first."),
  }),
  async execute({ intro, cards }) {
    const { found } = await getCollection(cards.map((c) => c.name));
    const byName = new Map(found.map((c) => [c.name.toLowerCase(), c]));

    const enriched = cards.map((c) => {
      const card = byName.get(c.name.toLowerCase());
      return {
        name: card?.name ?? c.name,
        role: c.role ?? null,
        reason: c.reason,
        priceUsd: card?.priceUsd ?? null,
        artCrop: card?.artCrop ?? null,
        buyUrl: card?.buyUrl ?? null,
        manaCost: card?.manaCost ?? null,
        typeLine: card?.typeLine ?? null,
        colorIdentity: card?.colorIdentity ?? [],
        resolved: !!card,
      };
    });

    return { intro: intro ?? null, cards: enriched };
  },
});
