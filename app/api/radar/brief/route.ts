import { NextResponse } from "next/server";
import { sbSelect } from "@/lib/radar-db";
import { workspaceForRequest } from "@/lib/radar-workspace";
import { generateRadarAnswer, radarAIConfigured, radarAIProvider } from "@/lib/radar-ai";

export async function GET(req: Request) {
  try {
    const { workspace } = await workspaceForRequest(req, true);
    const [competitors,signals,recommendations,evidence] = await Promise.all([
      sbSelect(`radar_competitors?workspace_id=eq.${workspace.id}&select=*&order=threat_score.desc&limit=20`),
      sbSelect(`radar_signals?workspace_id=eq.${workspace.id}&select=*&order=observed_at.desc&limit=20`),
      sbSelect(`radar_recommendations?workspace_id=eq.${workspace.id}&select=*&order=created_at.desc&limit=20`),
      sbSelect(`radar_evidence?workspace_id=eq.${workspace.id}&select=id,competitor_id,source_url,title,fact,confidence,observed_at&order=observed_at.desc&limit=40`),
    ]);

    const provider = radarAIProvider();
    const fallback = {
      headline: signals[0]?.title || (competitors[0] ? `${competitors[0].name} is your highest-threat tracked competitor.` : "RADAR is still building your competitive universe."),
      brief: recommendations[0]?.action || "Keep monitoring active while RADAR gathers more public evidence.",
      mode: "evidence-fallback",
      provider,
    };

    if (!radarAIConfigured()) return NextResponse.json(fallback);

    try {
      const answer = await generateRadarAnswer({
        question: "Create a founder morning brief from this evidence. Give exactly: 1) one-sentence headline, 2) three concise bullets: what changed, why it matters, what I should do next. If nothing meaningful changed, say that clearly. Do not invent facts.",
        workspace,
        competitors,
        signals,
        recommendations,
        evidence,
      });
      return NextResponse.json({ headline: "Founder intelligence brief", brief: answer || fallback.brief, mode: answer ? "grounded-ai" : "evidence-fallback", provider });
    } catch {
      return NextResponse.json(fallback);
    }
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error:"Unauthorized" },{status:401});
    return NextResponse.json({ error:error instanceof Error?error.message:"Brief failed" },{status:500});
  }
}
