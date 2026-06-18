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
}

// GET -> the signed-in user's Commander decks (public + private), newest first.
export async function GET() {
  const conn = await getStoredConn();
  if (!conn) return NextResponse.json({ error: "Archidekt not connected." }, { status: 401 });

  // deckFormat=3 is Commander/EDH on Archidekt. owner=<id> with the user's token
  // includes their private and unlisted decks.
  const res = await archidektGet(
    conn,
    `/decks/v3/?owner=${conn.userId}&deckFormat=3&orderBy=-updatedAt&pageSize=50`,
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
  }));

  return NextResponse.json({ decks, total: data.count ?? decks.length });
}
