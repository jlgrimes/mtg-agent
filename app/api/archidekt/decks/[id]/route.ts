import { NextResponse } from "next/server";
import { archidektGet, getStoredConn } from "@/lib/archidekt";

// GET -> one deck's commander(s) + a plain-text decklist ready for the agent.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Invalid deck id." }, { status: 400 });
  }

  const conn = await getStoredConn();
  if (!conn) return NextResponse.json({ error: "Archidekt not connected." }, { status: 401 });

  const res = await archidektGet(conn, `/decks/${id}/`);
  if (!res.ok) {
    return NextResponse.json(
      { error: `Could not load deck (HTTP ${res.status}).` },
      { status: 502 },
    );
  }
  const data = await res.json();

  const entries: { qty: number; name: string; isCommander: boolean }[] = (
    data.cards ?? []
  ).map((c: Record<string, unknown>) => {
    const oracle = (c.card as Record<string, unknown>)?.oracleCard as Record<string, unknown>;
    const categories = (c.categories as string[]) ?? [];
    return {
      qty: (c.quantity as number) ?? 1,
      name: (oracle?.name as string) ?? "Unknown",
      isCommander: categories.includes("Commander"),
    };
  });

  const commanders = entries.filter((e) => e.isCommander).map((e) => e.name);
  const decklistText = entries.map((e) => `${e.qty} ${e.name}`).join("\n");
  const totalCards = entries.reduce((n, e) => n + e.qty, 0);

  return NextResponse.json({
    id: Number(id),
    name: data.name,
    commanders,
    totalCards,
    decklistText,
  });
}
