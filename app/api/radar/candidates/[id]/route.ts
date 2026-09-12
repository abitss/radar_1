import { NextResponse } from "next/server";
import { sbInsert, sbSelect, sbUpdate } from "@/lib/radar-db";
import { workspaceForRequest } from "@/lib/radar-workspace";

function originOf(raw:string){try{return new URL(raw).origin}catch{return raw}}

export async function PATCH(req:Request, context:{params:Promise<{id:string}>}){
  try{
    const {workspace}=await workspaceForRequest(req,true);
    const {id}=await context.params;
    const body=await req.json();
    const action=String(body.action||"");
    const rows=await sbSelect(`radar_candidates?id=eq.${encodeURIComponent(id)}&workspace_id=eq.${workspace.id}&select=*&limit=1`);
    const candidate=rows[0];
    if(!candidate)return NextResponse.json({error:"Candidate not found"},{status:404});

    if(action==="reject"||action==="ignore"){
      const updated=await sbUpdate("radar_candidates",`id=eq.${candidate.id}`,{status:action==="reject"?"rejected":"ignored",updated_at:new Date().toISOString()});
      return NextResponse.json({ok:true,candidate:updated[0]||candidate});
    }

    if(action==="approve"){
      const website=originOf(candidate.url);
      const existing=await sbSelect(`radar_competitors?workspace_id=eq.${workspace.id}&website=eq.${encodeURIComponent(website)}&select=*&limit=1`);
      let competitor=existing[0]||null;
      if(!competitor){
        const score=Math.max(0,Math.min(100,Math.round(Number(candidate.provisional_score||0))));
        const created=await sbInsert("radar_competitors",{
          workspace_id:workspace.id,
          name:String(candidate.title||candidate.domain).split(/[|–—-]/)[0].trim().slice(0,80),
          website,
          description:candidate.description||null,
          category:score>=80?"direct":score>=55?"adjacent":score>=30?"micro":"emerging",
          similarity_score:score,
          threat_score:Math.min(100,Math.round(score*1.08)),
          momentum_score:35,
          movement:"stable",
          monitoring_preference:"monitor",
          why_it_matters:`Approved by founder from RADAR discovery with provisional similarity ${score}%.`,
        });
        competitor=created[0]||null;
      }else if(competitor.monitoring_preference!=="monitor"){
        const updated=await sbUpdate("radar_competitors",`id=eq.${competitor.id}`,{monitoring_preference:"monitor",updated_at:new Date().toISOString()});
        competitor=updated[0]||competitor;
      }
      await sbUpdate("radar_candidates",`id=eq.${candidate.id}`,{status:"promoted",updated_at:new Date().toISOString()});
      return NextResponse.json({ok:true,competitor});
    }

    return NextResponse.json({error:"Unsupported candidate action"},{status:400});
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});
    return NextResponse.json({error:error instanceof Error?error.message:"Candidate action failed"},{status:500});
  }
}
