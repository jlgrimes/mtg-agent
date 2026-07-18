"use client";

import { HoverCard } from "@astryxdesign/core/HoverCard";
import { Lightbox } from "@astryxdesign/core/Lightbox";
import { useState } from "react";

// Scryfall's named-card endpoint redirects straight to card imagery:
// deterministic URL, fuzzy name matching, no API key. https://scryfall.com/docs/api/cards/named
function cardImageUrl(name: string, version: "normal" | "large"): string {
  return `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}&format=image&version=${version}`;
}

// An interactive Magic card reference: hover (or focus) shows the card image
// in a HoverCard; tap/click opens it full-size in a Lightbox.
export function CardRef({ name }: { readonly name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <HoverCard
        content={
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={name}
            className="block h-auto w-60 rounded-[4.75%/3.5%]"
            loading="lazy"
            src={cardImageUrl(name, "normal")}
          />
        }
        placement="above"
      >
        <button
          className="cursor-pointer font-medium underline decoration-dotted underline-offset-2 transition-opacity hover:opacity-75"
          onClick={() => setOpen(true)}
          type="button"
        >
          {name}
        </button>
      </HoverCard>
      {open ? (
        <Lightbox
          isOpen={open}
          media={{ alt: name, src: cardImageUrl(name, "large") }}
          onOpenChange={setOpen}
        />
      ) : null}
    </>
  );
}

// Markdown inline plugin: turns [[Card Name]] in agent prose into a CardRef.
// (Shape matches Astryx's MarkdownInlinePlugin structurally.)
export const CARD_REF_PLUGINS = [
  {
    pattern: /\[\[([^\[\]\n]{2,80})\]\]/g,
    render: (match: RegExpMatchArray, key: string) => (
      <CardRef key={key} name={(match[1] ?? "").trim()} />
    ),
  },
];
