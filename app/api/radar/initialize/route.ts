import { NextResponse } from "next/server";
import { sbSelect, sbUpdate } from "@/lib/radar-db";
import { runCompetitiveLandscape } from "@/lib/radar-engine-landscape";
import { ensureCompanyBrainExpansion } from "@/lib/radar-brain-expansion";
import { companyBrainReadiness } from "@/lib/radar-profile";
import { workspaceForRequest } from "@/lib/radar-workspace";

async function callInternal(req:Request,path:string,body?:any){
  const base=process.env.PORT?`http://127.0.0.1:${process.env.PORT}`:req.url;
  const url=new URL(path,base);
  const headers:any={"Content-Type":"application/json"};
  const cookie=req.headers.get("cookie"); if(cookie)headers.cookie=cookie;
  const systemWorkspace=req.headers.get("x-radar-system-workspace"); if(systemWorkspace)headers["x-radar-system-workspace"]=systemWorkspace;
  const apiKey=req.headers.get("x-radar-api-key"); if(apiKey)headers["x-radar-api-key"]=apiKey;
  const res=await fetch(url,{method:"POST",headers,body:body===undefined?undefined:JSON.stringify(body),cache:"no-store"});
  const data=await res.json().catch(()=>({}));
  return {res,data};
}

export async function POST(req:Request){
  let job:any=null;
  try{
    const {workspace}=await workspaceForRequest(req,true);
    const readiness=companyBrainReadiness(workspace);
    if(!readiness.ready)return NextResponse.json({error:`Company Brain is incomplete. Missing: ${readiness.missing.join(", ")}.`,company_brain:readiness},{status:400});

    const activeJobs=await sbSelect(`radar_jobs?workspace_id=eq.${workspace.id}&job_type=eq.initial_intelligence&status=in.(queued,running)&select=*&order=created_at.asc&limit=1`);
    job=activeJobs[0]||null;
    if(job){const updates:any={status:"running",attempts:Number(job.attempts||0)+1,started_at:job.started_at||new Date().toISOString(),current_step:"company_brain",progress:5,updated_at:new Date().toISOString(),error:null};const updated=await sbUpdate("radar_jobs",`id=eq.${job.id}`,updates);job=updated[0]||{...job,...updates};}
    await sbUpdate("radar_workspaces",`id=eq.${workspace.id}`,{initial_scan_status:"running",initial_scan_started_at:workspace.initial_scan_started_at||new Date().toISOString(),initial_scan_completed_at:null,initial_scan_error:null,updated_at:new Date().toISOString()});
    const steps:any[]=[];
    const progress=async(step:string,value:number)=>{if(job?.id){const rows=await sbUpdate("radar_jobs",`id=eq.${job.id}`,{current_step:step,progress:value,updated_at:new Date().toISOString()});job=rows[0]||job}};

    await progress("company_brain",8);
    if(workspace.website){
      const boot=await callInternal(req,"/api/radar/bootstrap",{website:workspace.website});
      steps.push({step:"company_brain",ok:true,input:"founder_form",website_enrichment:boot.res.ok,error:boot.res.ok?null:boot.data?.error||null});
    }else steps.push({step:"company_brain",ok:true,input:"founder_form",website_optional:true});

    await progress("brain_expansion",18);
    let expansion:any=null;
    try{
      expansion=await ensureCompanyBrainExpansion(workspace);
      steps.push({step:"brain_expansion",ok:true,cached:Boolean(expansion.cached),queries:expansion.search_queries.length,adjacent_categories:expansion.adjacent_categories.length,substitute_workflows:expansion.substitute_workflows.length,hidden_angles:expansion.hidden_competitor_angles.length,provider:expansion.provider||null,model:expansion.model||null});
    }catch(error){
      steps.push({step:"brain_expansion",ok:false,error:error instanceof Error?error.message:"AI Company Brain expansion failed",continued:true});
    }

    await progress("market_discovery",30);
    const discover=await callInternal(req,"/api/radar/discover",{force:true});
    steps.push({step:"discovery",ok:discover.res.ok||Boolean(discover.data?.cooldown),error:discover.data?.error||null,inspected:discover.data?.inspected||0,promoted:discover.data?.promoted||0,ai_expansion:discover.data?.company_brain_expansion||null});
    if(!discover.res.ok&&!discover.data?.cooldown)throw new Error(discover.data?.error||"Competitor discovery failed");

    await progress("landscape_reasoning",42);
    let landscape:any=null;
    try{landscape=await runCompetitiveLandscape(workspace.id);steps.push({step:"landscape_reasoning",ok:true,...landscape})}
    catch(error){steps.push({step:"landscape_reasoning",ok:false,error:error instanceof Error?error.message:"Landscape analysis failed"})}

    await progress("competitor_verification",54);
    const competitors=await sbSelect(`radar_competitors?workspace_id=eq.${workspace.id}&select=*&order=product_overlap_score.desc,threat_score.desc,similarity_score.desc&limit=12`);
    const scanTargets=competitors.filter((c:any)=>c.website).slice(0,8);
    const scanResults=await Promise.allSettled(scanTargets.map((c:any)=>callInternal(req,"/api/radar/scan",{competitorId:c.id,quick:true})));
    const scanned=scanResults.filter((r:any)=>r.status==="fulfilled"&&(r.value.res.ok||r.value.data?.cooldown)).length;
    steps.push({step:"deep_scan",ok:true,requested:scanTargets.length,completed:scanned});

    await progress("competitor_monitoring",70);
    const monitorTargets=(await sbSelect(`radar_competitors?workspace_id=eq.${workspace.id}&select=id,website&order=threat_score.desc,product_overlap_score.desc&limit=5`)).filter((c:any)=>c.website);
    steps.push({step:"competitor_monitoring",ok:true,requested:monitorTargets.length,activated:0,mode:"local_recurring",provider_monitoring_skipped:true,reason:"Provider monitors are opt-in; RADAR recurring source checks remain active without consuming Firecrawl monitor quota."});

    await progress("continuous_discovery",84);
    const continuous=await callInternal(req,"/api/radar/continuous");
    steps.push({step:"continuous_discovery",ok:continuous.res.ok,error:continuous.data?.error||null});

    await progress("founder_briefing",94);
    const briefing=await callInternal(req,"/api/radar/briefings",{period:"weekly"});
    steps.push({step:"founder_briefing",ok:briefing.res.ok,error:briefing.data?.error||null});

    const [finalCompetitors,evidence,signals,recommendations]=await Promise.all([
      sbSelect(`radar_competitors?workspace_id=eq.${workspace.id}&select=id&limit=500`),
      sbSelect(`radar_evidence?workspace_id=eq.${workspace.id}&select=id&limit=2000`),
      sbSelect(`radar_signals?workspace_id=eq.${workspace.id}&select=id&limit=1000`),
      sbSelect(`radar_recommendations?workspace_id=eq.${workspace.id}&select=id&limit=1000`)
    ]);
    const result={input:"company_brain",ai_expansion_queries:Number(expansion?.search_queries?.length||0),website_enrichment:Boolean(workspace.website),competitors:finalCompetitors.length,evidence:evidence.length,signals:signals.length,recommendations:recommendations.length,landscape};
    await sbUpdate("radar_workspaces",`id=eq.${workspace.id}`,{initial_scan_status:"completed",initial_scan_completed_at:new Date().toISOString(),initial_scan_error:null,updated_at:new Date().toISOString()});
    if(job?.id)await sbUpdate("radar_jobs",`id=eq.${job.id}`,{status:"completed",current_step:"completed",progress:100,result,completed_at:new Date().toISOString(),updated_at:new Date().toISOString(),error:null});
    return NextResponse.json({ok:true,steps,output:result});
  }catch(error){
    try{const {workspace}=await workspaceForRequest(req,true);const message=error instanceof Error?error.message:"Initialization failed";await sbUpdate("radar_workspaces",`id=eq.${workspace.id}`,{initial_scan_status:"failed",initial_scan_error:message,updated_at:new Date().toISOString()});if(job?.id){const attempts=Number(job.attempts||1);const terminal=attempts>=Number(job.max_attempts||3);await sbUpdate("radar_jobs",`id=eq.${job.id}`,{status:terminal?"failed":"queued",current_step:"retry_wait",progress:Math.min(Number(job.progress||0),95),error:message,available_at:new Date(Date.now()+Math.min(15,attempts*3)*60*1000).toISOString(),updated_at:new Date().toISOString()});}}catch{}
    return NextResponse.json({error:error instanceof Error?error.message:"Initialization failed"},{status:500});
  }
}
