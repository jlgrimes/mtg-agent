// Integration smoke test of the data libs against live APIs. Run: npx tsx scripts/smoke.ts
import { getCardByName, searchCards, getCollection } from "../agent/lib/scryfall.js";
import { getCommanderPage } from "../agent/lib/edhrec.js";
import { parseDecklist, computeStats } from "../agent/lib/decklist.js";

function ok(label: string, cond: boolean, extra = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${extra ? "  — " + extra : ""}`);
  if (!cond) process.exitCode = 1;
}

// 1. Scryfall single card
const sol = await getCardByName("sol ring");
ok("scryfall_card fuzzy 'sol ring'", "name" in sol && sol.name === "Sol Ring",
  "name" in sol ? `$${sol.priceUsd}, CI=[${sol.colorIdentity}]` : JSON.stringify(sol));

// 2. Scryfall search (color identity + text)
const search = await searchCards("id<=BG o:'draw a card' cmc<=3 -t:land", { max: 5 });
ok("scryfall_search Golgari cheap draw", "cards" in search && search.cards.length > 0,
  "cards" in search ? `${search.total} total, e.g. ${search.cards.slice(0,3).map(c=>c.name).join(", ")}` : "");

// 3. EDHREC commander page
const edh = await getCommanderPage("Miirym, Sentinel Wyrm");
const topSection = edh.sections.find((s) => /high synergy|top cards/i.test(s.header));
ok("edhrec_commander Miirym", edh.found && edh.sections.length > 0,
  `${edh.sections.length} sections, similar=[${edh.similarCommanders.slice(0,2).join(", ")}]`);
ok("edhrec has synergy cards", !!topSection && topSection.cards.length > 0,
  topSection ? `${topSection.header}: ${topSection.cards.slice(0,3).map(c=>c.name).join(", ")}` : "");

// 4. Decklist parse + batch enrich + stats
const sample = `Commander
1 Miirym, Sentinel Wyrm

Deck
1 Sol Ring (C21) 263
1x Arcane Signet
3 Forest
2 Mountain
1 Island
1 Cultivate
1 Ancient Copper Dragon *F*
1 Terror of the Peaks`;
const entries = parseDecklist(sample);
ok("parseDecklist count", entries.length === 9, `parsed ${entries.length} unique entries (commander + 8 deck lines; headers skipped)`);
ok("parseDecklist strips set codes", entries.some(e => e.name === "Sol Ring"),
  entries.map(e => `${e.count}x ${e.name}`).join(" | "));

const { found, notFound } = await getCollection(entries.map(e => e.name));
const byName = new Map(found.flatMap(c => [[c.name, c], [c.name.toLowerCase(), c]] as const));
const stats = computeStats(entries, byName, notFound);
ok("computeStats lands counted", stats.lands === 6, `lands=${stats.lands}, nonlands=${stats.nonlands}`);
ok("computeStats avg CMC", stats.avgCmcNonland > 0, `avgCMC=${stats.avgCmcNonland}, curve=${JSON.stringify(stats.curve)}`);
ok("computeStats color identity", stats.colorIdentity.length > 0, `CI=[${stats.colorIdentity}], notFound=[${notFound}]`);

console.log("\nstats:", JSON.stringify(stats, null, 2));
