import { NextResponse } from "next/server";
import { sbInsert, sbSelect, sbUpdate } from "@/lib/radar-db";
import { firecrawlConfigured, searchWebFast } from "@/lib/firecrawl";
import { workspaceForRequest } from "@/lib/radar-workspace";

function normalizeTerms(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).flatMap(x => x.split(/[,;|]/)).map(x => x.trim()).filter(x => x.length > 2);
  return String(value || "").split(/[,;|\n]/).map(x => x.trim()).filter(x => x.length > 2);
}
function tokens(value: unknown) {
  return [...new Set(normalizeTerms(value).flatMap(term => term.toLowerCase().split(/[^a-z0-9]+/)).filter(x => x.length >= 4))];
}
function domainOf(raw: string) { try { return new URL(raw).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } }
function originOf(raw: string) { try { return new URL(raw).origin; } catch { return raw; } }
function scoreGroup(text:string, values:unknown, weight:number){
  const phraseTerms=normalizeTerms(values).map(x=>x.toLowerCase());
  const tokenTerms=tokens(values);
  if(!phraseTerms.length&&!tokenTerms.length)return 0;
  const phraseHits=phraseTerms.filter(x=>text.includes(x)).length;
  const tokenHits=tokenTerms.filter(x=>text.includes(x)).length;
  const phraseRatio=phraseTerms.length?phraseHits/phraseTerms.length:0;
  const tokenRatio=tokenTerms.length?tokenHits/tokenTerms.length:0;
  return Math.max(phraseRatio,Math.min(1,tokenRatio*1.35))*weight;
}
function scoreCandidate(text: string, workspace: any) {
  const lower = text.toLowerCase();
  let score = 0;
  score += scoreGroup(lower, workspace.product_keywords, 24);
  score += scoreGroup(lower, workspace.major_features, 12);
  score += scoreGroup(lower, workspace.capability_keywords, 18);
  score += scoreGroup(lower, workspace.technology_keywords, 8);
  score += scoreGroup(lower, workspace.target_customers, 12);
  score += scoreGroup(lower, workspace.buyer, 6);
  score += scoreGroup(lower, workspace.problem_statement, 12);
  score += scoreGroup(lower, `${workspace.industry||""},${workspace.sub_category||""}`, 6);
  score += scoreGroup(lower, workspace.business_model, 2);
  return Math.min(100, Math.round(score));
}
function buildQueries(workspace:any){
  const product=normalizeTerms(workspace.product_keywords).slice(0,6);
  const features=normalizeTerms(workspace.major_features).slice(0,5);
  const caps=normalizeTerms(workspace.capability_keywords).slice(0,7);
  const tech=normalizeTerms(workspace.technology_keywords).slice(0,4);
  const customer=[...normalizeTerms(workspace.target_customers),...normalizeTerms(workspace.buyer)].slice(0,5);
  const problem=normalizeTerms(workspace.problem_statement).slice(0,6);
  const industry=normalizeTerms(`${workspace.industry||""},${workspace.sub_category||""}`).slice(0,4);
  const q=new Set<string>();
  if(product.length){
    q.add(`${product.slice(0,3).join(" ")} startup`);
    q.add(`${product.slice(0,2).join(" ")} competitors alternatives`);
    q.add(`${product.slice(0,2).join(" ")} software company startup`);
  }
  if(industry.length) q.add(`${industry.slice(0,2).join(" ")} startups companies`);
  if(product.length&&customer.length){
    q.add(`${product.slice(0,2).join(" ")} for ${customer.slice(0,2).join(" ")} startup`);
    q.add(`${customer.slice(0,2).join(" ")} ${product[0]} platform`);
  }
  if(problem.length){
    q.add(`startup solving ${problem.slice(0,4).join(" ")}`);
    q.add(`${problem.slice(0,3).join(" ")} platform startup`);
  }
  for(const cap of [...features,...caps].slice(0,5)) q.add(`"${cap}" startup company`);
  for(const t of tech.slice(0,2)) q.add(`${t} ${product[0]||industry[0]||caps[0]||"startup"} company`);
  if(workspace.geography&&product.length) q.add(`${product.slice(0,2).join(" ")} startup ${workspace.geography}`);
  if(workspace.name){
    q.add(`${workspace.name} alternatives competitors`);
    q.add(`companies similar to ${workspace.name}`);
  }
  return [...q].filter(Boolean).slice(0,14);
}

export async function GET(req:Request){
  try{const {workspace}=await workspaceForRequest(req,true);const candidates=await sbSelect(`radar_candidates?workspace_id=eq.${workspace.id}&select=*&order=provisional_score.desc&limit=150`);return NextResponse.json({configured:firecrawlConfigured(),candidates})}
  catch(error){if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});return NextResponse.json({error:error instanceof Error?error.message:"Could not load discovery"},{status:500})}
}

export async function POST(req:Request){
  let run:any=null;
  try{
    const {workspace}=await workspaceForRequest(req,true);
    if(!workspace.website)return NextResponse.json({error:"Complete startup setup first. RADAR needs your startup website before it can discover competitors."},{status:400});
    if(!firecrawlConfigured())return NextResponse.json({error:"FIRECRAWL_API_KEY is not configured."},{status:503});
    const body=await req.json().catch(()=>({}));
    const force=Boolean(body?.force);
    const recent=await sbSelect(`radar_scan_runs?workspace_id=eq.${workspace.id}&run_type=eq.market_discovery&status=eq.completed&select=finished_at&order=finished_at.desc&limit=1`);
    if(!force&&recent[0]?.finished_at&&Date.now()-new Date(recent[0].finished_at).getTime()<90*1000)return NextResponse.json({error:"Market discovery was just run. Showing the latest results.",cooldown:true},{status:429});
    run=(await sbInsert("radar_scan_runs",{workspace_id:workspace.id,run_type:"market_discovery",status:"running"}))[0];
    const queries=buildQueries(workspace);
    if(!queries.length)throw new Error("RADAR could not build discovery queries yet. Rebuild the Company Brain from your website.");

    const [existingQueries,existingCompetitors,existingCandidates] = await Promise.all([
      sbSelect(`radar_discovery_queries?workspace_id=eq.${workspace.id}&select=query`),
      sbSelect(`radar_competitors?workspace_id=eq.${workspace.id}&select=id,website`),
      sbSelect(`radar_candidates?workspace_id=eq.${workspace.id}&select=id,domain,status,provisional_score`),
    ]);

    const querySet=new Set(existingQueries.map((r:any)=>r.query));
    const newQueryRows = queries.filter(query=>!querySet.has(query)).map(query=>({workspace_id:workspace.id,query,query_type:"generated",enabled:true}));
    if(newQueryRows.length) await sbInsert("radar_discovery_queries",newQueryRows);

    const ownDomain=domainOf(workspace.website||"");
    const existingDomains=new Set(existingCompetitors.map((x:any)=>domainOf(x.website||"")).filter(Boolean));
    const candidateMap=new Map(existingCandidates.map((x:any)=>[x.domain,x]));

    const searches = await Promise.allSettled(queries.map(query=>searchWebFast(query,8).then(results=>({query,results}))));
    let inspected=0;
    const seen=new Set<string>();
    const candidateRows:any[]=[];
    const candidateUpdates:Promise<any>[]=[];
    const competitorRows:any[]=[];

    for(const resultSet of searches){
      if(resultSet.status!=="fulfilled") continue;
      const {query,results}=resultSet.value;
      inspected+=results.length;
      for(const result of results){
        const domain=domainOf(result.url);
        if(!domain||domain===ownDomain||seen.has(domain))continue;
        seen.add(domain);
        const text=`${result.title||""} ${result.description||""} ${domain}`.slice(0,16000);
        const provisional=scoreCandidate(text,workspace);
        if(provisional<6)continue;

        const existingCandidate:any=candidateMap.get(domain);
        if(!existingCandidate){
          const row={workspace_id:workspace.id,source_query:query,title:result.title||domain,url:result.url,domain,description:result.description||null,provisional_score:provisional,status:provisional>=18?"promoted":"candidate",updated_at:new Date().toISOString()};
          candidateRows.push(row);candidateMap.set(domain,row);
        }else if(provisional>Number(existingCandidate.provisional_score||0)){
          candidateUpdates.push(sbUpdate("radar_candidates",`id=eq.${existingCandidate.id}`,{title:result.title||domain,url:result.url,description:result.description||null,provisional_score:provisional,status:provisional>=18?"promoted":existingCandidate.status,updated_at:new Date().toISOString()}));
        }

        if(provisional>=18&&!existingDomains.has(domain)){
          competitorRows.push({workspace_id:workspace.id,name:String(result.title||domain).split(/[|–—-]/)[0].trim().slice(0,80),website:originOf(result.url),description:result.description||null,category:provisional>=75?"direct":provisional>=50?"adjacent":provisional>=28?"micro":"emerging",similarity_score:provisional,threat_score:Math.min(100,Math.round(provisional*1.12)),momentum_score:35,movement:"stable",monitoring_preference:"neutral",why_it_matters:`Automatically discovered from public/indexable web evidence. Provisional similarity ${provisional}%; deep scan will verify the score.`});
          existingDomains.add(domain);
        }
      }
    }

    const [insertedCandidates,insertedCompetitors] = await Promise.all([
      candidateRows.length ? sbInsert("radar_candidates",candidateRows) : Promise.resolve([]),
      competitorRows.length ? sbInsert("radar_competitors",competitorRows) : Promise.resolve([]),
      ...candidateUpdates,
    ]).then((values:any[])=>[values[0]||[],values[1]||[]]);

    await sbUpdate("radar_scan_runs",`id=eq.${run.id}`,{status:"completed",pages_scanned:inspected,findings:insertedCompetitors.length,finished_at:new Date().toISOString()});
    return NextResponse.json({ok:true,queries_generated:queries.length,inspected,candidates_found:insertedCandidates.length,promoted:insertedCompetitors.length,competitors:insertedCompetitors,candidates:insertedCandidates.sort((a:any,b:any)=>Number(b.provisional_score||0)-Number(a.provisional_score||0)).slice(0,75)});
  }catch(error){
    if(run?.id)try{await sbUpdate("radar_scan_runs",`id=eq.${run.id}`,{status:"failed",error:error instanceof Error?error.message:"Discovery failed",finished_at:new Date().toISOString()})}catch{}
    if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});return NextResponse.json({error:error instanceof Error?error.message:"Discovery failed"},{status:500});
  }
}
