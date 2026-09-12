import { NextResponse } from "next/server";
import { sbInsert, sbSelect, sbUpdate } from "@/lib/radar-db";
import { firecrawlConfigured, searchWebFast } from "@/lib/firecrawl";
import { analyzeDiscoveryResults, radarAIConfigured } from "@/lib/radar-ai";
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
  score += scoreGroup(lower, workspace.product_keywords, 25);
  score += scoreGroup(lower, workspace.major_features, 14);
  score += scoreGroup(lower, workspace.capability_keywords, 18);
  score += scoreGroup(lower, workspace.technology_keywords, 7);
  score += scoreGroup(lower, workspace.target_customers, 11);
  score += scoreGroup(lower, workspace.buyer, 5);
  score += scoreGroup(lower, workspace.problem_statement, 12);
  score += scoreGroup(lower, `${workspace.industry||""},${workspace.sub_category||""}`, 6);
  score += scoreGroup(lower, workspace.business_model, 2);
  return Math.min(100, Math.round(score));
}
function categoryFor(score:number){if(score>=75)return"direct";if(score>=50)return"adjacent";if(score>=28)return"micro";return"emerging"}
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
    q.add(`${product.slice(0,2).join(" ")} product company`);
    q.add(`best ${product.slice(0,2).join(" ")} companies`);
  }
  if(industry.length) q.add(`${industry.slice(0,2).join(" ")} startups companies`);
  if(product.length&&customer.length){
    q.add(`${product.slice(0,2).join(" ")} for ${customer.slice(0,2).join(" ")} startup`);
    q.add(`${customer.slice(0,2).join(" ")} ${product[0]} product company`);
  }
  if(problem.length){
    q.add(`startup solving ${problem.slice(0,4).join(" ")}`);
    q.add(`${problem.slice(0,3).join(" ")} product startup`);
  }
  for(const cap of [...features,...caps].slice(0,5)) q.add(`"${cap}" startup product`);
  for(const t of tech.slice(0,2)) q.add(`${t} ${product[0]||industry[0]||caps[0]||"startup"} product company`);
  if(workspace.geography&&product.length) q.add(`${product.slice(0,2).join(" ")} startup ${workspace.geography}`);
  if(workspace.name){ q.add(`${workspace.name} alternatives competitors`); q.add(`companies similar to ${workspace.name}`); }
  return [...q].filter(Boolean).slice(0,14);
}

const sourceDomains = [
  "wikipedia.org","ycombinator.com","crunchbase.com","tracxn.com","wellfound.com","linkedin.com","youtube.com","reddit.com",
  "news.mit.edu","mit.edu","caltech.edu","techcrunch.com","forbes.com","reuters.com","bloomberg.com","medium.com",
  "uavcoach.com","startup0km.com","cbinsights.com","g2.com","capterra.com","producthunt.com"
];
function sourceLike(domain:string){ return sourceDomains.some(x=>domain===x||domain.endsWith(`.${x}`)); }
function articleLike(result:any){
  const domain=domainOf(result.url); const text=`${result.title||""} ${result.description||""}`.toLowerCase();
  return sourceLike(domain)||/(top\s+\d+|best\s+.*companies|startups funded|news|review|list of|companies to watch|researchers|study|report)/i.test(text);
}
function cleanCompanyName(value:string){return String(value||"").replace(/\s+/g," ").trim().replace(/[|–—-].*$/," ").trim().slice(0,100)}

async function resolveOfficialWebsite(name:string, relatedProduct:string, supplied:string, ownDomain:string){
  const suppliedDomain=domainOf(supplied||"");
  if(suppliedDomain&&!sourceLike(suppliedDomain)&&suppliedDomain!==ownDomain)return originOf(supplied);
  try{
    const results=await searchWebFast(`"${name}" ${relatedProduct||"product"} official`,4);
    const nameTokens=name.toLowerCase().split(/[^a-z0-9]+/).filter(x=>x.length>2);
    const hit=results.find((r:any)=>{
      const d=domainOf(r.url); if(!d||sourceLike(d)||d===ownDomain)return false;
      const hay=`${r.title||""} ${r.description||""} ${d}`.toLowerCase();
      return nameTokens.some(t=>hay.includes(t));
    });
    return hit?originOf(hit.url):"";
  }catch{return ""}
}

export async function GET(req:Request){
  try{const {workspace}=await workspaceForRequest(req,true);const candidates=await sbSelect(`radar_candidates?workspace_id=eq.${workspace.id}&select=*&order=product_overlap_score.desc,provisional_score.desc&limit=150`);return NextResponse.json({configured:firecrawlConfigured(),ai:radarAIConfigured(),candidates})}
  catch(error){if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});return NextResponse.json({error:error instanceof Error?error.message:"Could not load discovery"},{status:500})}
}

export async function POST(req:Request){
  let run:any=null;
  try{
    const {workspace}=await workspaceForRequest(req,true);
    if(!workspace.website)return NextResponse.json({error:"Complete startup setup first. RADAR needs your startup website before it can discover competitors."},{status:400});
    if(!firecrawlConfigured())return NextResponse.json({error:"FIRECRAWL_API_KEY is not configured."},{status:503});
    const body=await req.json().catch(()=>({})); const force=Boolean(body?.force);
    const recent=await sbSelect(`radar_scan_runs?workspace_id=eq.${workspace.id}&run_type=eq.market_discovery&status=eq.completed&select=finished_at&order=finished_at.desc&limit=1`);
    if(!force&&recent[0]?.finished_at&&Date.now()-new Date(recent[0].finished_at).getTime()<90*1000)return NextResponse.json({error:"Market discovery was just run. Showing the latest results.",cooldown:true},{status:429});
    run=(await sbInsert("radar_scan_runs",{workspace_id:workspace.id,run_type:"market_discovery",status:"running"}))[0];
    const queries=buildQueries(workspace); if(!queries.length)throw new Error("RADAR could not build discovery queries yet. Rebuild the Company Brain from your website.");

    const [existingQueries,existingCompetitors,existingCandidates]=await Promise.all([
      sbSelect(`radar_discovery_queries?workspace_id=eq.${workspace.id}&select=query`),
      sbSelect(`radar_competitors?workspace_id=eq.${workspace.id}&select=id,name,website`),
      sbSelect(`radar_candidates?workspace_id=eq.${workspace.id}&select=id,domain,status,provisional_score,product_overlap_score,official_website`),
    ]);
    const querySet=new Set(existingQueries.map((r:any)=>r.query));
    const newQueryRows=queries.filter(q=>!querySet.has(q)).map(query=>({workspace_id:workspace.id,query,query_type:"generated",enabled:true}));
    if(newQueryRows.length)await sbInsert("radar_discovery_queries",newQueryRows);

    const ownDomain=domainOf(workspace.website||"");
    const existingDomains=new Set(existingCompetitors.map((x:any)=>domainOf(x.website||"")).filter(Boolean));
    const existingNames=new Set(existingCompetitors.map((x:any)=>String(x.name||"").toLowerCase()));
    const candidateMap=new Map(existingCandidates.map((x:any)=>[x.domain,x]));

    const searches=await Promise.allSettled(queries.map(query=>searchWebFast(query,8).then(results=>({query,results}))));
    let inspected=0; const raw:any[]=[];
    for(const set of searches){if(set.status!=="fulfilled")continue;inspected+=set.value.results.length;for(const r of set.value.results)raw.push({...r,source_query:set.value.query})}
    const deduped=[...new Map(raw.filter(r=>domainOf(r.url)&&domainOf(r.url)!==ownDomain).map(r=>[r.url,r])).values()].slice(0,80) as any[];

    let analyzed:any[]=[];
    if(radarAIConfigured()){
      for(let i=0;i<deduped.length;i+=20){
        try{const batch=await analyzeDiscoveryResults(workspace,deduped.slice(i,i+20));if(batch)analyzed.push(...batch)}catch{}
      }
    }
    const analysisByUrl=new Map(analyzed.map((x:any)=>[x.source_url,x]));
    const entities:any[]=[];

    for(const result of deduped){
      const sourceDomain=domainOf(result.url); const analysis:any=analysisByUrl.get(result.url);
      if(analysis?.companies?.length){
        for(const c of analysis.companies){
          const name=cleanCompanyName(c.name); if(!name)continue;
          entities.push({name,official_website:c.official_website||"",related_product:c.related_product||"",relationship_reason:c.relationship_reason||result.description||"",relation_confidence:Number(c.relation_confidence||0),product_overlap_score:Number(c.product_overlap_score||0),source_url:result.url,source_query:result.source_query,source_type:analysis.source_type||"other",source_title:result.title,source_description:result.description});
        }
      }else if(!articleLike(result)){
        const provisional=scoreCandidate(`${result.title||""} ${result.description||""}`,workspace);
        if(provisional>=10)entities.push({name:cleanCompanyName(result.title||sourceDomain),official_website:originOf(result.url),related_product:String(result.description||"").slice(0,250),relationship_reason:`Official-looking company result matched RADAR discovery query: ${result.source_query}`,relation_confidence:60,product_overlap_score:provisional,source_url:result.url,source_query:result.source_query,source_type:"company",source_title:result.title,source_description:result.description});
      }
    }

    const entityMap=new Map<string,any>();
    for(const e of entities){const key=e.name.toLowerCase();const old=entityMap.get(key);if(!old||e.product_overlap_score>old.product_overlap_score)entityMap.set(key,e)}
    const shortlisted=[...entityMap.values()].filter(e=>e.product_overlap_score>=12&&e.relation_confidence>=45).sort((a,b)=>b.product_overlap_score-a.product_overlap_score).slice(0,35);

    const resolved=await Promise.all(shortlisted.map(async e=>({...e,official_website:await resolveOfficialWebsite(e.name,e.related_product,e.official_website,ownDomain)})));
    const candidateRows:any[]=[]; const candidateUpdates:Promise<any>[]=[]; const competitorRows:any[]=[];

    for(const entity of resolved){
      const officialDomain=domainOf(entity.official_website); const sourceDomain=domainOf(entity.source_url);
      const candidateDomain=officialDomain||`source:${sourceDomain}:${entity.name.toLowerCase().replace(/[^a-z0-9]+/g,"-").slice(0,40)}`;
      const provisional=Math.max(scoreCandidate(`${entity.name} ${entity.related_product} ${entity.relationship_reason}`,workspace),Math.round(entity.product_overlap_score*.75));
      const status=officialDomain&&entity.product_overlap_score>=20&&entity.relation_confidence>=60?"promoted":"candidate";
      const existingCandidate:any=candidateMap.get(candidateDomain);
      const candidatePatch={title:entity.name,url:entity.official_website||entity.source_url,domain:candidateDomain,description:entity.relationship_reason,provisional_score:provisional,status,entity_type:"company",related_product:entity.related_product||null,relationship_reason:entity.relationship_reason||null,relation_confidence:entity.relation_confidence,source_page_url:entity.source_url,official_website:entity.official_website||null,product_overlap_score:entity.product_overlap_score,updated_at:new Date().toISOString()};
      if(!existingCandidate){candidateRows.push({workspace_id:workspace.id,source_query:entity.source_query,...candidatePatch});candidateMap.set(candidateDomain,candidatePatch)}
      else candidateUpdates.push(sbUpdate("radar_candidates",`id=eq.${existingCandidate.id}`,candidatePatch));

      if(officialDomain&&officialDomain!==ownDomain&&!sourceLike(officialDomain)&&entity.product_overlap_score>=20&&entity.relation_confidence>=60&&!existingDomains.has(officialDomain)&&!existingNames.has(entity.name.toLowerCase())){
        const similarity=Math.max(provisional,Math.round(entity.product_overlap_score*.82));
        const threat=Math.min(100,Math.round(similarity*.72+entity.product_overlap_score*.28));
        competitorRows.push({workspace_id:workspace.id,name:entity.name,website:originOf(entity.official_website),description:entity.related_product||entity.relationship_reason,category:categoryFor(similarity),similarity_score:similarity,threat_score:threat,momentum_score:35,movement:"stable",monitoring_preference:"neutral",related_product:entity.related_product||null,relationship_reason:entity.relationship_reason||null,relation_confidence:entity.relation_confidence,product_overlap_score:entity.product_overlap_score,discovery_source_url:entity.source_url,why_it_matters:`${entity.related_product?`${entity.name} makes ${entity.related_product}. `:""}${entity.relationship_reason} Product overlap ${entity.product_overlap_score}%; discovery confidence ${entity.relation_confidence}%. Deep scan will verify strategic similarity.`});
        existingDomains.add(officialDomain);existingNames.add(entity.name.toLowerCase());
      }
    }

    const [insertedCandidates,insertedCompetitors]=await Promise.all([
      candidateRows.length?sbInsert("radar_candidates",candidateRows):Promise.resolve([]),
      competitorRows.length?sbInsert("radar_competitors",competitorRows):Promise.resolve([]),
      ...candidateUpdates,
    ]).then((values:any[])=>[values[0]||[],values[1]||[]]);

    await sbUpdate("radar_scan_runs",`id=eq.${run.id}`,{status:"completed",pages_scanned:inspected,findings:insertedCompetitors.length,finished_at:new Date().toISOString()});
    return NextResponse.json({ok:true,queries_generated:queries.length,inspected,entities_extracted:shortlisted.length,candidates_found:insertedCandidates.length,promoted:insertedCompetitors.length,competitors:insertedCompetitors,candidates:insertedCandidates.sort((a:any,b:any)=>Number(b.product_overlap_score||0)-Number(a.product_overlap_score||0)).slice(0,75)});
  }catch(error){
    if(run?.id)try{await sbUpdate("radar_scan_runs",`id=eq.${run.id}`,{status:"failed",error:error instanceof Error?error.message:"Discovery failed",finished_at:new Date().toISOString()})}catch{}
    if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});
    return NextResponse.json({error:error instanceof Error?error.message:"Discovery failed"},{status:500});
  }
}
