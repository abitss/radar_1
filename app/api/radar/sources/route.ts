import { NextResponse } from "next/server";
import { sbSelect } from "@/lib/radar-db";
import { workspaceForRequest } from "@/lib/radar-workspace";

export async function GET(req:Request){
  try{
    const {workspace}=await workspaceForRequest(req,true);
    const [monitors,evidence,competitors]=await Promise.all([
      sbSelect(`radar_monitors?workspace_id=eq.${workspace.id}&select=*&order=created_at.desc&limit=100`),
      sbSelect(`radar_evidence?workspace_id=eq.${workspace.id}&select=id,competitor_id,source_url,source_type,title,confidence,observed_at&order=observed_at.desc&limit=200`),
      sbSelect(`radar_competitors?workspace_id=eq.${workspace.id}&select=id,name,website,category,monitoring_preference&order=threat_score.desc&limit=100`),
    ]);
    const competitorMap=new Map(competitors.map((c:any)=>[c.id,c]));
    const monitorRows=monitors.map((m:any)=>({...m,competitor:m.competitor_id?competitorMap.get(m.competitor_id)||null:null}));
    const byType:Record<string,number>={};
    for(const e of evidence)byType[e.source_type]=(byType[e.source_type]||0)+1;
    return NextResponse.json({monitors:monitorRows,evidence,competitors,source_types:byType});
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});
    return NextResponse.json({error:error instanceof Error?error.message:"Could not load source coverage"},{status:500});
  }
}
