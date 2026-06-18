import { defineTool } from "eve/tools";
import { z } from "zod";
import { parseDecklist, computeStats } from "../lib/decklist.js";
import { getCollection, type SimpleCard } from "../lib/scryfall.js";

export default defineTool({
  description:
    "Parse a pasted decklist (plain text from Moxfield, Archidekt, MTGGoldfish, Arena, or MTGO) " +
    "and analyze it: mana curve, average CMC, land count, card-type breakdown, color pip " +
    "requirements, derived color identity, and total deck price. This is the FIRST tool to call " +
    "when a user shares their deck and wants upgrades, a curve fix, or a power-level read. " +
    "Returns per-card resolved data plus aggregate stats. Lines like '1 Sol Ring (C21) 263' are " +
    "handled; set codes and foil markers are stripped automatically.",
  inputSchema: z.object({
    decklist: z
      .string()
      .min(1)
      .describe(
        "The raw decklist text, one card per line (e.g. '1 Sol Ring'). Export from any " +
          "deckbuilder works. Include the commander line(s).",
      ),
    commander: z
      .string()
      .optional()
      .describe("Optional: the commander name, if known, to anchor color-identity checks."),
  }),
  async execute({ decklist, commander }) {
    const entries = parseDecklist(decklist);
    if (entries.length === 0) {
      return { error: "No cards parsed. Provide a plain-text decklist, one card per line." };
    }

    const { found, notFound } = await getCollection(entries.map((e) => e.name));
    const byName = new Map<string, SimpleCard>();
    for (const c of found) {
      byName.set(c.name, c);
      byName.set(c.name.toLowerCase(), c);
    }

    const stats = computeStats(entries, byName, notFound);

    // Flag cards that fall outside the commander's color identity, if we can determine it.
    let colorIdentityWarnings: string[] = [];
    const ci = commander ? byName.get(commander) ?? byName.get(commander.toLowerCase()) : null;
    const identity = ci?.colorIdentity ?? stats.colorIdentity;
    if (identity.length) {
      const allowed = new Set(identity);
      for (const e of entries) {
        const card = byName.get(e.name) ?? byName.get(e.name.toLowerCase());
        if (card && card.colorIdentity.some((c) => !allowed.has(c))) {
          colorIdentityWarnings.push(`${card.name} (${card.colorIdentity.join("") || "C"})`);
        }
      }
    }

    return {
      stats,
      colorIdentity: identity,
      colorIdentityWarnings,
      cardCountNote:
        stats.totalCards === 100
          ? "100 cards — correct for a Commander deck."
          : `${stats.totalCards} cards (a legal Commander deck is exactly 100, including the commander).`,
      cards: entries.map((e) => {
        const card = byName.get(e.name) ?? byName.get(e.name.toLowerCase());
        return {
          count: e.count,
          name: card?.name ?? e.name,
          cmc: card?.cmc ?? null,
          typeLine: card?.typeLine ?? null,
          manaCost: card?.manaCost ?? null,
          priceUsd: card?.priceUsd ?? null,
          resolved: !!card,
        };
      }),
    };
  },
});
