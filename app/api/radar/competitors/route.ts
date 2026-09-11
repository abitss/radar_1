import { NextResponse } from "next/server";
import { sbInsert, sbSelect } from "@/lib/radar-db";
import { workspaceForRequest } from "@/lib/radar-workspace";

export async function GET(req: Request) {
  try {
    const { workspace } = await workspaceForRequest(req, true);
    const rows = await sbSelect(`radar_competitors?workspace_id=eq.${workspace.id}&select=*&order=similarity_score.desc`);
    return NextResponse.json(rows);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load competitors" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { workspace } = await workspaceForRequest(req, true);
    const website = String(body.website || "").trim();
    if (!website) return NextResponse.json({ error: "Website is required" }, { status: 400 });
    let url = website;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return NextResponse.json({ error: "Only http/https URLs are allowed" }, { status: 400 });
    const host = parsed.hostname.replace(/^www\./, "");
    const name = String(body.name || host.split(".")[0]).trim();
    const rows = await sbInsert("radar_competitors", {
      workspace_id: workspace.id,
      name,
      website: parsed.origin,
      description: body.description || null,
      category: "emerging",
      similarity_score: 0,
      threat_score: 0,
      momentum_score: 0,
      movement: "stable",
      why_it_matters: "Added to the competitive universe. Run a deep scan to calculate overlap.",
    });
    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not add competitor" }, { status: 500 });
  }
}
