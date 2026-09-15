import { NextResponse } from "next/server";
import { makeSession } from "@/lib/radar-auth";
import { signInFounder } from "@/lib/supabase-auth";

function extractToken(auth: any) {
  return auth?.access_token || auth?.session?.access_token || auth?.data?.session?.access_token || null;
}

function extractUser(auth: any, fallbackEmail: string) {
  const direct = auth?.user || auth?.data?.user || auth?.session?.user || auth?.data?.session?.user;
  if (direct?.id) return { id: String(direct.id), email: String(direct.email || fallbackEmail) };

  const token = extractToken(auth);
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
    if (!normalizedEmail || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const auth = await signInFounder(normalizedEmail, String(password));
    const user = extractUser(auth, normalizedEmail);
    if (!user) {
      return NextResponse.json({ error: "Supabase signed you in, but RADAR could not establish your workspace session. Please try again." }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true, user });
    res.cookies.set("radar_session", makeSession(user), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    const status = /confirm/i.test(message) ? 403 : 401;
    return NextResponse.json({ error: message }, { status });
  }
}
