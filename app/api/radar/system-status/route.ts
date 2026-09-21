import { publicRadarError } from "@/lib/radar-errors";
import { NextResponse } from "next/server";
import { engineSearchConfigured, probeSearchProviders } from "@/lib/radar-engine-search";
import { radarEngineAIStatus } from "@/lib/radar-engine-ai";
import { companyBrainReadiness } from "@/lib/radar-profile";
import { workspaceForRequest } from "@/lib/radar-workspace";
import { sbSelect } from "@/lib/radar-db";

function timeOf(raw:any){const t=raw?new Date(raw).getTime():0;return Number.isFinite(t)?t:0}

export async function GET(req: Request) {
  try {
    const { workspace } = await workspaceForRequest(req, true);
    const [monitors, scans, competitors, signals, evidence, briefings, feedback, tasks, sources] = await Promise.all([
      sbSelect(`radar_monitors?workspace_id=eq.${workspace.id}&select=id,monitor_type,status,last_event_at,last_error,schedule_text,competitor_id&order=created_at.desc&limit=200`),
      sbSelect(`radar_scan_runs?workspace_id=eq.${workspace.id}&select=id,run_type,status,started_at,finished_at,pages_scanned,findings,error&order=started_at.desc&limit=50`),
      sbSelect(`radar_competitors?workspace_id=eq.${workspace.id}&select=id,monitoring_preference,last_scanned_at&limit=200`),
      sbSelect(`radar_signals?workspace_id=eq.${workspace.id}&select=id,impact_score,confidence,observed_at&order=observed_at.desc&limit=200`),
      sbSelect(`radar_evidence?workspace_id=eq.${workspace.id}&select=id,competitor_id,source_url,confidence,observed_at&order=observed_at.desc&limit=1000`),
      sbSelect(`radar_briefings?workspace_id=eq.${workspace.id}&select=id,period,created_at&limit=100`),
      sbSelect(`radar_feedback?workspace_id=eq.${workspace.id}&select=id&limit=100`),
      sbSelect(`radar_recurring_tasks?workspace_id=eq.${workspace.id}&select=task_key,next_run_at,last_completed_at,interval_minutes,last_error&limit=50`).catch(()=>[]),
      sbSelect(`radar_sources?workspace_id=eq.${workspace.id}&select=id,status,source_type,health,last_checked_at,next_check_at,competitor_id&limit=1000`).catch(()=>[]),
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
    const healthySources=sources.filter((s:any)=>s.status==="active"&&s.health==="healthy").length;
    const sourceErrors=sources.filter((s:any)=>s.status==="active"&&["error","failed"].includes(String(s.health||""))).length;
    const runningScans=scans.filter((s:any)=>s.status==="running");
    const completedScans=scans.filter((s:any)=>s.status==="completed");
    const latestCompleted=completedScans[0]||null;

    // A failed run is actionable only until the same pipeline succeeds again. Keeping recovered
    // failures in the dashboard made fixed schema/provider incidents look permanently broken.
    const unresolvedFailures=scans.filter((failed:any)=>{
      if(failed.status!=="failed")return false;
      const failedAt=Math.max(timeOf(failed.finished_at),timeOf(failed.started_at));
      return !completedScans.some((success:any)=>success.run_type===failed.run_type&&Math.max(timeOf(success.finished_at),timeOf(success.started_at))>failedAt);
    });
    const recentFailure=unresolvedFailures[0]||null;

    const lastMonitorEvent=activeMonitors.map((m:any)=>m.last_event_at).filter(Boolean).sort().reverse()[0]||null;
    const recurringConfigured=tasks.length>0;
    const recurringActive=tasks.some((t:any)=>t.task_key==="source.monitor"&&!t.last_error&&timeOf(t.last_completed_at)>Date.now()-Math.max(120,Number(t.interval_minutes)*2)*60000);
    const schedulingActive=recurringActive;
    const providerHealth=await probeSearchProviders();

    const checks=[
      {key:"workspace",label:"Founder Company Brain complete",done:brain.ready},
      {key:"website",label:"Optional first-party website enrichment",done:Boolean(workspace.website),optional:true},
      {key:"competitors",label:"Relevant competitor universe",done:competitors.length>0},
      {key:"verified",label:"At least one first-party verified competitor",done:verified>0},
      {key:"source_coverage",label:"Evidence/source coverage",done:evidence.some((e:any)=>Boolean(e.source_url))},
      {key:"monitoring",label:"Continuous monitoring active",done:schedulingActive},
      {key:"signals",label:"Structured signals available",done:signals.length>0},
      {key:"weekly_brief",label:"Weekly briefing generated",done:briefings.some((b:any)=>b.period==="weekly")},
      {key:"ask",label:"Ask RADAR intelligence layer",done:Boolean(ai.configured)},
      {key:"feedback",label:"Founder usefulness feedback loop",done:feedback.length>0},
    ];
    const requiredChecks=checks.filter((c:any)=>!c.optional);
    const completed=requiredChecks.filter((c:any)=>c.done).length;

    return NextResponse.json({
      providers:providerHealth,
      crawler:{status:"active",rss_sources:sources.filter((s:any)=>s.status==="active"&&["rss","atom"].includes(s.source_type)).length},
      firecrawl:{status:process.env.FIRECRAWL_FALLBACK_ENABLED?.toLowerCase()!=="true"?"disabled":process.env.FIRECRAWL_API_KEY?"optional fallback":"unavailable"},
      company_brain:brain,
      website:{configured:Boolean(workspace.website),role:"optional_enrichment"},
      ai,
      search:{configured:engineSearchConfigured(),searxng:Boolean(process.env.SEARXNG_BASE_URL),gdelt:String(process.env.GDELT_ENABLED||"true").toLowerCase()!=="false",engine:engineSearchConfigured(),firecrawl_fallback:String(process.env.FIRECRAWL_FALLBACK_ENABLED||"false").toLowerCase()==="true"},
      monitoring:{
        active:schedulingActive,
        provider_monitor:Boolean(discovery),
        recurring_tasks:tasks.length,
        recurring_tasks_configured:recurringConfigured,
        recurring_active:recurringActive,
        last_completed_at:tasks.map((t:any)=>t.last_completed_at).filter(Boolean).sort().reverse()[0]||null,
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
        source_errors:sourceErrors,
        briefings:briefings.length,
      },
      scans:{
        latest:scans[0]||null,
        latest_completed:latestCompleted,
        recent_failure:recentFailure,
        unresolved_failures:unresolvedFailures.length,
        running:runningScans.length,
        running_items:runningScans.slice(0,5),
      },
      beta:{checks,completed,total:requiredChecks.length,percent:Math.round((completed/Math.max(1,requiredChecks.length))*100)},
      launch_ready:Boolean(brain.ready&&ai.configured&&competitors.length>0&&schedulingActive),
    });
  } catch (error) {
    if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});
    return NextResponse.json({error:publicRadarError(error,"Status failed")},{status:500});
  }
}
