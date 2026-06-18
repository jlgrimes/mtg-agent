import { defineTool } from "eve/tools";
import { z } from "zod";

const HEADERS = {
  "User-Agent": "mtg-commander-agent/0.1 (eve agent; deckbuilding assistant)",
  Accept: "application/json",
};

// Accept a full URL (https://archidekt.com/decks/123456/name) or a bare deck id.
function extractDeckId(input: string): string | null {
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) return trimmed;
  const m = trimmed.match(/archidekt\.com\/(?:decks|api\/decks)\/(\d+)/i);
  return m ? m[1] : null;
}

export default defineTool({
  description:
    "Import a Commander deck from Archidekt by URL or deck ID using their open API. Returns the " +
    "deck name, format, commander(s), and the full card list (with quantities and categories), " +
    "ready to analyze. Use this when the user gives an Archidekt link. " +
    "NOTE: Moxfield's API is NOT publicly accessible (it returns 403) — for a Moxfield deck, ask " +
    "the user to use Moxfield's 'Export' button and paste the text into analyze_decklist instead.",
  inputSchema: z.object({
    urlOrId: z
      .string()
      .min(1)
      .describe("An Archidekt deck URL (https://archidekt.com/decks/123456) or just the numeric ID."),
  }),
  async execute({ urlOrId }) {
    const id = extractDeckId(urlOrId);
    if (!id) {
      return {
        error:
          "Could not find an Archidekt deck ID in that input. Pass a URL like " +
          "https://archidekt.com/decks/123456 or the numeric ID.",
      };
    }

    const res = await fetch(`https://archidekt.com/api/decks/${id}/`, { headers: HEADERS });
    if (!res.ok) {
      return { error: `Archidekt returned HTTP ${res.status} for deck ${id}. It may be private or deleted.` };
    }
    const data = await res.json();

    const cards = (data.cards ?? []).map((entry: any) => {
      const oracle = entry.card?.oracleCard ?? {};
      const categories: string[] = entry.categories ?? [];
      return {
        count: entry.quantity ?? 1,
        name: oracle.name ?? entry.card?.displayName ?? "Unknown",
        categories,
        isCommander: categories.includes("Commander"),
        cmc: oracle.cmc ?? null,
        manaCost: oracle.manaCost ?? null,
        colorIdentity: oracle.colorIdentity ?? [],
        typeLine: [...(oracle.superTypes ?? []), ...(oracle.types ?? []), ...(oracle.subTypes ?? [])]
          .filter(Boolean)
          .join(" "),
      };
    });

    const commanders = cards.filter((c: any) => c.isCommander).map((c: any) => c.name);

    // Also emit a plain-text decklist so it can be piped straight into analyze_decklist.
    const decklistText = cards.map((c: any) => `${c.count} ${c.name}`).join("\n");

    return {
      id,
      name: data.name,
      format: data.deckFormat,
      bracket: data.edhBracket ?? null,
      commanders,
      totalCards: cards.reduce((n: number, c: any) => n + c.count, 0),
      cards,
      decklistText,
    };
  },
});
