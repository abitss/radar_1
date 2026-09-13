import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { sbSelect, sbUpdate } from "@/lib/radar-db";
import { scheduleWorkspaceRecurringTasks } from "@/lib/radar-source-monitor";

function safeEqual(a:string,b:string){if(!a||!b)return false;const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&timingSafeEqual(aa,bb)}
async function systemCall(req:Request,workspaceId:string,path:string,body?:any){
  const secret=process.env.RADAR_API_SECRET||"";
  const url=new URL(path,req.url);
  const res=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json","x-radar-api-key":secret,"x-radar-system-workspace":workspaceId},body:body===undefined?undefined:JSON.stringify(body),cache:"no-store",signal:AbortSignal.timeout(240000)});
  const data=await res.json().catch(()=>({}));
  return{ok:res.ok,status:res.status,data};
}

export async function POST(req:Request){
  try{
    const supplied=req.headers.get("x-radar-cron-secret")||"";
    const expected=process.env.RADAR_CRON_SECRET||"";
    if(!expected||!safeEqual(supplied,expected))return NextResponse.json({error:"Unauthorized"},{status:401});
    if(!process.env.RADAR_API_SECRET)return NextResponse.json({error:"RADAR_API_SECRET is not configured"},{status:503});

    const now=new Date();const nowIso=now.toISOString();
    const staleIso=new Date(now.getTime()-30*60*1000).toISOString();
    const stale=await sbSelect(`radar_jobs?job_type=eq.initial_intelligence&status=eq.running&started_at=lt.${encodeURIComponent(staleIso)}&select=id,workspace_id,attempts,max_attempts&limit=20`);
    for(const job of stale){
      const terminal=Number(job.attempts||0)>=Number(job.max_attempts||3);
      await sbUpdate("radar_jobs",`id=eq.${job.id}`,{status:terminal?"failed":"queued",current_step:terminal?"failed":"recovered_after_timeout",error:"Recovered after a stale worker timeout.",available_at:terminal?nowIso:new Date(Date.now()+60000).toISOString(),updated_at:nowIso}).catch(()=>{});
    }

    const workspaces=await sbSelect(`radar_workspaces?onboarding_completed=eq.true&website=not.is.null&select=id,initial_scan_status&order=updated_at.asc&limit=250`);
    await Promise.allSettled(workspaces.map((w:any)=>scheduleWorkspaceRecurringTasks(w.id)));

    const queued=await sbSelect(`radar_jobs?job_type=eq.initial_intelligence&status=eq.queued&available_at=lte.${encodeURIComponent(nowIso)}&select=*&order=priority.desc,created_at.asc&limit=3`);
    const initialResults:any[]=[];
    for(const job of queued){
      const r=await systemCall(req,job.workspace_id,"/api/radar/initialize",{resume:true});
      initialResults.push({workspace_id:job.workspace_id,ok:r.ok,status:r.status,error:r.ok?null:r.data?.error||"Initialization failed"});
    }

    const dueTasks=await sbSelect(`radar_recurring_tasks?next_run_at=lte.${encodeURIComponent(nowIso)}&select=workspace_id,task_key,next_run_at&order=next_run_at.asc&limit=30`);
    const dueWorkspaceIds=[...new Set(dueTasks.map((x:any)=>String(x.workspace_id)))].slice(0,4);
    const maintenanceResults:any[]=[];
    for(const workspaceId of dueWorkspaceIds){
      const r=await systemCall(req,workspaceId,"/api/radar/maintenance",{system:true});
      maintenanceResults.push({workspace_id:workspaceId,ok:r.ok,status:r.status,tasks_processed:r.data?.tasks_processed||0,tasks_failed:r.data?.tasks_failed||0,error:r.ok?null:r.data?.error||"Maintenance failed"});
    }

    return NextResponse.json({ok:true,at:nowIso,stale_jobs_recovered:stale.length,workspaces_registered:workspaces.length,initial_jobs:initialResults,maintenance:maintenanceResults,due_workspaces_remaining:Math.max(0,[...new Set(dueTasks.map((x:any)=>String(x.workspace_id)))].length-dueWorkspaceIds.length)});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"System maintenance failed"},{status:500});
  }
}
