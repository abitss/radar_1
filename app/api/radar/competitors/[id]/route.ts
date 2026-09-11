import { NextResponse } from "next/server";
import { sbSelect } from "@/lib/radar-db";
import { workspaceForRequest } from "@/lib/radar-workspace";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { workspace } = await workspaceForRequest(req, true);
    const { id } = await context.params;
    const rows = await sbSelect(`radar_competitors?id=eq.${encodeURIComponent(id)}&workspace_id=eq.${workspace.id}&select=*&limit=1`);
    const competitor = rows[0];
    if (!competitor) return NextResponse.json({ error: "Competitor not found" }, { status: 404 });
    const [dimensions,evidence,signals,recommendations,monitors] = await Promise.all([
      sbSelect(`radar_similarity_dimensions?competitor_id=eq.${competitor.id}&select=*&limit=1`),
      sbSelect(`radar_evidence?workspace_id=eq.${workspace.id}&competitor_id=eq.${competitor.id}&select=*&order=observed_at.desc&limit=50`),
      sbSelect(`radar_signals?workspace_id=eq.${workspace.id}&competitor_id=eq.${competitor.id}&select=*&order=observed_at.desc&limit=30`),
      sbSelect(`radar_recommendations?workspace_id=eq.${workspace.id}&competitor_id=eq.${competitor.id}&select=*&order=created_at.desc&limit=20`),
      sbSelect(`radar_monitors?workspace_id=eq.${workspace.id}&competitor_id=eq.${competitor.id}&select=*&order=created_at.desc&limit=10`),
    ]);
    return NextResponse.json({ competitor, dimensions: dimensions[0] || null, evidence, signals, recommendations, monitors });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error:"Unauthorized" },{status:401});
    return NextResponse.json({ error:error instanceof Error?error.message:"Dossier failed" },{status:500});
  }
}
