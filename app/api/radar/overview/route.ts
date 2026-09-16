import { NextResponse } from "next/server";
import { sbSelect } from "@/lib/radar-db";
import { workspaceForRequest } from "@/lib/radar-workspace";

export async function GET(req: Request) {
  try {
    const { workspace } = await workspaceForRequest(req, true);
    const [competitors,candidates,signals,recommendations,monitors,evidence,briefings,feedback,events,moves,decisions] = await Promise.all([
      sbSelect(`radar_competitors?workspace_id=eq.${workspace.id}&select=*&order=threat_score.desc&limit=100`),
      sbSelect(`radar_candidates?workspace_id=eq.${workspace.id}&select=*&order=product_overlap_score.desc,provisional_score.desc&limit=150`),
      sbSelect(`radar_signals?workspace_id=eq.${workspace.id}&select=*&order=observed_at.desc&limit=50`),
      sbSelect(`radar_recommendations?workspace_id=eq.${workspace.id}&select=*&order=created_at.desc&limit=50`),
      sbSelect(`radar_monitors?workspace_id=eq.${workspace.id}&select=*&order=created_at.desc&limit=150`),
      sbSelect(`radar_evidence?workspace_id=eq.${workspace.id}&select=id,competitor_id,source_type,confidence,observed_at&order=observed_at.desc&limit=1000`),
      sbSelect(`radar_briefings?workspace_id=eq.${workspace.id}&select=id,period,created_at&order=created_at.desc&limit=50`),
      sbSelect(`radar_feedback?workspace_id=eq.${workspace.id}&select=id,feedback_type,created_at&order=created_at.desc&limit=100`),
      sbSelect(`radar_intelligence_events?workspace_id=eq.${workspace.id}&select=*&order=occurred_at.desc&limit=60`),
      sbSelect(`radar_moves?workspace_id=eq.${workspace.id}&select=id,status,impact_score,confidence,updated_at&order=updated_at.desc&limit=100`).catch(()=>[]),
      sbSelect(`radar_decisions?workspace_id=eq.${workspace.id}&select=id,status,confidence,updated_at&order=updated_at.desc&limit=100`).catch(()=>[]),
    ]);
    const now = Date.now();
    const day = 24*60*60*1000;
    const hour = 60*60*1000;
    const newSignals = signals.filter((s:any)=>now-new Date(s.observed_at||s.created_at).getTime()<=day);
    const liveEvents = events.filter((e:any)=>now-new Date(e.occurred_at||e.created_at).getTime()<=hour);
    const criticalEvents = events.filter((e:any)=>e.severity==="critical"&&e.status==="new");
    const highEvents = events.filter((e:any)=>["high","critical"].includes(e.severity)&&e.status==="new");
    const movingCloser = competitors.filter((c:any)=>c.movement==="closer");
    const core = competitors.filter((c:any)=>Number(c.similarity_score||0)>=80);
    const openRecommendations = recommendations.filter((r:any)=>r.status==="open");
    const activeMoves = moves.filter((m:any)=>["watching","confirmed"].includes(m.status));
    const confirmedMoves = moves.filter((m:any)=>m.status==="confirmed");
    const openDecisions = decisions.filter((d:any)=>d.status==="open");
    const activeMonitors = monitors.filter((m:any)=>m.status==="active");
    const discoveryMonitors = activeMonitors.filter((m:any)=>m.monitor_type==="web_discovery");
    const monitor = discoveryMonitors[0] || null;
    const activeCompetitorMonitors = activeMonitors.filter((m:any)=>m.competitor_id);
    const monitoredIds = new Set(activeCompetitorMonitors.map((m:any)=>m.competitor_id));
    const approved = competitors.filter((c:any)=>c.monitoring_preference==="monitor" || monitoredIds.has(c.id));
    const highConfidenceEvidence = evidence.filter((e:any)=>Number(e.confidence||0)>=80).length;
    const usefulFeedback = feedback.filter((f:any)=>f.feedback_type==="useful").length;
    const negativeFeedback = feedback.filter((f:any)=>["not_useful","too_noisy","wrong_interpretation","wrong_fact","not_competitor"].includes(f.feedback_type)).length;
    const lastMonitorEvent = monitors.map((m:any)=>m.last_event_at).filter(Boolean).sort().reverse()[0] || null;
    return NextResponse.json({
      workspace, competitors, candidates, signals, recommendations, monitor, events, moves, decisions,
      live:{
        mode:"event-driven-near-real-time",
        lastMonitorEvent,
        activeMonitors:activeMonitors.length,
        activeDiscoveryMonitors:discoveryMonitors.length,
        activeCompetitorMonitors:activeCompetitorMonitors.length,
        eventsLastHour:liveEvents.length,
        critical:criticalEvents.length,
        highPriority:highEvents.length,
      },
      metrics:{
        competitors:competitors.length,
        core:core.length,
        candidates:candidates.filter((c:any)=>["new","candidate"].includes(c.status)&&c.entity_type!=="source").length,
        sourceLeads:candidates.filter((c:any)=>c.entity_type==="source").length,
        newSignals:newSignals.length,
        movingCloser:movingCloser.length,
        openRecommendations:openRecommendations.length,
        activeMoves:activeMoves.length,
        confirmedMoves:confirmedMoves.length,
        openDecisions:openDecisions.length,
        monitoredCompetitors:approved.length,
        evidence:evidence.length,
        highConfidenceEvidence,
        verifiedCompetitors:competitors.filter((c:any)=>Boolean(c.last_scanned_at)).length,
        briefings:briefings.length,
        weeklyBriefings:briefings.filter((b:any)=>b.period==="weekly").length,
        feedback:feedback.length,
        usefulFeedback,
        negativeFeedback,
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error:"Unauthorized" },{status:401});
    return NextResponse.json({ error:error instanceof Error?error.message:"Overview failed" },{status:500});
  }
}
