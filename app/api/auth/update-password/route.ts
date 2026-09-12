import { NextResponse } from "next/server";
import { updateFounderPassword } from "@/lib/supabase-auth";

export async function POST(req: Request) {
  try {
    const { accessToken, password } = await req.json();
    if (!accessToken) return NextResponse.json({ error: "Missing recovery token." }, { status: 400 });
    if (!password || String(password).length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });

    await updateFounderPassword(String(accessToken), String(password));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update password." }, { status: 400 });
  }
}
