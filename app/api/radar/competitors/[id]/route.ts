import { NextResponse } from "next/server";
import { deleteMonitor } from "@/lib/firecrawl";
import { sbDelete, sbSelect, sbUpdate } from "@/lib/radar-db";
import { workspaceForRequest } from "@/lib/radar-workspace";

const categories=new Set(["direct","adjacent","substitute","emerging","incumbent","watchlist"]);

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { workspace } = await workspaceForRequest(req, true);
    const { id } = await context.params;
    const rows = await sbSelect(`radar_competitors?id=eq.${encodeURIComponent(id)}&workspace_id=eq.${workspace.id}&select=*&limit=1`);
    const competitor = rows[0];
    if (!competitor) return NextResponse.json({ error: "Competitor not found" }, { status: 404 });

    const [dimensions,evidence,signals,recommendations,monitors,sources,moves] = await Promise.all([
      sbSelect(`radar_similarity_dimensions?competitor_id=eq.${competitor.id}&select=*&limit=1`),
      sbSelect(`radar_evidence?workspace_id=eq.${workspace.id}&competitor_id=eq.${competitor.id}&select=*&order=observed_at.desc&limit=100`),
      sbSelect(`radar_signals?workspace_id=eq.${workspace.id}&competitor_id=eq.${competitor.id}&select=*&order=observed_at.desc&limit=60`),
      sbSelect(`radar_recommendations?workspace_id=eq.${workspace.id}&competitor_id=eq.${competitor.id}&select=*&order=created_at.desc&limit=40`),
      sbSelect(`radar_monitors?workspace_id=eq.${workspace.id}&competitor_id=eq.${competitor.id}&select=*&order=created_at.desc&limit=30`),
      sbSelect(`radar_sources?workspace_id=eq.${workspace.id}&competitor_id=eq.${competitor.id}&select=*&order=priority.desc,updated_at.desc&limit=100`).catch(()=>[]),
      sbSelect(`radar_moves?workspace_id=eq.${workspace.id}&competitor_id=eq.${competitor.id}&select=*&order=updated_at.desc&limit=30`).catch(()=>[]),
    ]);

    let decisions:any[]=[];
    if(moves.length){
      const moveIds=moves.map((m:any)=>String(m.id)).filter(Boolean);
      if(moveIds.length){
        decisions=await sbSelect(`radar_decisions?workspace_id=eq.${workspace.id}&move_id=in.(${moveIds.join(",")})&select=*&order=updated_at.desc&limit=30`).catch(()=>[]);
      }
    }

    const activeMonitor=monitors.find((m:any)=>m.status==="active")||null;
    const healthySources=sources.filter((s:any)=>s.status==="active"&&s.health==="healthy").length;
    const verification_status=competitor.last_scanned_at?"verified":evidence.length?"evidence-backed":"provisional";
    return NextResponse.json({
      competitor,
      dimensions: dimensions[0] || null,
      evidence,
      signals,
      recommendations,
      monitors,
      sources,
      moves,
      decisions,
      state:{
        verification_status,
        active_monitor:Boolean(activeMonitor),
        monitor_status:activeMonitor?.status||monitors[0]?.status||null,
        monitor_last_event_at:activeMonitor?.last_event_at||monitors[0]?.last_event_at||null,
        monitor_error:activeMonitor?.last_error||monitors[0]?.last_error||null,
        healthy_sources:healthySources,
        source_count:sources.length,
        evidence_count:evidence.length,
        high_confidence_evidence:evidence.filter((e:any)=>Number(e.confidence||0)>=80).length,
        open_recommendations:recommendations.filter((r:any)=>r.status==="open").length,
        active_moves:moves.filter((m:any)=>["watching","confirmed"].includes(String(m.status))).length,
        open_decisions:decisions.filter((d:any)=>d.status==="open").length,
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error:"Unauthorized" },{status:401});
    return NextResponse.json({ error:error instanceof Error?error.message:"Dossier failed" },{status:500});
  }
}

export async function PATCH(req:Request,context:{params:Promise<{id:string}>}){
  try{
    const {workspace}=await workspaceForRequest(req,true);
    const {id}=await context.params;
    const rows=await sbSelect(`radar_competitors?id=eq.${encodeURIComponent(id)}&workspace_id=eq.${workspace.id}&select=id,category_locked&limit=1`);
    if(!rows[0])return NextResponse.json({error:"Competitor not found"},{status:404});
    const body=await req.json();
    const patch:any={updated_at:new Date().toISOString()};
    if(body.category){
      const category=String(body.category);
      if(!categories.has(category))return NextResponse.json({error:"Invalid category"},{status:400});
      patch.category=category;
      patch.category_locked=true;
    }
    if(body.unlock_category===true)patch.category_locked=false;
    if(body.monitoring_preference){
      const pref=String(body.monitoring_preference);
      if(!["auto","monitor","ignore"].includes(pref))return NextResponse.json({error:"Invalid monitoring preference"},{status:400});
      patch.monitoring_preference=pref;
    }
    if(body.user_feedback)patch.user_feedback=String(body.user_feedback).slice(0,80);
    const updated=await sbUpdate("radar_competitors",`id=eq.${id}&workspace_id=eq.${workspace.id}`,patch);
    return NextResponse.json(updated[0]||null);
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});
    return NextResponse.json({error:error instanceof Error?error.message:"Competitor update failed"},{status:500});
  }
}

export async function DELETE(req:Request,context:{params:Promise<{id:string}>}){
  try{
    const {workspace}=await workspaceForRequest(req,true);
    const {id}=await context.params;
    const rows=await sbSelect(`radar_competitors?id=eq.${encodeURIComponent(id)}&workspace_id=eq.${workspace.id}&select=id&limit=1`);
    if(!rows[0])return NextResponse.json({error:"Competitor not found"},{status:404});

    const activeMonitors=await sbSelect(`radar_monitors?workspace_id=eq.${workspace.id}&competitor_id=eq.${id}&status=in.(active,pending,error)&select=id,provider_monitor_id,status&limit=100`).catch(()=>[]);
    const providerFailures:string[]=[];
    for(const monitor of activeMonitors){
      if(monitor.provider_monitor_id){
        try{await deleteMonitor(String(monitor.provider_monitor_id))}
        catch(error){providerFailures.push(error instanceof Error?error.message:"Provider monitor deletion failed")}
      }
    }
    if(providerFailures.length){
      return NextResponse.json({error:"RADAR could not safely remove this competitor because at least one provider monitor may still be active. Retry after the provider recovers.",details:providerFailures.slice(0,3)},{status:502});
    }

    const moveRows=await sbSelect(`radar_moves?workspace_id=eq.${workspace.id}&competitor_id=eq.${id}&select=id&limit=100`).catch(()=>[]);
    for(const move of moveRows){
      const decisions=await sbSelect(`radar_decisions?workspace_id=eq.${workspace.id}&move_id=eq.${move.id}&select=id&limit=100`).catch(()=>[]);
      for(const decision of decisions){
        await sbDelete("radar_actions",`workspace_id=eq.${workspace.id}&decision_id=eq.${decision.id}`).catch(()=>{});
        await sbDelete("radar_outcomes",`workspace_id=eq.${workspace.id}&decision_id=eq.${decision.id}`).catch(()=>{});
      }
      await sbDelete("radar_decisions",`workspace_id=eq.${workspace.id}&move_id=eq.${move.id}`).catch(()=>{});
      await sbDelete("radar_move_signals",`move_id=eq.${move.id}`).catch(()=>{});
    }

    await Promise.all([
      sbDelete("radar_sources",`workspace_id=eq.${workspace.id}&competitor_id=eq.${id}`).catch(()=>{}),
      sbDelete("radar_similarity_dimensions",`competitor_id=eq.${id}`).catch(()=>{}),
      sbDelete("radar_recommendations",`workspace_id=eq.${workspace.id}&competitor_id=eq.${id}`).catch(()=>{}),
      sbDelete("radar_signals",`workspace_id=eq.${workspace.id}&competitor_id=eq.${id}`).catch(()=>{}),
      sbDelete("radar_evidence",`workspace_id=eq.${workspace.id}&competitor_id=eq.${id}`).catch(()=>{}),
      sbDelete("radar_moves",`workspace_id=eq.${workspace.id}&competitor_id=eq.${id}`).catch(()=>{}),
    ]);
    await sbDelete("radar_competitors",`id=eq.${id}&workspace_id=eq.${workspace.id}`);
    return NextResponse.json({ok:true});
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});
    return NextResponse.json({error:error instanceof Error?error.message:"Competitor removal failed"},{status:500});
  }
}
