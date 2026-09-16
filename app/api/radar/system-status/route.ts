import { NextResponse } from "next/server";
import { firecrawlConfigured } from "@/lib/firecrawl";
import { radarEngineAIStatus } from "@/lib/radar-engine-ai";
import { companyBrainReadiness } from "@/lib/radar-profile";
import { workspaceForRequest } from "@/lib/radar-workspace";
import { sbSelect } from "@/lib/radar-db";

export async function GET(req: Request) {
  try {
    const { workspace } = await workspaceForRequest(req, true);
    const [monitors, scans, competitors, signals, evidence, briefings, feedback, tasks] = await Promise.all([
      sbSelect(`radar_monitors?workspace_id=eq.${workspace.id}&select=monitor_type,status,last_event_at,schedule_text,competitor_id&order=created_at.desc&limit=100`),
      sbSelect(`radar_scan_runs?workspace_id=eq.${workspace.id}&select=run_type,status,finished_at,error&order=created_at.desc&limit=10`),
      sbSelect(`radar_competitors?workspace_id=eq.${workspace.id}&select=id,monitoring_preference,last_scanned_at&limit=100`),
      sbSelect(`radar_signals?workspace_id=eq.${workspace.id}&select=id,impact_score,confidence&limit=100`),
      sbSelect(`radar_evidence?workspace_id=eq.${workspace.id}&select=id,competitor_id,source_url&limit=500`),
      sbSelect(`radar_briefings?workspace_id=eq.${workspace.id}&select=id,period&limit=100`),
      sbSelect(`radar_feedback?workspace_id=eq.${workspace.id}&select=id&limit=100`),
      sbSelect(`radar_recurring_tasks?workspace_id=eq.${workspace.id}&select=task_key,next_run_at,last_completed_at&limit=50`),
    ]);
    const ai=radarEngineAIStatus();
    const brain=companyBrainReadiness(workspace);
    const discovery=monitors.find((m:any)=>m.monitor_type==="web_discovery"&&m.status==="active")||null;
    const failed=scans.find((s:any)=>s.status==="failed")||null;
    const monitoredIds=new Set(monitors.filter((m:any)=>m.competitor_id&&m.status==="active").map((m:any)=>m.competitor_id));
    const monitored=competitors.filter((c:any)=>c.monitoring_preference==="monitor"||c.monitoring_preference==="auto"||monitoredIds.has(c.id)).length;
    const recurringActive=tasks.length>0;
    const checks=[
      {key:"workspace",label:"Founder Company Brain complete",done:brain.ready},
      {key:"website",label:"Optional first-party website enrichment",done:Boolean(workspace.website),optional:true},
      {key:"competitors",label:"Relevant competitor universe",done:competitors.length>0},
      {key:"five_monitored",label:"At least five approved/monitored competitors",done:monitored>=5},
      {key:"source_coverage",label:"Evidence/source coverage",done:evidence.some((e:any)=>Boolean(e.source_url))},
      {key:"signals",label:"Structured signals with importance/confidence",done:signals.length>0},
      {key:"monitoring",label:"Continuous intelligence scheduling active",done:Boolean(discovery)||recurringActive},
      {key:"weekly_brief",label:"Weekly briefing generated",done:briefings.some((b:any)=>b.period==="weekly")},
      {key:"ask",label:"Ask RADAR intelligence layer",done:Boolean(ai.configured)},
      {key:"feedback",label:"Founder usefulness feedback loop",done:feedback.length>0},
    ];
    const requiredChecks=checks.filter((c:any)=>!c.optional);
    const completed=requiredChecks.filter((c:any)=>c.done).length;
    return NextResponse.json({
      company_brain:brain,
      website:{configured:Boolean(workspace.website),role:"optional_enrichment"},
      ai,
      firecrawl:{configured:firecrawlConfigured()},
      monitoring:{active:Boolean(discovery)||recurringActive,provider_monitor:Boolean(discovery),recurring_tasks:tasks.length,schedule:discovery?.schedule_text||null,last_event_at:discovery?.last_event_at||null,monitored_competitors:monitored},
      scans:{latest:scans[0]||null,recent_failure:failed},
      beta:{checks,completed,total:requiredChecks.length,percent:Math.round((completed/Math.max(1,requiredChecks.length))*100)},
      launch_ready:Boolean(brain.ready&&ai.configured&&competitors.length>0&&(discovery||recurringActive)),
    });
  } catch (error) {
    if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});
    return NextResponse.json({error:error instanceof Error?error.message:"Status failed"},{status:500});
  }
}
