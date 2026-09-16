import { NextResponse } from "next/server";
import { sbSelect } from "@/lib/radar-db";
import { radarEngineAIStatus, radarEngineText } from "@/lib/radar-engine-ai";
import { ensureWorkspaceSources, runWorkspaceSourceMonitor } from "@/lib/radar-source-monitor";
import { detectMovesForWorkspace } from "@/lib/radar-moves";
import { workspaceForRequest } from "@/lib/radar-workspace";

export const runtime="nodejs";
export const dynamic="force-dynamic";

async function internal(req:Request,path:string,body?:unknown){
  const headers:Record<string,string>={"Content-Type":"application/json"};
  const cookie=req.headers.get("cookie");if(cookie)headers.cookie=cookie;
  const systemWorkspace=req.headers.get("x-radar-system-workspace");if(systemWorkspace)headers["x-radar-system-workspace"]=systemWorkspace;
  const apiKey=req.headers.get("x-radar-api-key");if(apiKey)headers["x-radar-api-key"]=apiKey;
  const res=await fetch(new URL(path,req.url),{method:"POST",headers,body:body===undefined?undefined:JSON.stringify(body),cache:"no-store"});
  const data:any=await res.json().catch(()=>({}));
  return{ok:res.ok,status:res.status,data};
}

export async function POST(req:Request){
  const started=Date.now();
  try{
    const {workspace}=await workspaceForRequest(req,true);
    if(!workspace?.website)return NextResponse.json({ok:false,error:"Workspace website is missing",stage:"company_brain"},{status:400});
    const body:any=await req.json().catch(()=>({}));
    const runDecision=body?.runDecision!==false;
    const stages:any[]=[];

    const aiStatus=radarEngineAIStatus();
    if(!aiStatus.configured){
      stages.push({stage:"ai",ok:false,error:"No AI provider configured",status:aiStatus});
      return NextResponse.json({ok:false,workspace_id:workspace.id,stages,duration_ms:Date.now()-started},{status:503});
    }
    try{
      const ai=await radarEngineText("Return exactly RADAR_AI_OK",{feature:"health_check",maxTokens:24,temperature:0});
      stages.push({stage:"ai",ok:ai.text.includes("RADAR_AI_OK"),provider:ai.provider,model:ai.model,live_web:aiStatus.live_web});
    }catch(error){
      stages.push({stage:"ai",ok:false,error:error instanceof Error?error.message:"AI health failed",status:aiStatus});
      return NextResponse.json({ok:false,workspace_id:workspace.id,stages,duration_ms:Date.now()-started},{status:503});
    }

    const bootstrap=await internal(req,"/api/radar/bootstrap",{website:workspace.website});
    stages.push({stage:"company_brain",ok:bootstrap.ok,status:bootstrap.status,engine:bootstrap.data?.engine||null,error:bootstrap.ok?null:bootstrap.data?.error||null});
    if(!bootstrap.ok)return NextResponse.json({ok:false,workspace_id:workspace.id,stages,duration_ms:Date.now()-started},{status:500});

    const discovery=await internal(req,"/api/radar/discover",{force:true});
    stages.push({stage:"discovery",ok:discovery.ok||Boolean(discovery.data?.cooldown),status:discovery.status,inspected:Number(discovery.data?.inspected||0),entities:Number(discovery.data?.entities_extracted||0),promoted:Number(discovery.data?.promoted||0),search:discovery.data?.search||null,error:discovery.ok?null:discovery.data?.error||null});
    if(!discovery.ok&&!discovery.data?.cooldown)return NextResponse.json({ok:false,workspace_id:workspace.id,stages,duration_ms:Date.now()-started},{status:500});

    const refresh=await internal(req,"/api/radar/refresh",{e2e:true});
    stages.push({stage:"market_intelligence",ok:refresh.ok,status:refresh.status,deep_scans:Number(refresh.data?.deep_scans||0),market_events:Number(refresh.data?.market_events||0),signals_created:Number(refresh.data?.signals_created||0),moves_correlated:Number(refresh.data?.moves_correlated||0),error:refresh.ok?null:refresh.data?.error||null});
    if(!refresh.ok)return NextResponse.json({ok:false,workspace_id:workspace.id,stages,duration_ms:Date.now()-started},{status:500});

    let ensured:any={};
    let monitored:any={};
    try{
      ensured=await ensureWorkspaceSources(workspace.id);
      monitored=await runWorkspaceSourceMonitor(workspace.id,8);
      stages.push({stage:"sources",ok:true,sources_added:Number(ensured?.added||0),checked:Number(monitored?.checked||0),changed:Number(monitored?.changed||0),signals:Number(monitored?.signals||0),failed:Number(monitored?.failed||0)});
    }catch(error){
      stages.push({stage:"sources",ok:false,error:error instanceof Error?error.message:"Source monitoring failed"});
      return NextResponse.json({ok:false,workspace_id:workspace.id,stages,duration_ms:Date.now()-started},{status:500});
    }

    const moveResult=await detectMovesForWorkspace(workspace.id).catch((error:any)=>({moves:0,error:error instanceof Error?error.message:String(error)}));
    const moves:any[]=await sbSelect(`radar_moves?workspace_id=eq.${workspace.id}&select=*&order=impact_score.desc,updated_at.desc&limit=10`);
    stages.push({stage:"moves",ok:!moveResult?.error,correlated:Number(moveResult?.moves||0),available:moves.length,error:moveResult?.error||null});

    let decision:any=null;
    if(runDecision&&moves[0]?.id){
      const decisionCall=await internal(req,"/api/radar/decisions",{moveId:moves[0].id});
      decision=decisionCall.data||null;
      stages.push({stage:"decision",ok:decisionCall.ok,status:decisionCall.status,decision_id:decision?.id||null,error:decisionCall.ok?null:decisionCall.data?.error||null});
      if(!decisionCall.ok)return NextResponse.json({ok:false,workspace_id:workspace.id,stages,duration_ms:Date.now()-started},{status:500});
    }else{
      stages.push({stage:"decision",ok:true,skipped:true,reason:runDecision?"No correlated Move exists yet. Decision creation requires evidence-backed Moves.":"Disabled by test request."});
    }

    const [competitors,sources,snapshots,signals,finalMoves,decisions]=await Promise.all([
      sbSelect(`radar_competitors?workspace_id=eq.${workspace.id}&select=id&limit=1000`),
      sbSelect(`radar_sources?workspace_id=eq.${workspace.id}&select=id&limit=2000`),
      sbSelect(`radar_sources?workspace_id=eq.${workspace.id}&select=id&limit=2000`).then(async(rows:any[])=>{
        if(!rows.length)return[];
        const ids=rows.map((r:any)=>r.id).filter(Boolean).slice(0,500);
        if(!ids.length)return[];
        return sbSelect(`radar_snapshots?source_id=in.(${ids.map((id:string)=>encodeURIComponent(id)).join(",")})&select=id&limit=5000`);
      }),
      sbSelect(`radar_signals?workspace_id=eq.${workspace.id}&select=id&limit=3000`),
      sbSelect(`radar_moves?workspace_id=eq.${workspace.id}&select=id&limit=1000`),
      sbSelect(`radar_decisions?workspace_id=eq.${workspace.id}&select=id&limit=1000`),
    ]);

    const summary={competitors:competitors.length,sources:sources.length,snapshots:snapshots.length,signals:signals.length,moves:finalMoves.length,decisions:decisions.length};
    const coreOk=summary.competitors>0&&summary.sources>0&&summary.snapshots>0;
    const intelligenceOk=summary.signals>0||summary.moves>0||Number(refresh.data?.market_events||0)>0;
    return NextResponse.json({ok:coreOk&&intelligenceOk,workspace_id:workspace.id,workspace_name:workspace.name,stages,summary,duration_ms:Date.now()-started,notes:coreOk&&!intelligenceOk?["Core scanning path works, but no material new market change was verified during this run. Signals are intentionally not fabricated."]:[]});
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:"E2E intelligence test failed",duration_ms:Date.now()-started},{status:500});
  }
}
