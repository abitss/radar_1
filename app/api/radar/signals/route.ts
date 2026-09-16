import { NextResponse } from "next/server";
import { sbSelect } from "@/lib/radar-db";
import { workspaceForRequest } from "@/lib/radar-workspace";

export async function GET(req: Request) {
  try {
    const { workspace } = await workspaceForRequest(req, true);
    const [signals,competitors] = await Promise.all([
      sbSelect(`radar_signals?workspace_id=eq.${workspace.id}&select=*&order=observed_at.desc&limit=100`),
      sbSelect(`radar_competitors?workspace_id=eq.${workspace.id}&select=id,name,website,similarity_score,threat_score,movement`),
    ]);
    const byId = new Map(competitors.map((c:any)=>[c.id,c]));
    return NextResponse.json(signals.map((s:any)=>({ ...s, competitor:s.competitor_id?byId.get(s.competitor_id)||null:null })));
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error:"Unauthorized" },{status:401});
    return NextResponse.json({ error:error instanceof Error?error.message:"Signals failed" },{status:500});
  }
}
