import { NextResponse } from "next/server";
import { fetchDeckDetail, getStoredConn } from "@/lib/archidekt";

// GET -> one deck's commander(s) + a plain-text decklist ready for the agent.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Invalid deck id." }, { status: 400 });
  }

  const conn = await getStoredConn();
  if (!conn) return NextResponse.json({ error: "Archidekt not connected." }, { status: 401 });

  const deck = await fetchDeckDetail(id);
  if (!deck) {
    return NextResponse.json({ error: "Could not load deck." }, { status: 502 });
  }
  return NextResponse.json(deck);
}
