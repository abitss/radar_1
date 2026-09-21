import { NextResponse } from "next/server";
import { sbSelect } from "@/lib/radar-db";
import { workspaceForRequest } from "@/lib/radar-workspace";

export async function GET(req:Request){
  try{
    const {workspace}=await workspaceForRequest(req,true);
    const [monitors,evidence,competitors,sources,tasks]=await Promise.all([
      sbSelect(`radar_monitors?workspace_id=eq.${workspace.id}&select=*&order=created_at.desc&limit=100`),
      sbSelect(`radar_evidence?workspace_id=eq.${workspace.id}&select=id,competitor_id,source_url,source_type,title,confidence,observed_at&order=observed_at.desc&limit=200`),
      sbSelect(`radar_competitors?workspace_id=eq.${workspace.id}&select=id,name,website,category,monitoring_preference,threat_score&order=threat_score.desc&limit=100`),
      sbSelect(`radar_sources?workspace_id=eq.${workspace.id}&select=*&order=priority.desc,last_checked_at.desc&limit=300`),
      sbSelect(`radar_recurring_tasks?workspace_id=eq.${workspace.id}&select=*&order=next_run_at.asc&limit=30`),
    ]);
    const competitorMap=new Map(competitors.map((c:any)=>[c.id,c]));
    const monitorRows=monitors.map((m:any)=>({...m,competitor:m.competitor_id?competitorMap.get(m.competitor_id)||null:null}));
    const sourceRows=sources.map((s:any)=>({...s,competitor:s.competitor_id?competitorMap.get(s.competitor_id)||null:null}));
    const byType:Record<string,number>={};
    for(const e of evidence)byType[e.source_type]=(byType[e.source_type]||0)+1;
    const snapshotCounts:Record<string,number>={};
    for(const source of sources.slice(0,100)){
      const rows=await sbSelect(`radar_snapshots?source_id=eq.${source.id}&select=id&limit=200`);
      snapshotCounts[source.id]=rows.length;
    }
    return NextResponse.json({
      monitors:monitorRows,
      evidence,
      competitors,
      source_types:byType,
      sources:sourceRows.map((s:any)=>({...s,snapshot_count:snapshotCounts[s.id]||0})),
      recurring_tasks:tasks,
      health:{
        healthy:sources.filter((s:any)=>s.health==="healthy").length,
        error:sources.filter((s:any)=>s.health==="error").length,
        unknown:sources.filter((s:any)=>!s.health||s.health==="unknown").length,
        changed_24h:sources.filter((s:any)=>s.last_changed_at&&Date.now()-new Date(s.last_changed_at).getTime()<24*3600*1000).length,
        snapshots:Object.values(snapshotCounts).reduce((a,b)=>a+Number(b||0),0),
      }
    });
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});
    return NextResponse.json({error:error instanceof Error?error.message:"Could not load source coverage"},{status:500});
  }
}
