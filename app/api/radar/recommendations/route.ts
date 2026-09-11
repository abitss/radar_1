import { NextResponse } from "next/server";
import { sbSelect, sbUpdate } from "@/lib/radar-db";
import { workspaceForRequest } from "@/lib/radar-workspace";

export async function GET(req: Request) {
  try {
    const { workspace } = await workspaceForRequest(req, true);
    const [rows,competitors] = await Promise.all([
      sbSelect(`radar_recommendations?workspace_id=eq.${workspace.id}&select=*&order=created_at.desc&limit=100`),
      sbSelect(`radar_competitors?workspace_id=eq.${workspace.id}&select=id,name,website,similarity_score,threat_score,movement`),
    ]);
    const byId = new Map(competitors.map((c:any)=>[c.id,c]));
    return NextResponse.json(rows.map((r:any)=>({ ...r, competitor:r.competitor_id?byId.get(r.competitor_id)||null:null })));
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error:"Unauthorized" },{status:401});
    return NextResponse.json({ error:error instanceof Error?error.message:"Decisions failed" },{status:500});
  }
}

export async function PATCH(req: Request) {
  try {
    const { workspace } = await workspaceForRequest(req, true);
    const { id, status } = await req.json();
    if (!id || !["open","accepted","dismissed","done"].includes(status)) return NextResponse.json({ error:"Invalid update" },{status:400});
    const owned = await sbSelect(`radar_recommendations?id=eq.${encodeURIComponent(id)}&workspace_id=eq.${workspace.id}&select=id&limit=1`);
    if (!owned[0]) return NextResponse.json({ error:"Decision not found" },{status:404});
    const rows = await sbUpdate("radar_recommendations",`id=eq.${id}`,{status,updated_at:new Date().toISOString()});
    return NextResponse.json(rows[0]);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error:"Unauthorized" },{status:401});
    return NextResponse.json({ error:error instanceof Error?error.message:"Decision update failed" },{status:500});
  }
}
