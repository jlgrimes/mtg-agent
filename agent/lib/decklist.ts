// Decklist parsing + analysis. Accepts the plain-text export from any deckbuilder
// (Moxfield, Archidekt, MTGGoldfish, Arena, MTGO) and computes deck statistics.

import type { SimpleCard } from "./scryfall.js";

export interface DeckEntry {
  count: number;
  name: string;
}

// Lines that are section headers or metadata, not cards.
const HEADER_RE = /^(deck|commander|companion|sideboard|maybeboard|about|name|tokens?)\b/i;

/**
 * Parse a plain-text decklist into { count, name } entries.
 * Handles formats like:
 *   "1 Sol Ring"            "1x Sol Ring"            "Sol Ring"
 *   "1 Sol Ring (C21) 263"  "1 Sol Ring (LTC) 304 *F*"
 *   "// Commander" or "Commander:" section headers (skipped)
 *   "SB: 1 Card" (sideboard marker stripped)
 */
export function parseDecklist(text: string): DeckEntry[] {
  const merged = new Map<string, number>();

  for (let raw of text.split(/\r?\n/)) {
    let line = raw.trim();
    if (!line) continue;
    // strip comment / section markers
    line = line.replace(/^\/\/\s*/, "").replace(/^SB:\s*/i, "").trim();
    if (!line || line.startsWith("#")) continue;
    // pure section headers like "Commander" / "Deck" with no count
    if (HEADER_RE.test(line) && !/^\d/.test(line) && !/\s\d/.test(line)) continue;

    // optional leading count: "1", "1x", "12 "
    const m = line.match(/^(\d+)\s*[xX]?\s+(.+)$/);
    let count = 1;
    let name = line;
    if (m) {
      count = parseInt(m[1], 10);
      name = m[2];
    }

    // strip trailing set/collector/foil annotations:
    //   "(C21) 263", " 263", " *F*", " [Category]", " #tag"
    name = name
      .replace(/\s*\([A-Za-z0-9]{2,6}\)\s*[A-Za-z0-9-]*\s*$/, "") // (SET) 123
      .replace(/\s*\*[A-Z]+\*\s*$/, "") // *F* foil
      .replace(/\s*\[[^\]]*\]\s*$/, "") // [Category]
      .replace(/\s*<[^>]*>\s*$/, "")
      .replace(/\s+\d{1,4}\s*$/, "") // dangling collector number
      .trim();

    // normalize double-faced "Front // Back" to just the front face for lookup
    name = name.split("//")[0].trim();
    if (!name) continue;

    merged.set(name, (merged.get(name) ?? 0) + (Number.isFinite(count) ? count : 1));
  }

  return [...merged.entries()].map(([name, count]) => ({ name, count }));
}

const COLOR_NAMES: Record<string, string> = {
  W: "White",
  U: "Blue",
  B: "Black",
  R: "Red",
  G: "Green",
};

export interface DeckStats {
  totalCards: number;
  uniqueCards: number;
  lands: number;
  nonlands: number;
  avgCmcNonland: number;
  /** CMC buckets for the mana curve (nonland spells only). */
  curve: { "0": number; "1": number; "2": number; "3": number; "4": number; "5": number; "6": number; "7+": number };
  typeCounts: Record<string, number>;
  /** Colored mana symbols across all spell costs (pip counts). */
  colorPips: Record<string, number>;
  colorIdentity: string[];
  totalPriceUsd: number;
  unresolved: string[];
}

const TYPE_ORDER = [
  "Creature",
  "Instant",
  "Sorcery",
  "Artifact",
  "Enchantment",
  "Planeswalker",
  "Battle",
  "Land",
];

function primaryType(typeLine: string | null): string {
  if (!typeLine) return "Other";
  for (const t of TYPE_ORDER) if (typeLine.includes(t)) return t;
  return "Other";
}

function curveBucket(cmc: number): keyof DeckStats["curve"] {
  if (cmc <= 0) return "0";
  if (cmc >= 7) return "7+";
  return String(Math.floor(cmc)) as keyof DeckStats["curve"];
}

/**
 * Compute deck statistics from enriched cards (keyed by their DeckEntry counts).
 * `enriched` maps a card name -> resolved Scryfall card; `unresolved` lists
 * names Scryfall could not find.
 */
export function computeStats(
  entries: DeckEntry[],
  enriched: Map<string, SimpleCard>,
  unresolved: string[],
): DeckStats {
  const curve = { "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7+": 0 };
  const typeCounts: Record<string, number> = {};
  const colorPips: Record<string, number> = { White: 0, Blue: 0, Black: 0, Red: 0, Green: 0 };
  const identity = new Set<string>();

  let total = 0;
  let lands = 0;
  let nonlands = 0;
  let cmcSum = 0;
  let cmcCount = 0;
  let price = 0;

  for (const { name, count } of entries) {
    total += count;
    const card = enriched.get(name) ?? enriched.get(name.toLowerCase());
    if (!card) continue;

    if (card.priceUsd) price += card.priceUsd * count;
    for (const c of card.colorIdentity) identity.add(c);

    const type = primaryType(card.typeLine);
    typeCounts[type] = (typeCounts[type] ?? 0) + count;

    const isLand = (card.typeLine ?? "").includes("Land");
    if (isLand) {
      lands += count;
    } else {
      nonlands += count;
      curve[curveBucket(card.cmc)] += count;
      cmcSum += card.cmc * count;
      cmcCount += count;
      // count colored pips from the mana cost, e.g. "{1}{G}{G}" -> G:2
      for (const sym of (card.manaCost ?? "").matchAll(/\{([WUBRG])\}/g)) {
        colorPips[COLOR_NAMES[sym[1]]] += count;
      }
    }
  }

  return {
    totalCards: total,
    uniqueCards: entries.length,
    lands,
    nonlands,
    avgCmcNonland: cmcCount ? Number((cmcSum / cmcCount).toFixed(2)) : 0,
    curve,
    typeCounts,
    colorPips,
    colorIdentity: [...identity].sort(),
    totalPriceUsd: Number(price.toFixed(2)),
    unresolved,
  };
}
