// EDHREC client via the unofficial public JSON endpoints (json.edhrec.com).
// No official API exists; these powers the edhrec.com site and are widely used
// by community tools. Treat as best-effort: shapes can change without notice.

const BASE = "https://json.edhrec.com/pages";

const HEADERS = {
  "User-Agent": "mtg-commander-agent/0.1 (eve agent; deckbuilding assistant)",
  Accept: "application/json",
};

/** Turn a card/commander name into an EDHREC URL slug. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[',.]/g, "") // drop apostrophes/periods/commas
    .replace(/[^a-z0-9]+/g, "-") // everything else -> hyphen
    .replace(/^-+|-+$/g, "");
}

export interface EdhrecCard {
  name: string;
  /** Synergy score: how much more this card appears in THIS deck vs decks generally. */
  synergy: number;
  /** Number of decks running the card (popularity within this commander). */
  numDecks: number;
  /** Total decks in the pool (denominator for inclusion %). */
  potentialDecks: number;
  /** Inclusion rate 0..1. */
  inclusionRate: number;
}

export interface EdhrecSection {
  header: string;
  cards: EdhrecCard[];
}

export interface EdhrecCommanderPage {
  commander: string;
  found: boolean;
  avgPrice?: number;
  avgDeckSize?: number;
  numDecks?: number;
  /** Cards grouped by EDHREC's sections (High Synergy, Top Cards, by type, etc.). */
  sections: EdhrecSection[];
  /** Commanders EDHREC considers similar. */
  similarCommanders: string[];
}

function normalizeCardviews(cardviews: any[]): EdhrecCard[] {
  return (cardviews ?? []).map((cv) => {
    const potential = cv.potential_decks ?? 0;
    const num = cv.num_decks ?? cv.inclusion ?? 0;
    return {
      name: cv.name,
      synergy: typeof cv.synergy === "number" ? cv.synergy : 0,
      numDecks: num,
      potentialDecks: potential,
      inclusionRate: potential > 0 ? num / potential : 0,
    };
  });
}

async function fetchJson(url: string): Promise<any | null> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) return null;
  return res.json();
}

/**
 * Fetch the EDHREC page for a commander and return its recommendation sections.
 * `themeOrBudget` optionally targets a sub-page slug like "budget" or a theme.
 */
export async function getCommanderPage(
  commanderName: string,
  themeOrBudget?: string,
): Promise<EdhrecCommanderPage> {
  const slug = slugify(commanderName);
  const path = themeOrBudget
    ? `${BASE}/commanders/${slug}/${slugify(themeOrBudget)}.json`
    : `${BASE}/commanders/${slug}.json`;

  let data = await fetchJson(path);
  // Fall back to the base commander page if a theme/budget sub-page is missing.
  if (!data && themeOrBudget) data = await fetchJson(`${BASE}/commanders/${slug}.json`);
  if (!data) return { commander: commanderName, found: false, sections: [], similarCommanders: [] };

  const cardlists = data.container?.json_dict?.cardlists ?? [];
  const sections: EdhrecSection[] = cardlists.map((cl: any) => ({
    header: cl.header ?? "Cards",
    cards: normalizeCardviews(cl.cardviews),
  }));

  const similar = (data.similar ?? []).map((s: any) => s.name).filter(Boolean);

  return {
    commander: data.container?.json_dict?.card?.name ?? commanderName,
    found: true,
    avgPrice: data.avg_price,
    avgDeckSize: data.deck_size,
    numDecks: data.num_decks_avg,
    sections,
    similarCommanders: similar,
  };
}

/**
 * Fetch cards most synergistic with a single card (the card's EDHREC page).
 * Useful for "what pairs well with X" outside of a specific commander.
 */
export async function getCardPage(
  cardName: string,
): Promise<{ card: string; found: boolean; sections: EdhrecSection[] }> {
  const slug = slugify(cardName);
  const data = await fetchJson(`${BASE}/cards/${slug}.json`);
  if (!data) return { card: cardName, found: false, sections: [] };

  const cardlists = data.container?.json_dict?.cardlists ?? [];
  const sections: EdhrecSection[] = cardlists.map((cl: any) => ({
    header: cl.header ?? "Cards",
    cards: normalizeCardviews(cl.cardviews),
  }));
  return { card: cardName, found: true, sections };
}
