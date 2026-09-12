import { NextResponse } from "next/server";
import { makeSession, sessionCookie } from "@/lib/radar-auth";
import { signUpFounder } from "@/lib/supabase-auth";

function sessionToken(auth: any) {
  return auth?.access_token || auth?.session?.access_token || auth?.data?.session?.access_token || null;
}

function sessionUser(auth: any, fallbackEmail: string) {
  const direct = auth?.user || auth?.data?.user;
  if (direct?.id) return { id: String(direct.id), email: String(direct.email || fallbackEmail) };

  const token = sessionToken(auth);
  if (!token) return null;
  try {
    const payload = JSON.parse(Buffer.from(String(token).split(".")[1], "base64url").toString("utf8"));
    if (payload?.sub) return { id: String(payload.sub), email: String(payload.email || fallbackEmail) };
  } catch {}
  return null;
}

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail || !password || String(password).length < 8) {
      return NextResponse.json({ error: "Use a valid email and password of at least 8 characters." }, { status: 400 });
    }

    const origin = new URL(req.url).origin;
    const auth = await signUpFounder(normalizedEmail, String(password), `${origin}/login?verified=1`);
    const token = sessionToken(auth);

    // Hosted Supabase projects normally require email confirmation. In that
    // flow signup succeeds but no authenticated session is returned yet.
    if (!token) {
      return NextResponse.json({
        ok: true,
        needsVerification: true,
        message: "Account created. Check your email to verify it, then sign in to RADAR.",
      });
    }

    const user = sessionUser(auth, normalizedEmail);
    if (!user) {
      return NextResponse.json({ error: "Account was created, but RADAR could not establish the signed-in session. Please sign in." }, { status: 409 });
    }

    const res = NextResponse.json({ ok: true, user });
    res.headers.set("Set-Cookie", sessionCookie(makeSession(user)));
    return res;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Signup failed" }, { status: 400 });
  }
}
