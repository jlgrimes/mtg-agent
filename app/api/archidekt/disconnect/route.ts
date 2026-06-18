import { NextResponse } from "next/server";
import { clearConn } from "@/lib/archidekt";

// POST -> forget the stored Archidekt token for the signed-in user.
export async function POST() {
  await clearConn();
  return NextResponse.json({ connected: false });
}
