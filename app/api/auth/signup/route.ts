import { NextResponse } from "next/server";
import { makeSession, sessionCookie } from "@/lib/radar-auth";
import { signUpFounder } from "@/lib/supabase-auth";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password || String(password).length < 8) return NextResponse.json({ error: "Use a valid email and password of at least 8 characters." }, { status: 400 });
    const auth = await signUpFounder(String(email).trim().toLowerCase(), String(password));
    if (!auth?.user?.id || !auth?.user?.email) return NextResponse.json({ error: "Signup succeeded, but no user session was returned." }, { status: 400 });
    if (!auth?.access_token && !auth?.session?.access_token) return NextResponse.json({ ok: true, needsVerification: true, message: "Check your email to verify the account, then sign in." });
    const res = NextResponse.json({ ok: true, user: { id: auth.user.id, email: auth.user.email } });
    res.headers.set("Set-Cookie", sessionCookie(makeSession({ id: auth.user.id, email: auth.user.email })));
    return res;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Signup failed" }, { status: 400 });
  }
}
