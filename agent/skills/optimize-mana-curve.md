---
description: Use when the user wants to optimize, fix, or critique their deck's mana curve, mana base, ramp, or land count.
---

# Optimizing the mana curve & mana base

Call `analyze_decklist` (or `archidekt_import` → `analyze_decklist`) first to get the real curve,
land count, and color pips. Then work through this checklist.

## 1. Land count
- Target **~36–38 lands** for a typical deck with an average CMC around 3.
- Subtract ~1 land for every 2–3 cheap ramp/cost-reduction pieces beyond the baseline.
- Below 34 lands is risky unless the deck is very low to the ground (avg CMC < 2.5) with heavy ramp.

## 2. Ramp
- Want **~10–12 ramp sources**, most at **2 CMC**, so you can deploy your commander a turn early.
- Staples by color identity: **Sol Ring**, **Arcane Signet**, talismans/signets, **Fellwar Stone**;
  green adds **Rampant Growth**, **Three Visits**, **Nature's Lore**, **Cultivate**, mana dorks.
- A curve that's heavy at 4–6 with few 2-drop ramp pieces is the #1 cause of slow, clunky games.

## 3. Curve shape
- For most midrange decks, the bulk of nonland spells should sit at **2–4 CMC**.
- A healthy rough distribution (nonland, ~63 spells): 1-CMC few, 2-CMC heavy, 3-CMC heavy,
  4-CMC moderate, 5-CMC light, 6+ only your payoffs.
- Too many 5+ drops → either add ramp/cost reduction or cut the weakest top-end.
- Too top-heavy AND too few lands is a double fault — fix lands/ramp before trimming spells.

## 4. Color requirements (pips)
- Compare the **colorPips** breakdown to the land base. If one color has far more pips, weight the
  mana base (and rocks that fix) toward that color.
- Double/triple-pip cards (e.g. {U}{U}{U}) demand more sources of that color; flag them if the base is thin.
- Use `scryfall_search` to find fixing in the deck's identity, e.g. `id<=WUB type:land o:'add'`.

## 5. Deliver the fix
- Report current vs target: lands, ramp count, avg CMC, and the curve.
- Give a concrete swap list: **cut X (too top-heavy / win-more), add Y (2-CMC ramp / dual land)**.
- Keep the deck at exactly 100 cards.
