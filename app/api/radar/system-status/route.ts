import { NextResponse } from "next/server";
import { firecrawlConfigured } from "@/lib/firecrawl";
import { radarAIProvider } from "@/lib/radar-ai";
import { workspaceForRequest } from "@/lib/radar-workspace";
import { sbSelect } from "@/lib/radar-db";

export async function GET(req: Request) {
  try {
    const { workspace } = await workspaceForRequest(req, true);
    const [monitors, scans, competitors, signals, evidence, briefings, feedback] = await Promise.all([
      sbSelect(`radar_monitors?workspace_id=eq.${workspace.id}&select=monitor_type,status,last_event_at,schedule_text,competitor_id&order=created_at.desc&limit=100`),
      sbSelect(`radar_scan_runs?workspace_id=eq.${workspace.id}&select=run_type,status,finished_at,error&order=created_at.desc&limit=10`),
      sbSelect(`radar_competitors?workspace_id=eq.${workspace.id}&select=id,monitoring_preference,last_scanned_at&limit=100`),
      sbSelect(`radar_signals?workspace_id=eq.${workspace.id}&select=id,impact_score,confidence&limit=100`),
      sbSelect(`radar_evidence?workspace_id=eq.${workspace.id}&select=id,competitor_id,source_url&limit=500`),
      sbSelect(`radar_briefings?workspace_id=eq.${workspace.id}&select=id,period&limit=100`),
      sbSelect(`radar_feedback?workspace_id=eq.${workspace.id}&select=id&limit=100`),
    ]);
    const ai = radarAIProvider();
    const discovery = monitors.find((m:any)=>m.monitor_type==="web_discovery"&&m.status==="active") || null;
    const failed = scans.find((s:any)=>s.status==="failed") || null;
    const monitoredIds=new Set(monitors.filter((m:any)=>m.competitor_id&&m.status==="active").map((m:any)=>m.competitor_id));
    const monitored=competitors.filter((c:any)=>c.monitoring_preference==="monitor"||monitoredIds.has(c.id)).length;
    const profileFields=[workspace.description,workspace.problem_statement,workspace.target_customers,workspace.product_keywords?.length,workspace.capability_keywords?.length,workspace.industry,workspace.positioning];
    const profileReady=profileFields.filter(Boolean).length>=4;
    const checks=[
      {key:"workspace",label:"Workspace + company website",done:Boolean(workspace.website)},
      {key:"profile",label:"Structured Company Brain",done:profileReady},
      {key:"competitors",label:"Relevant competitor universe",done:competitors.length>0},
      {key:"five_monitored",label:"At least five approved/monitored competitors",done:monitored>=5},
      {key:"source_coverage",label:"Evidence/source coverage",done:evidence.some((e:any)=>Boolean(e.source_url))},
      {key:"signals",label:"Structured signals with importance/confidence",done:signals.length>0},
      {key:"monitoring",label:"Continuous discovery active",done:Boolean(discovery)},
      {key:"weekly_brief",label:"Weekly briefing generated",done:briefings.some((b:any)=>b.period==="weekly")},
      {key:"ask",label:"Ask RADAR intelligence layer",done:Boolean(ai.configured)},
      {key:"feedback",label:"Founder usefulness feedback loop",done:feedback.length>0},
    ];
    const completed=checks.filter(c=>c.done).length;
    return NextResponse.json({
      ai,
      firecrawl: { configured: firecrawlConfigured() },
      monitoring: { active: Boolean(discovery), schedule: discovery?.schedule_text || null, last_event_at: discovery?.last_event_at || null, monitored_competitors:monitored },
      scans: { latest: scans[0] || null, recent_failure: failed },
      beta:{checks,completed,total:checks.length,percent:Math.round((completed/checks.length)*100)},
      launch_ready: Boolean(firecrawlConfigured() && workspace.website && profileReady && competitors.length>0 && discovery),
    });
  } catch (error) {
    if(error instanceof Error && error.message==="UNAUTHORIZED") return NextResponse.json({error:"Unauthorized"},{status:401});
    return NextResponse.json({error:error instanceof Error?error.message:"Status failed"},{status:500});
  }
}
