import { NextResponse } from "next/server";
import { sbSelect, sbUpdate } from "@/lib/radar-db";
import { runWorkspaceSourceMonitor, scheduleWorkspaceRecurringTasks } from "@/lib/radar-source-monitor";
import { workspaceForRequest } from "@/lib/radar-workspace";

async function internal(req:Request,path:string,body?:any){
  const url=new URL(path,req.url);const headers:any={"Content-Type":"application/json"};const cookie=req.headers.get("cookie");if(cookie)headers.cookie=cookie;
  const res=await fetch(url,{method:"POST",headers,body:body===undefined?undefined:JSON.stringify(body),cache:"no-store"});
  const data=await res.json().catch(()=>({}));return{ok:res.ok,data};
}

export async function POST(req:Request){
  try{
    const {workspace}=await workspaceForRequest(req,true);
    await scheduleWorkspaceRecurringTasks(workspace.id);
    const now=new Date().toISOString();
    const tasks=await sbSelect(`radar_recurring_tasks?workspace_id=eq.${workspace.id}&next_run_at=lte.${encodeURIComponent(now)}&select=*&order=next_run_at.asc&limit=20`);
    const result:any={source_monitor:null,discovery:null,market_refresh:null,daily_briefing:null,weekly_briefing:null,tasks_processed:0};

    for(const task of tasks){
      try{
        let output:any=null;
        if(task.task_key==="source.monitor"){output=await runWorkspaceSourceMonitor(workspace.id,16);result.source_monitor=output;}
        else if(task.task_key==="discovery.refresh"){output=await internal(req,"/api/radar/discover",{force:true});result.discovery=output.data;}
        else if(task.task_key==="market.refresh"){output=await internal(req,"/api/radar/refresh",{maintenance:true});result.market_refresh=output.data;}
        else if(task.task_key==="briefing.daily"){output=await internal(req,"/api/radar/briefings",{period:"daily"});result.daily_briefing=output.data;}
        else if(task.task_key==="briefing.weekly"){output=await internal(req,"/api/radar/briefings",{period:"weekly"});result.weekly_briefing=output.data;}
        else continue;
        const minutes=Math.max(30,Number(task.interval_minutes||60));
        await sbUpdate("radar_recurring_tasks",`workspace_id=eq.${workspace.id}&task_key=eq.${encodeURIComponent(task.task_key)}`,{last_completed_at:new Date().toISOString(),last_error:null,next_run_at:new Date(Date.now()+minutes*60000).toISOString(),updated_at:new Date().toISOString()});
        result.tasks_processed++;
      }catch(error){
        const minutes=Math.max(30,Math.min(120,Number(task.interval_minutes||60)));
        await sbUpdate("radar_recurring_tasks",`workspace_id=eq.${workspace.id}&task_key=eq.${encodeURIComponent(task.task_key)}`,{last_error:error instanceof Error?error.message.slice(0,500):"Task failed",next_run_at:new Date(Date.now()+minutes*60000).toISOString(),updated_at:new Date().toISOString()}).catch(()=>{});
      }
    }

    if(!tasks.some((x:any)=>x.task_key==="source.monitor")) result.source_monitor=await runWorkspaceSourceMonitor(workspace.id,6);
    return NextResponse.json({ok:true,...result});
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});
    return NextResponse.json({error:error instanceof Error?error.message:"Maintenance failed"},{status:500});
  }
}
