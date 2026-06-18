import { NextResponse } from "next/server";
import { archidektGet, getStoredConn } from "@/lib/archidekt";

interface DeckSummary {
  id: number;
  name: string;
  size: number;
  colors: string[];
  bracket: number | null;
  updatedAt: string;
  private: boolean;
  unlisted: boolean;
  featured: string | null;
}

// GET -> the signed-in user's Commander decks (public + private), newest first.
export async function GET() {
  const conn = await getStoredConn();
  if (!conn) return NextResponse.json({ error: "Archidekt not connected." }, { status: 401 });

  // deckFormat=3 is Commander/EDH on Archidekt. NOTE: the `owner=<id>` param does
  // NOT actually filter (it returns everyone's decks); `ownerUsername` does. With
  // the user's own token this also surfaces their private/unlisted decks.
  const res = await archidektGet(
    conn,
    `/decks/v3/?ownerUsername=${encodeURIComponent(conn.username)}&deckFormat=3&orderBy=-updatedAt&pageSize=50`,
  );
  if (!res.ok) {
    return NextResponse.json(
      { error: `Archidekt returned HTTP ${res.status}. Try reconnecting.` },
      { status: 502 },
    );
  }
  const data = await res.json();
  const decks: DeckSummary[] = (data.results ?? []).map((d: Record<string, unknown>) => ({
    id: d.id as number,
    name: (d.name as string) ?? "Untitled",
    size: (d.size as number) ?? 0,
    colors: (d.colors as string[]) ?? [],
    bracket: (d.edhBracket as number) ?? null,
    updatedAt: (d.updatedAt as string) ?? "",
    private: Boolean(d.private),
    unlisted: Boolean(d.unlisted),
    // Archidekt's deck list ships a ready art-crop cover URL; use it as the deck card image.
    featured: typeof d.featured === "string" && d.featured ? (d.featured as string) : null,
  }));

  return NextResponse.json({ decks, total: data.count ?? decks.length });
}
