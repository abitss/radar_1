import { NextResponse } from "next/server";
import { sbInsert, sbSelect } from "@/lib/radar-db";
import { radarDomain, radarOrigin } from "@/lib/radar-discovery-quality";
import { workspaceForRequest } from "@/lib/radar-workspace";

export async function GET(req: Request) {
  try {
    const { workspace } = await workspaceForRequest(req, true);
    const [rows, monitors, evidence] = await Promise.all([
      sbSelect(`radar_competitors?workspace_id=eq.${workspace.id}&select=*&order=similarity_score.desc`),
      sbSelect(`radar_monitors?workspace_id=eq.${workspace.id}&select=id,competitor_id,status,monitor_type,last_event_at,last_error&limit=500`),
      sbSelect(`radar_evidence?workspace_id=eq.${workspace.id}&select=id,competitor_id,confidence,observed_at&limit=2000`),
    ]);

    const monitorByCompetitor = new Map<string, any[]>();
    for (const monitor of monitors) {
      if (!monitor.competitor_id) continue;
      const current = monitorByCompetitor.get(monitor.competitor_id) || [];
      current.push(monitor);
      monitorByCompetitor.set(monitor.competitor_id, current);
    }

    const evidenceByCompetitor = new Map<string, { count:number; high:number; latest:string | null }>();
    for (const item of evidence) {
      if (!item.competitor_id) continue;
      const current = evidenceByCompetitor.get(item.competitor_id) || { count:0, high:0, latest:null };
      current.count += 1;
      if (Number(item.confidence || 0) >= 80) current.high += 1;
      if (!current.latest || new Date(item.observed_at).getTime() > new Date(current.latest).getTime()) current.latest = item.observed_at;
      evidenceByCompetitor.set(item.competitor_id, current);
    }

    return NextResponse.json(rows.map((row:any) => {
      const competitorMonitors = monitorByCompetitor.get(row.id) || [];
      const active = competitorMonitors.find((m:any) => m.status === "active") || null;
      const coverage = evidenceByCompetitor.get(row.id) || { count:0, high:0, latest:null };
      const verification_status = row.last_scanned_at ? "verified" : coverage.count > 0 ? "evidence-backed" : "provisional";
      return {
        ...row,
        monitor_active: Boolean(active),
        monitor_status: active?.status || competitorMonitors[0]?.status || null,
        monitor_last_event_at: active?.last_event_at || competitorMonitors[0]?.last_event_at || null,
        monitor_error: active?.last_error || competitorMonitors[0]?.last_error || null,
        evidence_count: coverage.count,
        high_confidence_evidence: coverage.high,
        latest_evidence_at: coverage.latest,
        verification_status,
      };
    }));
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load competitors" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { workspace } = await workspaceForRequest(req, true);
    const website = String(body.website || "").trim();
    if (!website) return NextResponse.json({ error: "Website is required" }, { status: 400 });

    let raw = website;
    if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
    let parsed:URL;
    try { parsed = new URL(raw); } catch { return NextResponse.json({ error:"Enter a valid company website." },{status:400}); }
    if (!["http:", "https:"].includes(parsed.protocol)) return NextResponse.json({ error: "Only http/https URLs are allowed" }, { status: 400 });

    const normalized = radarOrigin(parsed.toString()) || parsed.origin;
    const host = radarDomain(normalized);
    if (!host) return NextResponse.json({ error:"Enter a valid company website." },{status:400});
    const ownHost = radarDomain(workspace.website || "");
    if (ownHost && host === ownHost) return NextResponse.json({ error: "Your own startup cannot be added as a competitor." }, { status: 400 });

    // Website uniqueness is semantic by hostname, not by http/https spelling.
    const existingRows = await sbSelect(`radar_competitors?workspace_id=eq.${workspace.id}&select=*&limit=300`);
    const existing = existingRows.find((c:any)=>radarDomain(c.website||"")===host);
    if (existing) return NextResponse.json(existing, { status: 200 });

    const derivedName = host.split(".")[0].replace(/[-_]+/g," ").replace(/\b\w/g,m=>m.toUpperCase());
    const name = String(body.name || derivedName).trim().slice(0,120);
    if (!name) return NextResponse.json({error:"Company name could not be resolved."},{status:400});

    const rows = await sbInsert("radar_competitors", {
      workspace_id: workspace.id,
      name,
      website: normalized,
      description: body.description || null,
      category: "watchlist",
      category_locked: false,
      similarity_score: 0,
      product_overlap_score: 0,
      relation_confidence: 0,
      threat_score: 0,
      momentum_score: 0,
      movement: "stable",
      monitoring_preference: "auto",
      why_it_matters: "Founder-added watchlist company. Run a deep scan to verify product overlap, strategic similarity and threat before treating this placement as evidence-backed.",
    });
    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not add competitor" }, { status: 500 });
  }
}
