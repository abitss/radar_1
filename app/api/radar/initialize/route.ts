import { NextResponse } from "next/server";
import { sbSelect, sbUpdate } from "@/lib/radar-db";
import { workspaceForRequest } from "@/lib/radar-workspace";

async function callInternal(req:Request,path:string,body?:any){
  const url=new URL(path,req.url);
  const headers:any={"Content-Type":"application/json"};
  const cookie=req.headers.get("cookie");
  if(cookie)headers.cookie=cookie;
  const res=await fetch(url,{method:"POST",headers,body:body===undefined?undefined:JSON.stringify(body),cache:"no-store"});
  const data=await res.json().catch(()=>({}));
  return {res,data};
}

export async function POST(req:Request){
  try{
    const {workspace}=await workspaceForRequest(req,true);
    if(!workspace.website)return NextResponse.json({error:"Startup website is required before RADAR can initialize."},{status:400});

    await sbUpdate("radar_workspaces",`id=eq.${workspace.id}`,{
      initial_scan_status:"running",
      initial_scan_started_at:new Date().toISOString(),
      initial_scan_completed_at:null,
      initial_scan_error:null,
      updated_at:new Date().toISOString(),
    });

    const steps:any[]=[];

    const boot=await callInternal(req,"/api/radar/bootstrap",{website:workspace.website});
    steps.push({step:"company_brain",ok:boot.res.ok,error:boot.data?.error||null});
    if(!boot.res.ok)throw new Error(boot.data?.error||"Company Brain build failed");

    const discover=await callInternal(req,"/api/radar/discover",{force:true});
    steps.push({step:"discovery",ok:discover.res.ok||Boolean(discover.data?.cooldown),error:discover.data?.error||null,inspected:discover.data?.inspected||0,promoted:discover.data?.promoted||0});
    if(!discover.res.ok&&!discover.data?.cooldown)throw new Error(discover.data?.error||"Competitor discovery failed");

    const competitors=await sbSelect(`radar_competitors?workspace_id=eq.${workspace.id}&select=*&order=product_overlap_score.desc,threat_score.desc,similarity_score.desc&limit=12`);
    const scanTargets=competitors.slice(0,8);
    const scanResults=await Promise.allSettled(scanTargets.map((c:any)=>callInternal(req,"/api/radar/scan",{competitorId:c.id,quick:true})));
    const scanned=scanResults.filter((r:any)=>r.status==="fulfilled"&&(r.value.res.ok||r.value.data?.cooldown)).length;
    steps.push({step:"deep_scan",ok:true,requested:scanTargets.length,completed:scanned});

    const monitorTargets=(await sbSelect(`radar_competitors?workspace_id=eq.${workspace.id}&select=*&order=threat_score.desc,product_overlap_score.desc&limit=5`)).filter((c:any)=>c.website);
    const monitorResults=await Promise.allSettled(monitorTargets.map((c:any)=>callInternal(req,`/api/radar/competitors/${c.id}/monitor`)));
    const monitors=monitorResults.filter((r:any)=>r.status==="fulfilled"&&r.value.res.ok).length;
    steps.push({step:"competitor_monitoring",ok:true,requested:monitorTargets.length,activated:monitors});

    const continuous=await callInternal(req,"/api/radar/continuous");
    steps.push({step:"continuous_discovery",ok:continuous.res.ok,error:continuous.data?.error||null});

    const briefing=await callInternal(req,"/api/radar/briefings",{period:"weekly"});
    steps.push({step:"founder_briefing",ok:briefing.res.ok,error:briefing.data?.error||null});

    const finalCompetitors=await sbSelect(`radar_competitors?workspace_id=eq.${workspace.id}&select=id&limit=500`);
    const evidence=await sbSelect(`radar_evidence?workspace_id=eq.${workspace.id}&select=id&limit=2000`);
    const signals=await sbSelect(`radar_signals?workspace_id=eq.${workspace.id}&select=id&limit=1000`);
    const recommendations=await sbSelect(`radar_recommendations?workspace_id=eq.${workspace.id}&select=id&limit=1000`);

    await sbUpdate("radar_workspaces",`id=eq.${workspace.id}`,{
      initial_scan_status:"completed",
      initial_scan_completed_at:new Date().toISOString(),
      initial_scan_error:null,
      updated_at:new Date().toISOString(),
    });

    return NextResponse.json({
      ok:true,
      steps,
      output:{competitors:finalCompetitors.length,evidence:evidence.length,signals:signals.length,recommendations:recommendations.length},
    });
  }catch(error){
    try{
      const {workspace}=await workspaceForRequest(req,true);
      await sbUpdate("radar_workspaces",`id=eq.${workspace.id}`,{
        initial_scan_status:"failed",
        initial_scan_error:error instanceof Error?error.message:"Initialization failed",
        updated_at:new Date().toISOString(),
      });
    }catch{}
    return NextResponse.json({error:error instanceof Error?error.message:"Initialization failed"},{status:500});
  }
}
