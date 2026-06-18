// Scryfall API client. Official, free, no key required.
// Etiquette: send a descriptive User-Agent + Accept header, and keep request
// rate modest (Scryfall asks for ~50-100ms between calls). Docs: https://scryfall.com/docs/api

const BASE = "https://api.scryfall.com";

const HEADERS = {
  "User-Agent": "mtg-commander-agent/0.1 (eve agent; deckbuilding assistant)",
  Accept: "application/json",
};

/** A trimmed, model-friendly view of a Scryfall card. */
export interface SimpleCard {
  name: string;
  manaCost: string | null;
  cmc: number;
  typeLine: string | null;
  oracleText: string | null;
  colors: string[];
  colorIdentity: string[];
  power: string | null;
  toughness: string | null;
  loyalty: string | null;
  rarity: string | null;
  setName: string | null;
  priceUsd: number | null;
  edhrecRank: number | null;
  legalCommander: boolean;
  scryfallUri: string | null;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function faceText(card: any): string | null {
  if (typeof card.oracle_text === "string") return card.oracle_text;
  if (Array.isArray(card.card_faces)) {
    const parts = card.card_faces
      .map((f: any) => (f.oracle_text ? `${f.name}: ${f.oracle_text}` : null))
      .filter(Boolean);
    if (parts.length) return parts.join("\n//\n");
  }
  return null;
}

function faceManaCost(card: any): string | null {
  if (card.mana_cost) return card.mana_cost;
  if (Array.isArray(card.card_faces)) {
    const parts = card.card_faces.map((f: any) => f.mana_cost).filter(Boolean);
    if (parts.length) return parts.join(" // ");
  }
  return null;
}

/** Normalize a raw Scryfall card object into a SimpleCard. */
export function toSimpleCard(card: any): SimpleCard {
  const usd = card.prices?.usd ?? card.prices?.usd_foil ?? null;
  return {
    name: card.name,
    manaCost: faceManaCost(card),
    cmc: typeof card.cmc === "number" ? card.cmc : 0,
    typeLine: card.type_line ?? null,
    oracleText: faceText(card),
    colors: card.colors ?? card.card_faces?.[0]?.colors ?? [],
    colorIdentity: card.color_identity ?? [],
    power: card.power ?? null,
    toughness: card.toughness ?? null,
    loyalty: card.loyalty ?? null,
    rarity: card.rarity ?? null,
    setName: card.set_name ?? null,
    priceUsd: usd != null ? Number(usd) : null,
    edhrecRank: card.edhrec_rank ?? null,
    legalCommander: card.legalities?.commander === "legal",
    scryfallUri: card.scryfall_uri ?? null,
  };
}

/** Look up a single card by name. Set fuzzy=true to tolerate typos/partials. */
export async function getCardByName(
  name: string,
  fuzzy = true,
): Promise<SimpleCard | { error: string }> {
  const param = fuzzy ? "fuzzy" : "exact";
  const res = await fetch(
    `${BASE}/cards/named?${param}=${encodeURIComponent(name)}`,
    { headers: HEADERS },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { error: body?.details ?? `Card not found: "${name}" (HTTP ${res.status})` };
  }
  return toSimpleCard(await res.json());
}

/**
 * Search Scryfall with full query syntax (https://scryfall.com/docs/syntax).
 * Returns up to `max` cards (paginates as needed, capped to be polite).
 */
export async function searchCards(
  query: string,
  opts: { max?: number; order?: string } = {},
): Promise<{ total: number; cards: SimpleCard[]; warning?: string } | { error: string }> {
  const max = Math.min(opts.max ?? 25, 175);
  const order = opts.order ?? "edhrec";
  let url:
    | string
    | null = `${BASE}/cards/search?q=${encodeURIComponent(query)}&order=${order}`;
  const cards: SimpleCard[] = [];
  let total = 0;

  while (url && cards.length < max) {
    const res: Response = await fetch(url, { headers: HEADERS });
    if (res.status === 404) return { total: 0, cards: [] }; // no matches
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { error: body?.details ?? `Search failed (HTTP ${res.status})` };
    }
    const page = await res.json();
    total = page.total_cards ?? cards.length;
    for (const c of page.data ?? []) cards.push(toSimpleCard(c));
    url = page.has_more ? page.next_page : null;
    if (url) await sleep(90); // be polite between pages
  }

  return { total, cards: cards.slice(0, max) };
}

/**
 * Batch-resolve many cards by name in one or few requests.
 * Uses POST /cards/collection (max 75 identifiers per request).
 */
export async function getCollection(
  names: string[],
): Promise<{ found: SimpleCard[]; notFound: string[] }> {
  const found: SimpleCard[] = [];
  const notFound: string[] = [];

  for (let i = 0; i < names.length; i += 75) {
    const chunk = names.slice(i, i + 75);
    const res = await fetch(`${BASE}/cards/collection`, {
      method: "POST",
      headers: { ...HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ identifiers: chunk.map((name) => ({ name })) }),
    });
    if (!res.ok) {
      // On a hard failure, mark this whole chunk unresolved rather than throwing.
      notFound.push(...chunk);
      continue;
    }
    const data = await res.json();
    for (const c of data.data ?? []) found.push(toSimpleCard(c));
    for (const nf of data.not_found ?? []) notFound.push(nf.name ?? JSON.stringify(nf));
    if (i + 75 < names.length) await sleep(90);
  }

  return { found, notFound };
}
