import { NextResponse } from "next/server";
import { makeSession, sessionCookie } from "@/lib/radar-auth";
import { signInFounder } from "@/lib/supabase-auth";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    const auth = await signInFounder(String(email).trim().toLowerCase(), String(password));
    if (!auth?.user?.id || !auth?.user?.email) return NextResponse.json({ error: "Could not create session." }, { status: 401 });
    const res = NextResponse.json({ ok: true, user: { id: auth.user.id, email: auth.user.email } });
    res.headers.set("Set-Cookie", sessionCookie(makeSession({ id: auth.user.id, email: auth.user.email })));
    return res;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Login failed" }, { status: 401 });
  }
}
