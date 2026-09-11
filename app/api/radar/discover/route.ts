import { NextResponse } from "next/server";
import { sbInsert, sbSelect, sbUpdate } from "@/lib/radar-db";
import { firecrawlConfigured, searchWeb } from "@/lib/firecrawl";
import { workspaceForRequest } from "@/lib/radar-workspace";

function normalizeTerms(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).flatMap(x => x.split(/[,;|]/)).map(x => x.trim()).filter(x => x.length > 2);
  return String(value || "").split(/[,;|\n]/).map(x => x.trim()).filter(x => x.length > 2);
}
function domainOf(raw: string) { try { return new URL(raw).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } }
function originOf(raw: string) { try { return new URL(raw).origin; } catch { return raw; } }
function scoreCandidate(text: string, workspace: any) {
  const lower = text.toLowerCase();
  const groups: Array<[string[], number]> = [
    [normalizeTerms(workspace.product_keywords), 28], [normalizeTerms(workspace.capability_keywords), 22],
    [normalizeTerms(workspace.technology_keywords), 10], [normalizeTerms(workspace.target_customers), 16],
    [normalizeTerms(workspace.buyer), 8], [normalizeTerms(workspace.problem_statement), 12], [normalizeTerms(workspace.business_model), 4],
  ];
  let score = 0;
  for (const [items, weight] of groups) { const unique=[...new Set(items.map(x=>x.toLowerCase()))]; if(unique.length) score += (unique.filter(term=>lower.includes(term)).length/unique.length)*weight; }
  return Math.min(100, Math.round(score));
}
function buildQueries(workspace:any){
  const product=normalizeTerms(workspace.product_keywords).slice(0,6), caps=normalizeTerms(workspace.capability_keywords).slice(0,8), tech=normalizeTerms(workspace.technology_keywords).slice(0,5), customer=[...normalizeTerms(workspace.target_customers),...normalizeTerms(workspace.buyer)].slice(0,4), problem=normalizeTerms(workspace.problem_statement).slice(0,6);
  const q=new Set<string>();
  if(product.length)q.add(`${product.slice(0,3).join(" ")} startup competitors`);
  if(product.length&&customer.length)q.add(`${product.slice(0,2).join(" ")} for ${customer.slice(0,2).join(" ")} company`);
  if(problem.length)q.add(`startup solving ${problem.slice(0,4).join(" ")}`);
  for(const cap of caps.slice(0,6))q.add(`${cap} ${customer.slice(0,2).join(" ")||"startup company"}`);
  for(const t of tech.slice(0,3))q.add(`${t} ${product[0]||caps[0]||"startup"} company`);
  if(workspace.geography&&product.length)q.add(`${product.slice(0,2).join(" ")} startup ${workspace.geography}`);
  if(workspace.name)q.add(`${workspace.name} alternatives competitors`);
  return [...q].filter(Boolean).slice(0,14);
}

export async function GET(req:Request){
  try{const {workspace}=await workspaceForRequest(req,true);const candidates=await sbSelect(`radar_candidates?workspace_id=eq.${workspace.id}&select=*&order=provisional_score.desc&limit=100`);return NextResponse.json({configured:firecrawlConfigured(),candidates})}
  catch(error){if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});return NextResponse.json({error:error instanceof Error?error.message:"Could not load discovery"},{status:500})}
}

export async function POST(req:Request){
  let run:any=null;
  try{
    const {workspace}=await workspaceForRequest(req,true);
    if(!firecrawlConfigured())return NextResponse.json({error:"FIRECRAWL_API_KEY is not configured."},{status:503});
    const recent=await sbSelect(`radar_scan_runs?workspace_id=eq.${workspace.id}&run_type=eq.market_discovery&status=eq.completed&select=finished_at&order=finished_at.desc&limit=1`);
    if(recent[0]?.finished_at&&Date.now()-new Date(recent[0].finished_at).getTime()<5*60*1000)return NextResponse.json({error:"Market discovery was just run. Wait a few minutes before scanning again.",cooldown:true},{status:429});
    run=(await sbInsert("radar_scan_runs",{workspace_id:workspace.id,run_type:"market_discovery",status:"running"}))[0];
    const queries=buildQueries(workspace);
    if(!queries.length)throw new Error("Add more Company Brain details before discovery.");

    const existingQueries=await sbSelect(`radar_discovery_queries?workspace_id=eq.${workspace.id}&select=query`),querySet=new Set(existingQueries.map((r:any)=>r.query));
    for(const query of queries)if(!querySet.has(query))await sbInsert("radar_discovery_queries",{workspace_id:workspace.id,query,query_type:"generated",enabled:true});
    const ownDomain=domainOf(workspace.website||"");
    const existingCompetitors=await sbSelect(`radar_competitors?workspace_id=eq.${workspace.id}&select=website`),existingDomains=new Set(existingCompetitors.map((x:any)=>domainOf(x.website||"")).filter(Boolean));
    const existingCandidates=await sbSelect(`radar_candidates?workspace_id=eq.${workspace.id}&select=domain`),candidateDomains=new Set(existingCandidates.map((x:any)=>x.domain));
    const candidates:any[]=[];let promoted=0,inspected=0;const seen=new Set<string>();

    for(const query of queries.slice(0,12)){
      const results=await searchWeb(query,6);inspected+=results.length;
      for(const result of results){
        const domain=domainOf(result.url);if(!domain||domain===ownDomain||seen.has(domain))continue;seen.add(domain);
        const text=`${result.title||""} ${result.description||""} ${result.markdown||""}`.slice(0,40000),provisional=scoreCandidate(text,workspace);if(provisional<8)continue;
        const row={workspace_id:workspace.id,source_query:query,title:result.title||domain,url:result.url,domain,description:result.description||null,provisional_score:provisional,status:provisional>=24?"promoted":"candidate",updated_at:new Date().toISOString()};
        if(!candidateDomains.has(domain)){const inserted=await sbInsert("radar_candidates",row);if(inserted?.[0])candidates.push(inserted[0]);candidateDomains.add(domain)}
        if(provisional>=24&&!existingDomains.has(domain)){
          await sbInsert("radar_competitors",{workspace_id:workspace.id,name:String(result.title||domain).split(/[|–—-]/)[0].trim().slice(0,80),website:originOf(result.url),description:result.description||null,category:provisional>=80?"direct":provisional>=55?"adjacent":provisional>=30?"micro":"emerging",similarity_score:provisional,threat_score:Math.min(100,Math.round(provisional*1.08)),momentum_score:35,movement:"stable",why_it_matters:`Automatically discovered from public web evidence with provisional similarity ${provisional}%.`});existingDomains.add(domain);promoted++;
        }
      }
    }
    await sbUpdate("radar_scan_runs",`id=eq.${run.id}`,{status:"completed",pages_scanned:inspected,findings:promoted,finished_at:new Date().toISOString()});
    return NextResponse.json({ok:true,queries_generated:queries.length,inspected,candidates_found:candidates.length,promoted,candidates:candidates.sort((a,b)=>Number(b.provisional_score||0)-Number(a.provisional_score||0)).slice(0,50)});
  }catch(error){
    if(run?.id)try{await sbUpdate("radar_scan_runs",`id=eq.${run.id}`,{status:"failed",error:error instanceof Error?error.message:"Discovery failed",finished_at:new Date().toISOString()})}catch{}
    if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});return NextResponse.json({error:error instanceof Error?error.message:"Discovery failed"},{status:500});
  }
}
