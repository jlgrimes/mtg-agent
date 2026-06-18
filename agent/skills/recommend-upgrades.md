---
description: Use when the user wants upgrade suggestions, cards to add, cuts to make, or "any cool cards for my deck".
---

# Recommending upgrades

## Gather context first
- Identify the **commander** and its **color identity** (confirm with `scryfall_card` if unsure).
- If a decklist was shared, run `analyze_decklist` so you know what's already in the deck and where
  the gaps are (low on draw? thin removal? clunky curve?).
- Note **budget** and **power level** if stated; otherwise infer from the existing list and ask if it matters.

## Source candidates
- Call `edhrec_commander` for the commander — this is the ground truth for what real decks run.
  Prioritize the **High Synergy Cards** and **Top Cards** sections.
- For a specific theme/tribe or budget build, pass `theme` (e.g. "tokens", "budget").
- For build-arounds or combos, use `edhrec_card` on a key piece.
- To fill a specific functional gap not covered by EDHREC, use `scryfall_search`
  (e.g. cheap draw in Golgari: `id<=BG o:'draw' cmc<=3 -t:land`).

## Filter the candidates
- **Drop anything already in the deck** and anything outside the color identity.
- Bias toward cards that fill the deck's *missing roles* (per the analysis), not just generically good cards.
- Respect budget: surface `priceUsd` and offer budget alternatives when a pick is pricey.

## Present recommendations
- Group by role: **Ramp / Card Draw / Removal / Wincons / Synergy / Lands**.
- For each: **Card Name** — one-line reason (the role it fills), and price if budget matters.
- **Always pair adds with cuts.** Suggest the weakest current cards to remove (win-more, off-theme,
  high-CMC with no payoff) so the deck stays at 100. Explain each cut briefly.
- Offer a short "if you have more budget" tier and a "budget-friendly" tier when relevant.
