import { NextResponse } from "next/server";
import { sbSelect, sbUpdate } from "@/lib/radar-db";

export async function GET() {
  const rows = await sbSelect("radar_workspaces?select=*&order=created_at.asc&limit=1");
  return NextResponse.json(rows[0] ?? null);
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const rows = await sbSelect("radar_workspaces?select=id&order=created_at.asc&limit=1");
  if (!rows[0]) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  const updated = await sbUpdate("radar_workspaces", `id=eq.${rows[0].id}`, { ...body, updated_at: new Date().toISOString() });
  return NextResponse.json(updated[0]);
}
