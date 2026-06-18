---
description: Use when the user wants to assess or change a deck's power level, bracket, or how casual/competitive it is.
---

# Assessing and tuning power level

Commander power is best discussed via the **Bracket** system (1–5) plus the classic cEDH distinction.
Always read the deck with `analyze_decklist` first, then assess.

## The brackets (rough guide)
- **Bracket 1 — Exhibition:** ultra-casual, theme over function, no real win focus.
- **Bracket 2 — Core:** precon-level. Few tutors, slower wins, no early combos.
- **Bracket 3 — Upgraded:** tuned singleton deck, efficient staples, a coherent plan, faster clock.
  Game Changers used sparingly. This is where most "good casual" decks live.
- **Bracket 4 — Optimized:** high-power, many Game Changers, fast mana, tight curve, combos OK.
- **Bracket 5 — cEDH:** fully competitive, fast combo/stax, mulligans for the win, wins turns 1–4.

## Signals to read from the list
- **Speed of mana:** fast mana (Sol Ring is fine anywhere; Mana Crypt/rituals push higher).
- **Tutors:** many unconditional tutors raise consistency → higher bracket.
- **Combos:** compact 2-card infinite combos, especially early/protected, push toward 4–5.
- **Interaction density:** lots of cheap interaction (counters, free spells) signals higher power.
- **Curve & efficiency:** low curve + lean cards = higher; durdly high-CMC value = lower.
- **"Game Changers":** flag the well-known high-power staples present (fast mana, powerful tutors,
  oppressive stax, premium combo enablers). More present → higher bracket.

## To make a deck STRONGER
- Tighten the curve and add 2-CMC ramp; add cheap interaction; add a focused, compact win condition.
- Add consistency (card selection, a few tutors); cut win-more and durdle cards.

## To make a deck MORE CASUAL (rule 0 friendly)
- Cut fast mana, infinite combos, and heavy stax. Replace tutors with theme cards.
- Slow the clock; lean into the deck's flavor/theme. Aim for a fair, interactive game.

Deliver: an estimated bracket with the 3–5 signals that drove it, then a concrete swap list to move
the deck up or down to the user's target.
