import { NextResponse } from "next/server";
import { firecrawlConfigured } from "@/lib/firecrawl";
import { radarAIProvider } from "@/lib/radar-ai";
import { workspaceForRequest } from "@/lib/radar-workspace";
import { sbSelect } from "@/lib/radar-db";

export async function GET(req: Request) {
  try {
    const { workspace } = await workspaceForRequest(req, true);
    const [monitors, scans] = await Promise.all([
      sbSelect(`radar_monitors?workspace_id=eq.${workspace.id}&select=monitor_type,status,last_event_at,schedule_text&order=created_at.desc&limit=10`),
      sbSelect(`radar_scan_runs?workspace_id=eq.${workspace.id}&select=run_type,status,finished_at,error&order=created_at.desc&limit=10`),
    ]);
    const ai = radarAIProvider();
    const discovery = monitors.find((m:any)=>m.monitor_type==="web_discovery"&&m.status==="active") || null;
    const failed = scans.find((s:any)=>s.status==="failed") || null;
    return NextResponse.json({
      ai,
      firecrawl: { configured: firecrawlConfigured() },
      monitoring: { active: Boolean(discovery), schedule: discovery?.schedule_text || null, last_event_at: discovery?.last_event_at || null },
      scans: { latest: scans[0] || null, recent_failure: failed },
      launch_ready: Boolean(ai.configured && firecrawlConfigured() && workspace.website),
    });
  } catch (error) {
    if(error instanceof Error && error.message==="UNAUTHORIZED") return NextResponse.json({error:"Unauthorized"},{status:401});
    return NextResponse.json({error:error instanceof Error?error.message:"Status failed"},{status:500});
  }
}
