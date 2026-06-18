# Commander Copilot 🪄

An AI agent that helps you build **Magic: The Gathering Commander (EDH)** decks — recommend
upgrades, optimize your mana curve, find spicy cards, and assess power level. Built on
[Vercel **eve**](https://vercel.com/docs/eve) and powered by Claude Sonnet 4.6.

It pulls live data from:

- **[Scryfall](https://scryfall.com/docs/api)** — official card database (oracle text, costs, color
  identity, prices, Commander legality, and full search syntax).
- **[EDHREC](https://edhrec.com)** — crowd-sourced recommendations and synergy data for commanders.
- **[Archidekt](https://archidekt.com)** — import a deck by URL via their open API.

> **Note on Moxfield:** Moxfield's public API is closed (it returns HTTP 403), so the agent can't
> read Moxfield decks directly. Use Moxfield's **Export** button and paste the list — the
> `analyze_decklist` tool reads plain-text exports from Moxfield, Archidekt, MTGGoldfish, Arena, and MTGO.

## What it can do

- "Here's my **Atraxa** decklist — what should I upgrade?" (paste the list)
- "Optimize my mana curve" / "How many lands should I run?"
- "Any cool cards for a **Miirym** dragons deck under $5 each?"
- "Import https://archidekt.com/decks/123456 and tell me its power level."
- "What pairs well with **Cathars' Crusade**?"

## Project layout

```
agent/
  agent.ts                  # model config (anthropic/claude-sonnet-4.6)
  instructions.md           # always-on system prompt (the agent's persona + rules)
  lib/
    scryfall.ts             # Scryfall client (lookup, search, batch collection)
    edhrec.ts               # EDHREC json.edhrec.com client + name slugifier
    decklist.ts             # decklist parser + curve/type/pip/price analysis
  tools/
    scryfall_card.ts        # look up one card's full details
    scryfall_search.ts      # search cards by Scryfall query syntax
    edhrec_commander.ts     # recommended cards for a commander
    edhrec_card.ts          # cards that synergize with a given card
    analyze_decklist.ts     # parse a pasted list -> stats
    archidekt_import.ts     # import a deck from Archidekt
  skills/
    optimize-mana-curve.md  # playbook: curve & mana base
    recommend-upgrades.md   # playbook: upgrades + cuts
    tune-power-level.md      # playbook: bracket assessment & tuning
```

## Requirements

- **Node ≥ 24** (eve requires it). This repo pins it via `.nvmrc`; run `nvm use` first.

## Run it locally

```bash
nvm use                 # switch to Node 24 (see .nvmrc)
npm exec -- eve dev      # interactive terminal UI; type a message to chat
```

`eve dev` opens an interactive TUI — just start typing to the agent.

### Or hit the HTTP session API

```bash
# start a durable session
curl -X POST http://127.0.0.1:3000/eve/v1/session \
  -H 'content-type: application/json' \
  -d '{"message":"Recommend 5 upgrades for my Miirym, Sentinel Wyrm deck"}'

# stream events for the returned session id
curl http://127.0.0.1:3000/eve/v1/session/<sessionId>/stream
```

## Deploy

It's a normal Vercel project:

```bash
vercel deploy
```

On Vercel, model calls route through the AI Gateway (OIDC auth) — no provider API keys to manage.
The data-source APIs (Scryfall, EDHREC, Archidekt) need no keys.

---

*Card data © Wizards of the Coast, via Scryfall. EDHREC and Archidekt are third-party community
services; this project uses their public endpoints on a best-effort basis and is not affiliated with them.*
