import { NextResponse } from "next/server";
import { getStoredConn } from "@/lib/archidekt";

// GET -> whether the signed-in user has connected Archidekt (no token exposed).
export async function GET() {
  const conn = await getStoredConn();
  return NextResponse.json({ connected: !!conn, username: conn?.username ?? null });
}
