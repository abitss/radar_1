import { NextResponse } from "next/server";
import { createMonitor, firecrawlConfigured } from "@/lib/firecrawl";
import { sbInsert, sbSelect } from "@/lib/radar-db";
import { ensureCompanyBrainExpansion } from "@/lib/radar-brain-expansion";
import { companyBrainReadiness } from "@/lib/radar-profile";
import { workspaceForRequest } from "@/lib/radar-workspace";
import { scheduleWorkspaceRecurringTasks } from "@/lib/radar-source-monitor";

function normalizeTerms(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).flatMap(x => x.split(/[,;|]/)).map(x => x.trim()).filter(x => x.length > 2);
  return String(value || "").split(/[,;|\n]/).map(x => x.trim()).filter(x => x.length > 2);
}
function buildQueries(workspace: any, expansion:any) {
  const product = normalizeTerms(workspace.product_keywords).slice(0, 6);
  const features = normalizeTerms(workspace.major_features).slice(0, 5);
  const caps = normalizeTerms(workspace.capability_keywords).slice(0, 7);
  const tech = normalizeTerms(workspace.technology_keywords).slice(0, 4);
  const customer = normalizeTerms(`${workspace.target_customers || ""},${workspace.buyer || ""}`).slice(0, 5);
  const problem = normalizeTerms(workspace.problem_statement).slice(0, 6);
  const industry = normalizeTerms(`${workspace.industry || ""},${workspace.sub_category || ""}`).slice(0, 4);
  const q = new Set<string>();
  if (product.length) { q.add(`${product.slice(0,3).join(" ")} startup competitor`); q.add(`${product.slice(0,2).join(" ")} alternatives company`); q.add(`${product.slice(0,2).join(" ")} product launch startup`); q.add(`${product.slice(0,2).join(" ")} pricing startup company`); }
  if (product.length && customer.length) { q.add(`${product.slice(0,2).join(" ")} ${customer.slice(0,2).join(" ")} company`); q.add(`${customer.slice(0,2).join(" ")} ${product[0]} new product`); }
  if (problem.length) { q.add(`startup solving ${problem.slice(0,4).join(" ")}`); q.add(`${problem.slice(0,3).join(" ")} company launch`); }
  for (const cap of [...features,...caps].slice(0,6)) q.add(`${cap} ${customer.slice(0,2).join(" ") || "startup company"}`);
  for (const t of tech.slice(0,3)) q.add(`${t} ${product[0] || caps[0] || "startup"} company`);
  if(industry.length) q.add(`${industry.slice(0,2).join(" ")} startup funding launch`);
  if (workspace.geography && product.length) q.add(`${product.slice(0,2).join(" ")} startup ${workspace.geography}`);
  for(const query of Array.isArray(expansion?.search_queries)?expansion.search_queries:[])q.add(String(query));
  return [...q].filter(Boolean).slice(0, 32);
}

async function ensureSystemHeartbeat(workspaceId:string,origin:string){
  const current=await sbSelect(`radar_monitors?monitor_type=eq.global_search&status=eq.active&select=*&order=created_at.asc&limit=1`);
  if(current[0])return current[0];
  const secret=process.env.RADAR_API_SECRET||"";
  if(!secret)return null;
  const created=await createMonitor({
    name:"RADAR system heartbeat",
    schedule:{text:"every hour",timezone:"UTC"},
    targets:[{type:"scrape",urls:[origin],scrapeOptions:{}}],
    goal:"Provide a reliable provider heartbeat so RADAR can process queued intelligence work and recurring multi-tenant maintenance. No content judgment is required.",
    judgeEnabled:false,
    webhook:{url:`${origin}/api/radar/system-maintenance`,events:["monitor.check.completed"],headers:{"x-radar-cron-secret":secret}},
  });
  const providerId=created?.id||created?.data?.id||created?.monitor?.id;
  const rows=await sbInsert("radar_monitors",{workspace_id:workspaceId,provider:"firecrawl",provider_monitor_id:providerId||null,monitor_type:"global_search",name:"RADAR system heartbeat",schedule_text:"every hour",goal:"Autonomous multi-tenant background intelligence worker heartbeat",status:"active"});
  return rows[0]||null;
}

export async function GET(req: Request) {
  try {
    const { workspace } = await workspaceForRequest(req, true);
    const monitors = await sbSelect(`radar_monitors?workspace_id=eq.${workspace.id}&monitor_type=eq.web_discovery&select=*&order=created_at.desc&limit=1`);
    const aiRows=await sbSelect(`radar_discovery_queries?workspace_id=eq.${workspace.id}&query_type=eq.ai_brain_search&enabled=eq.true&select=query&limit=50`).catch(()=>[]);
    return NextResponse.json({ configured: firecrawlConfigured(), monitor: monitors[0] || null, ai_expansion_queries:aiRows.length });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Monitor load failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { workspace, user } = await workspaceForRequest(req, true);
    const readiness=companyBrainReadiness(workspace);
    if(!readiness.ready)return NextResponse.json({error:`Complete the Company Brain first. Missing: ${readiness.missing.join(", ")}.`},{status:400});
    const body:any=await req.json().catch(()=>({}));
    await scheduleWorkspaceRecurringTasks(workspace.id);
    const current = await sbSelect(`radar_monitors?workspace_id=eq.${workspace.id}&monitor_type=eq.web_discovery&status=eq.active&select=*&limit=1`);
    if (current[0]) return NextResponse.json({ ok:true, mode:"provider", monitor:current[0], alreadyActive:true, provider_monitor:true, local_recurring:true });

    const explicitProvider=body?.provider==="firecrawl"||body?.activateProvider===true;
    if(!explicitProvider){
      return NextResponse.json({ok:true,mode:"local_recurring",provider_monitor:false,local_recurring:true,degraded:false,message:"Continuous discovery is running through RADAR recurring search without consuming Firecrawl monitor credits."});
    }
    if (!firecrawlConfigured()) return NextResponse.json({ok:true,mode:"local_recurring",provider_monitor:false,local_recurring:true,degraded:true,message:"Firecrawl is unavailable; RADAR is using recurring engine search instead."});

    const origin = new URL(req.url).origin;
    await ensureSystemHeartbeat(workspace.id,origin).catch(()=>null);
    let expansion:any=null;
    try{expansion=await ensureCompanyBrainExpansion(workspace);}catch{expansion={search_queries:[]}}
    const queries = buildQueries(workspace,expansion);
    if (!queries.length) return NextResponse.json({ error: "Add more Company Brain details before activating continuous discovery." }, { status: 400 });
    const webhookUrl = `${origin}/api/radar/firecrawl-webhook`;
    const secret = process.env.RADAR_API_SECRET || "";
    const goal = `Continuously detect decision-relevant competitive movement around ${workspace.name}, using the founder Company Brain plus AI-derived semantic search hypotheses. Find newly appearing companies and products, direct rivals, adjacent categories, substitutes, incumbent workflows, product launches, feature changes, pricing changes, positioning shifts, customer wins, partnerships, hiring patterns, funding, geographic expansion, technology changes and go-to-market moves. Extract the real company and exact related product. Treat AI expansion terms as search hypotheses, not facts. Prioritize product overlap, customer overlap and strategic convergence. Ignore generic news, duplicate articles, cosmetic edits and unrelated companies.`;
    const monitorPayload:any={name:`RADAR · ${workspace.name} · high-frequency competitive watch`,schedule:{text:"every hour",timezone:"UTC"},targets:[{type:"search",queries,searchWindow:"24h",maxResults:30}],goal,judgeEnabled:true,webhook:{url:webhookUrl,events:["monitor.page","monitor.check.completed"],headers:secret?{"x-radar-webhook-secret":secret}:undefined}};
    if(user?.email) monitorPayload.notification={email:{enabled:true,recipients:[user.email],includeDiffs:true}};
    try{
      const created = await createMonitor(monitorPayload);
      const providerId = created?.id || created?.data?.id || created?.monitor?.id;
      const rows = await sbInsert("radar_monitors", { workspace_id: workspace.id, provider:"firecrawl", provider_monitor_id:providerId || null, monitor_type:"web_discovery", name:`High-frequency competitive watch for ${workspace.name}`, schedule_text:"every hour", goal, status:"active" });
      return NextResponse.json({ ok:true, mode:"provider", queries, ai_expansion_queries:Number(expansion?.search_queries?.length||0), monitor:rows[0], systemHeartbeat:true, provider_monitor:true, local_recurring:true });
    }catch(error){
      const message=error instanceof Error?error.message:String(error||"");
      if(/rate limit|HTTP 429|insufficient credits|more credits|upgrade your plan/i.test(message)){
        return NextResponse.json({ok:true,mode:"local_recurring",provider_monitor:false,local_recurring:true,degraded:true,message:"Firecrawl is rate-limited or out of credits; RADAR kept recurring engine search active instead."});
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not activate continuous RADAR" }, { status: 500 });
  }
}
