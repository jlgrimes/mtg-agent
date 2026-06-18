import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { loginArchidekt, storeConn } from "@/lib/archidekt";

// POST { identifier, password } -> logs into Archidekt, stores the JWT on the
// signed-in user's Clerk profile. Returns the connected Archidekt username.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  let identifier: string;
  let password: string;
  try {
    const body = await req.json();
    identifier = String(body.identifier ?? "").trim();
    password = String(body.password ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!identifier || !password) {
    return NextResponse.json({ error: "Username/email and password are required." }, { status: 400 });
  }

  try {
    const conn = await loginArchidekt(identifier, password);
    await storeConn({ ...conn, connectedAt: new Date().toISOString() });
    return NextResponse.json({ connected: true, username: conn.username });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Archidekt login failed." },
      { status: 400 },
    );
  }
}
