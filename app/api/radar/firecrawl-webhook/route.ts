import { NextResponse } from "next/server";
import { sbInsert, sbSelect, sbUpdate } from "@/lib/radar-db";

function domainOf(raw: string) {
  try { return new URL(raw).hostname.replace(/^www\./, "").toLowerCase(); }
  catch { return ""; }
}

function flattenEvents(payload: any) {
  const data = payload?.data;
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") return [data];
  return [];
}

export async function POST(req: Request) {
  try {
    const expected = process.env.RADAR_API_SECRET || "";
    const supplied = req.headers.get("x-radar-webhook-secret") || "";
    if (expected && supplied !== expected) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = await req.json();
    const type = String(payload?.type || "");
    const monitorId = payload?.data?.monitorId || payload?.monitorId || payload?.metadata?.monitorId || null;

    let monitor: any = null;
    if (monitorId) {
      const rows = await sbSelect(`radar_monitors?provider_monitor_id=eq.${encodeURIComponent(String(monitorId))}&select=*&limit=1`);
      monitor = rows[0] || null;
    }
    if (!monitor) {
      const rows = await sbSelect("radar_monitors?provider=eq.firecrawl&status=eq.active&select=*&order=created_at.desc&limit=1");
      monitor = rows[0] || null;
    }
    if (!monitor) return NextResponse.json({ ok: true, ignored: "monitor_not_found" });

    await sbUpdate("radar_monitors", `id=eq.${monitor.id}`, { last_event_at: new Date().toISOString(), updated_at: new Date().toISOString(), last_error: null });

    if (type === "monitor.check.completed") return NextResponse.json({ ok: true, type, processed: 0 });

    const workspaceRows = await sbSelect(`radar_workspaces?id=eq.${monitor.workspace_id}&select=*`);
    const workspace = workspaceRows[0];
    if (!workspace) return NextResponse.json({ ok: true, ignored: "workspace_not_found" });

    const ownDomain = domainOf(workspace.website || "");
    const events = flattenEvents(payload);
    let processed = 0;

    for (const event of events) {
      const meaningful = event?.isMeaningful ?? event?.judgment?.meaningful ?? true;
      if (!meaningful) continue;

      const url = String(event?.url || event?.sourceUrl || event?.metadata?.url || "");
      const domain = domainOf(url);
      if (!url || !domain || domain === ownDomain) continue;

      const reason = String(event?.judgment?.reason || event?.reason || "New competitive web result matched RADAR's monitoring goal.");
      const diffText = String(event?.diff?.text || event?.content || event?.markdown || "").slice(0, 10000);
      const title = String(event?.title || event?.metadata?.title || domain).slice(0, 200);
      const existing = await sbSelect(`radar_candidates?workspace_id=eq.${workspace.id}&domain=eq.${encodeURIComponent(domain)}&select=*&limit=1`);

      if (!existing[0]) {
        await sbInsert("radar_candidates", {
          workspace_id: workspace.id,
          source_query: "continuous_firecrawl_monitor",
          title,
          url,
          domain,
          description: reason,
          provisional_score: 20,
          status: "candidate",
        });
      } else {
        await sbUpdate("radar_candidates", `id=eq.${existing[0].id}`, {
          url,
          description: reason,
          updated_at: new Date().toISOString(),
        });
      }

      await sbInsert("radar_evidence", {
        workspace_id: workspace.id,
        competitor_id: null,
        source_url: url,
        source_type: "continuous_web_monitor",
        title,
        fact: reason,
        summary: diffText || "New public result discovered by continuous competitive monitoring.",
        confidence: event?.judgment?.confidence === "high" ? 92 : event?.judgment?.confidence === "low" ? 60 : 78,
      });

      await sbInsert("radar_signals", {
        workspace_id: workspace.id,
        competitor_id: null,
        signal_type: "new_web_candidate",
        title: `New competitive candidate: ${title}`,
        summary: reason,
        impact_score: 55,
        confidence: event?.judgment?.confidence === "high" ? 92 : 78,
        status: "new",
      });
      processed++;
    }

    return NextResponse.json({ ok: true, type, processed });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Webhook processing failed" }, { status: 500 });
  }
}
