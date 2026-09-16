import { NextResponse } from "next/server";
import { firecrawlConfigured } from "@/lib/firecrawl";
import { engineSearchConfigured } from "@/lib/radar-engine-search";
import { radarEngineAIStatus } from "@/lib/radar-engine-ai";
import { companyBrainReadiness } from "@/lib/radar-profile";
import { workspaceForRequest } from "@/lib/radar-workspace";
import { sbSelect } from "@/lib/radar-db";

export async function GET(req: Request) {
  try {
    const { workspace } = await workspaceForRequest(req, true);
    const [monitors, scans, competitors, signals, evidence, briefings, feedback, tasks, sources] = await Promise.all([
      sbSelect(`radar_monitors?workspace_id=eq.${workspace.id}&select=id,monitor_type,status,last_event_at,last_error,schedule_text,competitor_id&order=created_at.desc&limit=200`),
      sbSelect(`radar_scan_runs?workspace_id=eq.${workspace.id}&select=id,run_type,status,started_at,finished_at,pages_scanned,findings,error&order=started_at.desc&limit=30`),
      sbSelect(`radar_competitors?workspace_id=eq.${workspace.id}&select=id,monitoring_preference,last_scanned_at&limit=200`),
      sbSelect(`radar_signals?workspace_id=eq.${workspace.id}&select=id,impact_score,confidence,observed_at&order=observed_at.desc&limit=200`),
      sbSelect(`radar_evidence?workspace_id=eq.${workspace.id}&select=id,competitor_id,source_url,confidence,observed_at&order=observed_at.desc&limit=1000`),
      sbSelect(`radar_briefings?workspace_id=eq.${workspace.id}&select=id,period,created_at&limit=100`),
      sbSelect(`radar_feedback?workspace_id=eq.${workspace.id}&select=id&limit=100`),
      sbSelect(`radar_recurring_tasks?workspace_id=eq.${workspace.id}&select=task_key,next_run_at,last_completed_at&limit=50`).catch(()=>[]),
      sbSelect(`radar_sources?workspace_id=eq.${workspace.id}&select=id,status,health,last_checked_at,next_check_at,competitor_id&limit=1000`).catch(()=>[]),
    ]);

    const ai=radarEngineAIStatus();
    const brain=companyBrainReadiness(workspace);
    const activeMonitors=monitors.filter((m:any)=>m.status==="active");
    const discovery=activeMonitors.find((m:any)=>m.monitor_type==="web_discovery")||null;
    const entityMonitors=activeMonitors.filter((m:any)=>Boolean(m.competitor_id));
    const monitoredIds=new Set(entityMonitors.map((m:any)=>String(m.competitor_id)));
    const explicitlyMonitored=competitors.filter((c:any)=>c.monitoring_preference==="monitor"||monitoredIds.has(String(c.id))).length;
    const verified=competitors.filter((c:any)=>Boolean(c.last_scanned_at)).length;
    const coveredCompetitors=new Set(evidence.map((e:any)=>e.competitor_id).filter(Boolean).map(String)).size;
    const healthySources=sources.filter((s:any)=>s.status==="active"&&s.health!=="failed").length;
    const runningScans=scans.filter((s:any)=>s.status==="running");
    const failed=scans.find((s:any)=>s.status==="failed")||null;
    const latestCompleted=scans.find((s:any)=>s.status==="completed")||null;
    const lastMonitorEvent=activeMonitors.map((m:any)=>m.last_event_at).filter(Boolean).sort().reverse()[0]||null;
    const recurringActive=tasks.length>0;
    const schedulingActive=Boolean(discovery)||recurringActive||entityMonitors.length>0;

    const checks=[
      {key:"workspace",label:"Founder Company Brain complete",done:brain.ready},
      {key:"website",label:"Optional first-party website enrichment",done:Boolean(workspace.website),optional:true},
      {key:"competitors",label:"Relevant competitor universe",done:competitors.length>0},
      {key:"verified",label:"At least one first-party verified competitor",done:verified>0},
      {key:"source_coverage",label:"Evidence/source coverage",done:evidence.some((e:any)=>Boolean(e.source_url))},
      {key:"monitoring",label:"Continuous intelligence scheduling active",done:schedulingActive},
      {key:"signals",label:"Structured signals available",done:signals.length>0},
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
      search:{configured:firecrawlConfigured()||engineSearchConfigured(),firecrawl:firecrawlConfigured(),engine:engineSearchConfigured()},
      monitoring:{
        active:schedulingActive,
        provider_monitor:Boolean(discovery),
        recurring_tasks:tasks.length,
        active_monitors:activeMonitors.length,
        entity_monitors:entityMonitors.length,
        schedule:discovery?.schedule_text||null,
        last_event_at:lastMonitorEvent,
        monitored_competitors:explicitlyMonitored,
        monitor_errors:activeMonitors.filter((m:any)=>Boolean(m.last_error)).length,
      },
      intelligence:{
        competitors:competitors.length,
        verified_competitors:verified,
        covered_competitors:coveredCompetitors,
        evidence:evidence.length,
        signals:signals.length,
        sources:sources.length,
        healthy_sources:healthySources,
        briefings:briefings.length,
      },
      scans:{
        latest:scans[0]||null,
        latest_completed:latestCompleted,
        recent_failure:failed,
        running:runningScans.length,
        running_items:runningScans.slice(0,5),
      },
      beta:{checks,completed,total:requiredChecks.length,percent:Math.round((completed/Math.max(1,requiredChecks.length))*100)},
      launch_ready:Boolean(brain.ready&&ai.configured&&competitors.length>0&&schedulingActive),
    });
  } catch (error) {
    if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});
    return NextResponse.json({error:error instanceof Error?error.message:"Status failed"},{status:500});
  }
}
