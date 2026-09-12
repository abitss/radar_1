import { NextResponse } from "next/server";
import { makeSession } from "@/lib/radar-auth";
import { getFounderFromAccessToken } from "@/lib/supabase-auth";

export async function POST(req: Request) {
  try {
    const { accessToken } = await req.json();
    if (!accessToken) return NextResponse.json({ error: "Missing verified access token." }, { status: 400 });

    const user = await getFounderFromAccessToken(String(accessToken));
    if (!user?.id || !user?.email) return NextResponse.json({ error: "Could not verify RADAR account." }, { status: 401 });

    const radarUser = { id: String(user.id), email: String(user.email).toLowerCase() };
    const res = NextResponse.json({ ok: true, user: radarUser });
    res.cookies.set("radar_session", makeSession(radarUser), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not establish RADAR session." }, { status: 401 });
  }
}
