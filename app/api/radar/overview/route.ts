import { NextResponse } from "next/server";
import { sbSelect } from "@/lib/radar-db";
import { workspaceForRequest } from "@/lib/radar-workspace";

export async function GET(req: Request) {
  try {
    const { workspace } = await workspaceForRequest(req, true);
    const [competitors,candidates,signals,recommendations,monitors] = await Promise.all([
      sbSelect(`radar_competitors?workspace_id=eq.${workspace.id}&select=*&order=threat_score.desc&limit=100`),
      sbSelect(`radar_candidates?workspace_id=eq.${workspace.id}&select=*&order=provisional_score.desc&limit=100`),
      sbSelect(`radar_signals?workspace_id=eq.${workspace.id}&select=*&order=observed_at.desc&limit=50`),
      sbSelect(`radar_recommendations?workspace_id=eq.${workspace.id}&select=*&order=created_at.desc&limit=50`),
      sbSelect(`radar_monitors?workspace_id=eq.${workspace.id}&select=*&order=created_at.desc&limit=20`),
    ]);
    const now = Date.now();
    const day = 24*60*60*1000;
    const newSignals = signals.filter((s:any)=>now-new Date(s.observed_at||s.created_at).getTime()<=day);
    const movingCloser = competitors.filter((c:any)=>c.movement==="closer");
    const core = competitors.filter((c:any)=>Number(c.similarity_score||0)>=80);
    const openRecommendations = recommendations.filter((r:any)=>r.status==="open");
    const monitor = monitors.find((m:any)=>m.monitor_type==="web_discovery"&&m.status==="active") || null;
    return NextResponse.json({ workspace, competitors, candidates, signals, recommendations, monitor, metrics:{ competitors:competitors.length, core:core.length, candidates:candidates.length, newSignals:newSignals.length, movingCloser:movingCloser.length, openDecisions:openRecommendations.length } });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error:"Unauthorized" },{status:401});
    return NextResponse.json({ error:error instanceof Error?error.message:"Overview failed" },{status:500});
  }
}
