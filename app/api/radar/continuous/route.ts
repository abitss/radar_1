import { NextResponse } from "next/server";
import { createMonitor, firecrawlConfigured } from "@/lib/firecrawl";
import { sbInsert, sbSelect } from "@/lib/radar-db";
import { workspaceForRequest } from "@/lib/radar-workspace";

function normalizeTerms(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).flatMap(x => x.split(/[,;|]/)).map(x => x.trim()).filter(x => x.length > 2);
  return String(value || "").split(/[,;|\n]/).map(x => x.trim()).filter(x => x.length > 2);
}
function buildQueries(workspace: any) {
  const product = normalizeTerms(workspace.product_keywords).slice(0, 6);
  const features = normalizeTerms(workspace.major_features).slice(0, 5);
  const caps = normalizeTerms(workspace.capability_keywords).slice(0, 7);
  const tech = normalizeTerms(workspace.technology_keywords).slice(0, 4);
  const customer = normalizeTerms(`${workspace.target_customers || ""},${workspace.buyer || ""}`).slice(0, 5);
  const problem = normalizeTerms(workspace.problem_statement).slice(0, 6);
  const industry = normalizeTerms(`${workspace.industry || ""},${workspace.sub_category || ""}`).slice(0, 4);
  const q = new Set<string>();
  if (product.length) {
    q.add(`${product.slice(0,3).join(" ")} startup competitor`);
    q.add(`${product.slice(0,2).join(" ")} alternatives company`);
    q.add(`${product.slice(0,2).join(" ")} product launch startup`);
    q.add(`${product.slice(0,2).join(" ")} pricing startup company`);
  }
  if (product.length && customer.length) {
    q.add(`${product.slice(0,2).join(" ")} ${customer.slice(0,2).join(" ")} company`);
    q.add(`${customer.slice(0,2).join(" ")} ${product[0]} new product`);
  }
  if (problem.length) {
    q.add(`startup solving ${problem.slice(0,4).join(" ")}`);
    q.add(`${problem.slice(0,3).join(" ")} company launch`);
  }
  for (const cap of [...features,...caps].slice(0,6)) q.add(`${cap} ${customer.slice(0,2).join(" ") || "startup company"}`);
  for (const t of tech.slice(0,3)) q.add(`${t} ${product[0] || caps[0] || "startup"} company`);
  if(industry.length) q.add(`${industry.slice(0,2).join(" ")} startup funding launch`);
  if (workspace.geography && product.length) q.add(`${product.slice(0,2).join(" ")} startup ${workspace.geography}`);
  if (workspace.name) {
    q.add(`${workspace.name} alternatives competitors`);
    q.add(`companies similar to ${workspace.name}`);
  }
  return [...q].filter(Boolean).slice(0, 20);
}

export async function GET(req: Request) {
  try {
    const { workspace } = await workspaceForRequest(req, true);
    const monitors = await sbSelect(`radar_monitors?workspace_id=eq.${workspace.id}&monitor_type=eq.web_discovery&select=*&order=created_at.desc&limit=1`);
    return NextResponse.json({ configured: firecrawlConfigured(), monitor: monitors[0] || null });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Monitor load failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    if (!firecrawlConfigured()) return NextResponse.json({ error: "FIRECRAWL_API_KEY is not configured." }, { status: 503 });
    const { workspace, user } = await workspaceForRequest(req, true);
    const current = await sbSelect(`radar_monitors?workspace_id=eq.${workspace.id}&monitor_type=eq.web_discovery&status=eq.active&select=*&limit=1`);
    if (current[0]) return NextResponse.json({ ok:true, monitor:current[0], alreadyActive:true });

    const queries = buildQueries(workspace);
    if (!queries.length) return NextResponse.json({ error: "Add more Company Brain details before activating continuous discovery." }, { status: 400 });

    const origin = new URL(req.url).origin;
    const webhookUrl = `${origin}/api/radar/firecrawl-webhook`;
    const secret = process.env.RADAR_API_SECRET || "";
    const goal = `Continuously detect decision-relevant competitive movement around ${workspace.name}. Find newly appearing companies and products, product launches, feature changes, pricing changes, positioning shifts, customer wins, partnerships, hiring patterns, funding, geographic expansion, technology changes and go-to-market moves. Extract the real company and exact related product. Prioritize product overlap, customer overlap and strategic convergence. Ignore generic news, duplicate articles, cosmetic edits and unrelated companies.`;

    const created = await createMonitor({
      name: `RADAR · ${workspace.name} · high-frequency competitive watch`,
      schedule: { text: "every hour", timezone: "UTC" },
      targets: [{ type: "search", queries, searchWindow: "24h", maxResults: 30 }],
      goal,
      judgeEnabled: true,
      webhook: { url: webhookUrl, events: ["monitor.page", "monitor.check.completed"], headers: secret ? { "x-radar-webhook-secret": secret } : undefined },
      notification: { email: { enabled: true, recipients: [user.email], includeDiffs: true } },
    });

    const providerId = created?.id || created?.data?.id || created?.monitor?.id;
    const rows = await sbInsert("radar_monitors", { workspace_id: workspace.id, provider:"firecrawl", provider_monitor_id:providerId || null, monitor_type:"web_discovery", name:`High-frequency competitive watch for ${workspace.name}`, schedule_text:"every hour", goal, status:"active" });
    return NextResponse.json({ ok:true, queries, monitor:rows[0] });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not activate continuous RADAR" }, { status: 500 });
  }
}
