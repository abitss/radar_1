import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sbInsert, sbSelect, sbUpdate } from "@/lib/radar-db";
import { scheduleWorkspaceRecurringTasks } from "@/lib/radar-source-monitor";
import { companyBrainReadiness } from "@/lib/radar-profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const E2E_PROBE_KEY="prod-e2e-openrouter-2026-09-16-v2";

function safeEqual(a:string,b:string){if(!a||!b)return false;const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&timingSafeEqual(aa,bb)}

async function systemCall(req:Request,workspaceId:string,path:string,body?:unknown){
  const secret=process.env.RADAR_API_SECRET||"";const url=new URL(path,req.url);const res=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json","x-radar-api-key":secret,"x-radar-system-workspace":workspaceId},body:body===undefined?undefined:JSON.stringify(body),cache:"no-store"});const data:any=await res.json().catch(()=>({}));return{ok:res.ok,status:res.status,data};
}
async function systemCallOrigin(origin:string,workspaceId:string,path:string,body?:unknown){
  const secret=process.env.RADAR_API_SECRET||"";const res=await fetch(new URL(path,origin),{method:"POST",headers:{"Content-Type":"application/json","x-radar-api-key":secret,"x-radar-system-workspace":workspaceId},body:body===undefined?undefined:JSON.stringify(body),cache:"no-store"});const data:any=await res.json().catch(()=>({}));return{ok:res.ok,status:res.status,data};
}
async function launchOneShotProductionE2E(origin:string,workspaceId:string){
  try{const existing:any[]=await sbSelect(`radar_intelligence_events?workspace_id=eq.${encodeURIComponent(workspaceId)}&dedupe_key=eq.${encodeURIComponent(E2E_PROBE_KEY)}&select=id,title,summary,created_at&limit=1`);if(existing[0])return;const result=await systemCallOrigin(origin,workspaceId,"/api/radar/e2e-test",{runDecision:true});const passed=Boolean(result.ok&&result.data?.ok);const stages=Array.isArray(result.data?.stages)?result.data.stages:[];const failedStage=stages.find((stage:any)=>stage?.ok===false);const summary=result.data?.summary||{};const detail={passed,http_status:result.status,failed_stage:failedStage?.stage||null,error:failedStage?.error||result.data?.error||null,summary,duration_ms:result.data?.duration_ms||null,stages:stages.map((stage:any)=>({stage:stage?.stage,ok:stage?.ok,skipped:stage?.skipped||false,error:stage?.error||null}))};await sbInsert("radar_intelligence_events",{workspace_id:workspaceId,competitor_id:null,event_type:passed?"system_e2e_pass":"system_e2e_fail",severity:passed?"info":"high",title:passed?"RADAR production intelligence E2E passed":"RADAR production intelligence E2E failed",summary:JSON.stringify(detail).slice(0,7000),source_url:origin,confidence:100,impact_score:passed?0:85,dedupe_key:E2E_PROBE_KEY,status:"new",occurred_at:new Date().toISOString()})}catch(error){console.error("RADAR one-shot E2E probe failed to record",error instanceof Error?error.message:error)}
}

export async function POST(req:Request){
  try{
    const supplied=req.headers.get("x-radar-cron-secret")||"";const expected=process.env.RADAR_CRON_SECRET||process.env.RADAR_API_SECRET||"";if(!expected||!safeEqual(supplied,expected))return NextResponse.json({error:"Unauthorized"},{status:401});if(!process.env.RADAR_API_SECRET)return NextResponse.json({error:"RADAR_API_SECRET is not configured"},{status:503});
    const now=new Date(),nowIso=now.toISOString(),staleIso=new Date(now.getTime()-30*60*1000).toISOString();
    const stale:any[]=await sbSelect(`radar_jobs?job_type=eq.initial_intelligence&status=eq.running&started_at=lt.${encodeURIComponent(staleIso)}&select=id,workspace_id,attempts,max_attempts&limit=20`);for(const job of stale){const terminal=Number(job.attempts||0)>=Number(job.max_attempts||3);await sbUpdate("radar_jobs",`id=eq.${job.id}`,{status:terminal?"failed":"queued",current_step:terminal?"failed":"recovered_after_timeout",error:"Recovered after a stale worker timeout.",available_at:terminal?nowIso:new Date(Date.now()+60000).toISOString(),updated_at:nowIso}).catch(()=>{})}

    const candidates:any[]=await sbSelect(`radar_workspaces?onboarding_completed=eq.true&select=*&order=updated_at.asc&limit=250`);
    const workspaces=candidates.filter((workspace:any)=>companyBrainReadiness(workspace).ready);
    await Promise.allSettled(workspaces.map((workspace:any)=>scheduleWorkspaceRecurringTasks(String(workspace.id))));

    const queued:any[]=await sbSelect(`radar_jobs?job_type=eq.initial_intelligence&status=eq.queued&available_at=lte.${encodeURIComponent(nowIso)}&select=*&order=priority.desc,created_at.asc&limit=3`);const initialResults:any[]=[];for(const job of queued){const r=await systemCall(req,String(job.workspace_id),"/api/radar/initialize",{resume:true});initialResults.push({workspace_id:job.workspace_id,ok:r.ok,status:r.status,error:r.ok?null:r.data?.error||"Initialization failed"})}

    const dueTasks:any[]=await sbSelect(`radar_recurring_tasks?next_run_at=lte.${encodeURIComponent(nowIso)}&select=workspace_id,task_key,next_run_at&order=next_run_at.asc&limit=30`);const allDueWorkspaceIds=Array.from(new Set<string>(dueTasks.map((task:any)=>String(task.workspace_id))));const dueWorkspaceIds=allDueWorkspaceIds.slice(0,4);const maintenanceResults:any[]=[];for(const workspaceId of dueWorkspaceIds){const r=await systemCall(req,workspaceId,"/api/radar/maintenance",{system:true});maintenanceResults.push({workspace_id:workspaceId,ok:r.ok,status:r.status,tasks_processed:Number(r.data?.tasks_processed||0),tasks_failed:Number(r.data?.tasks_failed||0),error:r.ok?null:r.data?.error||"Maintenance failed"})}

    let e2eWorkspace:any=workspaces[0]||null;if(!e2eWorkspace){const fallback:any[]=await sbSelect(`radar_workspaces?onboarding_completed=eq.true&select=*&order=updated_at.desc&limit=20`);e2eWorkspace=fallback.find((w:any)=>companyBrainReadiness(w).ready)||null}if(e2eWorkspace?.id){const origin=new URL(req.url).origin;void launchOneShotProductionE2E(origin,String(e2eWorkspace.id))}

    return NextResponse.json({ok:true,at:nowIso,stale_jobs_recovered:stale.length,workspaces_registered:workspaces.length,initial_jobs:initialResults,maintenance:maintenanceResults,due_workspaces_remaining:Math.max(0,allDueWorkspaceIds.length-dueWorkspaceIds.length),production_e2e:{scheduled:Boolean(e2eWorkspace?.id),workspace_id:e2eWorkspace?.id||null,probe:E2E_PROBE_KEY}});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"System maintenance failed"},{status:500})}
}
