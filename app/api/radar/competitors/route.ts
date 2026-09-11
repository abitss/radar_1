import { NextResponse } from "next/server";
import { sbInsert, sbSelect } from "@/lib/radar-db";

export async function GET() {
  const workspaces = await sbSelect("radar_workspaces?select=id&order=created_at.asc&limit=1");
  if (!workspaces[0]) return NextResponse.json([]);
  const rows = await sbSelect(`radar_competitors?workspace_id=eq.${workspaces[0].id}&select=*&order=similarity_score.desc`);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const workspaces = await sbSelect("radar_workspaces?select=id&order=created_at.asc&limit=1");
  if (!workspaces[0]) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  const website = String(body.website || "").trim();
  if (!website) return NextResponse.json({ error: "Website is required" }, { status: 400 });
  let url = website;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  const host = new URL(url).hostname.replace(/^www\./, "");
  const name = String(body.name || host.split(".")[0]).trim();
  const rows = await sbInsert("radar_competitors", {
    workspace_id: workspaces[0].id,
    name,
    website: url,
    description: body.description || null,
    category: "emerging",
    similarity_score: 0,
    threat_score: 0,
    momentum_score: 0,
    movement: "stable",
    why_it_matters: "Added to the competitive universe. Run a deep scan to calculate overlap.",
  });
  return NextResponse.json(rows[0], { status: 201 });
}
