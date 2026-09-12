import { NextResponse } from "next/server";
import { sendMagicLinkFounder } from "@/lib/supabase-auth";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail) return NextResponse.json({ error: "Email is required." }, { status: 400 });

    const origin = new URL(req.url).origin;
    await sendMagicLinkFounder(normalizedEmail, `${origin}/auth/callback`);
    return NextResponse.json({ ok: true, message: "Secure sign-in link sent. Check your email and open it to enter RADAR." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not send sign-in link" }, { status: 400 });
  }
}
