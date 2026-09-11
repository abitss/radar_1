import { NextResponse } from "next/server";
import { sendPasswordRecovery } from "@/lib/supabase-auth";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail) return NextResponse.json({ error: "Email is required." }, { status: 400 });

    const origin = new URL(req.url).origin;
    await sendPasswordRecovery(normalizedEmail, `${origin}/reset-password`);
    return NextResponse.json({ ok: true, message: "Password reset email sent. Open it to choose a new RADAR password." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not send password reset email." }, { status: 400 });
  }
}
