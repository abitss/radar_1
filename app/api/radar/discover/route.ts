import { NextResponse } from "next/server";
import { sbInsert, sbSelect, sbUpdate } from "@/lib/radar-db";
import { firecrawlConfigured, searchWebFast } from "@/lib/firecrawl";
import { engineSearchConfigured, engineSearchWeb } from "@/lib/radar-engine-search";
import { analyzeDiscoveryResults, radarAIConfigured } from "@/lib/radar-ai";
import { ensureCompanyBrainExpansion } from "@/lib/radar-brain-expansion";
import { companyBrainReadiness } from "@/lib/radar-profile";
import { workspaceForRequest } from "@/lib/radar-workspace";

function terms(value:unknown):string[]{
  const rows=Array.isArray(value)?value.map(String):String(value||"").split(/[,;|\n]/);
  return rows.flatMap(x=>String(x).split(/[,;|]/)).map(x=>x.trim()).filter(x=>x.length>2);
}
function tokens(value:unknown){return [...new Set(terms(value).flatMap(x=>x.toLowerCase().split(/[^a-z0-9]+/)).filter(x=>x.length>=4))]}
function domainOf(raw:string){try{return new URL(raw).hostname.replace(/^www\./,"").toLowerCase()}catch{return""}}
function originOf(raw:string){try{return new URL(raw).origin}catch{return raw}}
function cleanCompanyName(value:string){return String(value||"").replace(/\s+/g," ").trim().replace(/[|–—-].*$/,"").trim().slice(0,100)}
function validCompanyName(value:string){const name=cleanCompanyName(value);return name.length>=3&&/[a-z]{2,}/i.test(name)&&!/^https?:/i.test(name)}
function scoreGroup(text:string,values:unknown,weight:number){
  const phrases=terms(values).map(x=>x.toLowerCase());const toks=tokens(values);
  if(!phrases.length&&!toks.length)return 0;
  const phraseRatio=phrases.length?phrases.filter(x=>text.includes(x)).length/phrases.length:0;
  const tokenRatio=toks.length?toks.filter(x=>text.includes(x)).length/toks.length:0;
  return Math.max(phraseRatio,Math.min(1,tokenRatio*1.35))*weight;
}
function scoreCandidate(text:string,workspace:any,expansion:any){
  const lower=text.toLowerCase();let score=0;
  score+=scoreGroup(lower,workspace.product_keywords,22);
  score+=scoreGroup(lower,workspace.major_features,12);
  score+=scoreGroup(lower,workspace.capability_keywords,15);
  score+=scoreGroup(lower,workspace.technology_keywords,6);
  score+=scoreGroup(lower,workspace.target_customers,10);
  score+=scoreGroup(lower,workspace.buyer,5);
  score+=scoreGroup(lower,workspace.problem_statement,10);
  score+=scoreGroup(lower,`${workspace.industry||""},${workspace.sub_category||""}`,5);
  score+=scoreGroup(lower,workspace.business_model,2);
  score+=scoreGroup(lower,expansion?.adjacent_categories,4);
  score+=scoreGroup(lower,expansion?.substitute_workflows,3);
  score+=scoreGroup(lower,expansion?.customer_synonyms,2);
  score+=scoreGroup(lower,expansion?.alternative_terminology,3);
  score+=scoreGroup(lower,expansion?.hidden_competitor_angles,1);
  return Math.min(100,Math.round(score));
}
function categoryFor(score:number){if(score>=75)return"direct";if(score>=50)return"adjacent";if(score>=28)return"substitute";return"emerging"}
function sleep(ms:number){return new Promise(resolve=>setTimeout(resolve,ms))}

function baseQueries(workspace:any){
  const product=terms(workspace.product_keywords).slice(0,6);
  const features=terms(workspace.major_features).slice(0,5);
  const caps=terms(workspace.capability_keywords).slice(0,7);
  const tech=terms(workspace.technology_keywords).slice(0,4);
  const customer=[...terms(workspace.target_customers),...terms(workspace.buyer)].slice(0,5);
  const problem=terms(workspace.problem_statement).slice(0,6);
  const industry=terms(`${workspace.industry||""},${workspace.sub_category||""}`).slice(0,4);
  const q=new Set<string>();
  if(product.length){q.add(`${product.slice(0,3).join(" ")} startup`);q.add(`${product.slice(0,2).join(" ")} competitors alternatives`);q.add(`${product.slice(0,2).join(" ")} product company`)}
  if(industry.length)q.add(`${industry.slice(0,2).join(" ")} startups companies`);
  if(product.length&&customer.length)q.add(`${product.slice(0,2).join(" ")} for ${customer.slice(0,2).join(" ")} company`);
  if(problem.length){q.add(`startup solving ${problem.slice(0,4).join(" ")}`);q.add(`${problem.slice(0,3).join(" ")} alternative solution company`)}
  for(const cap of [...features,...caps].slice(0,4))q.add(`"${cap}" startup product`);
  for(const t of tech.slice(0,2))q.add(`${t} ${product[0]||industry[0]||caps[0]||"startup"} product company`);
  if(workspace.geography&&product.length)q.add(`${product.slice(0,2).join(" ")} startup ${workspace.geography}`);
  return [...q].filter(Boolean).slice(0,12);
}

const sourceDomains=["wikipedia.org","ycombinator.com","crunchbase.com","tracxn.com","wellfound.com","linkedin.com","youtube.com","reddit.com","news.mit.edu","mit.edu","caltech.edu","techcrunch.com","forbes.com","reuters.com","bloomberg.com","medium.com","cbinsights.com","g2.com","capterra.com","producthunt.com","ncbi.nlm.nih.gov","pmc.ncbi.nlm.nih.gov","dl.acm.org","aws.amazon.com","oracle.com","edtechimpact.com"];
function sourceLike(domain:string){return sourceDomains.some(x=>domain===x||domain.endsWith(`.${x}`))}
function articleLike(result:any){const d=domainOf(result.url);const text=`${result.title||""} ${result.description||""}`.toLowerCase();return sourceLike(d)||/(top\s+\d+|best\s+.*companies|startups funded|news|review|list of|companies to watch|researchers|study|report|journal|paper|guide|introduction to|trends)/i.test(text)}

async function searchAll(query:string,limit=8){
  const tasks:Promise<any[]>[]=[];
  if(firecrawlConfigured())tasks.push(searchWebFast(query,limit).then(rows=>rows.map((r:any)=>({...r,provider:"firecrawl"}))));
  if(engineSearchConfigured())tasks.push(engineSearchWeb(query,limit).then(rows=>rows.map((r:any)=>({title:r.title,description:r.description,url:r.url,provider:r.provider}))));
  const settled=await Promise.allSettled(tasks);const map=new Map<string,any>();
  for(const item of settled)if(item.status==="fulfilled")for(const row of item.value)if(row?.url&&!map.has(row.url))map.set(row.url,row);
  return [...map.values()].slice(0,Math.max(limit,12));
}

async function resolveOfficialWebsite(name:string,relatedProduct:string,supplied:string,ownDomain:string){
  const suppliedDomain=domainOf(supplied||"");
  if(suppliedDomain&&!sourceLike(suppliedDomain)&&suppliedDomain!==ownDomain)return originOf(supplied);
  try{
    const results=await searchAll(`"${name}" ${relatedProduct||"product"} official`,4);
    const nameTokens=name.toLowerCase().split(/[^a-z0-9]+/).filter(x=>x.length>2);
    const hit=results.find((r:any)=>{const d=domainOf(r.url);if(!d||sourceLike(d)||d===ownDomain)return false;const hay=`${r.title||""} ${r.description||""} ${d}`.toLowerCase();return nameTokens.some(t=>hay.includes(t))});
    return hit?originOf(hit.url):"";
  }catch{return""}
}

export async function GET(req:Request){
  try{
    const {workspace}=await workspaceForRequest(req,true);
    const candidates=await sbSelect(`radar_candidates?workspace_id=eq.${workspace.id}&select=*&order=product_overlap_score.desc,provisional_score.desc&limit=150`);
    const expansionRows=await sbSelect(`radar_discovery_queries?workspace_id=eq.${workspace.id}&query_type=like.ai_brain_%25&select=query,query_type,enabled&limit=250`).catch(()=>[]);
    return NextResponse.json({configured:firecrawlConfigured()||engineSearchConfigured(),firecrawl:firecrawlConfigured(),live_search:engineSearchConfigured(),ai:radarAIConfigured(),company_brain:companyBrainReadiness(workspace),ai_expansion_items:expansionRows.length,candidates});
  }catch(error){if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});return NextResponse.json({error:error instanceof Error?error.message:"Could not load discovery"},{status:500})}
}

export async function POST(req:Request){
  let run:any=null;
  try{
    const {workspace}=await workspaceForRequest(req,true);
    const readiness=companyBrainReadiness(workspace);
    if(!readiness.ready)return NextResponse.json({error:`Complete the Company Brain first. Missing: ${readiness.missing.join(", ")}.`,company_brain:readiness},{status:400});
    if(!firecrawlConfigured()&&!engineSearchConfigured())return NextResponse.json({error:"No public-web search provider is configured."},{status:503});
    const body=await req.json().catch(()=>({}));

    const activeCutoff=new Date(Date.now()-10*60*1000).toISOString();
    const active=await sbSelect(`radar_scan_runs?workspace_id=eq.${workspace.id}&run_type=eq.market_discovery&status=eq.running&started_at=gte.${encodeURIComponent(activeCutoff)}&select=id,started_at&order=started_at.asc&limit=1`);
    if(active[0])return NextResponse.json({error:"Market discovery is already running for this workspace.",cooldown:true,running:true,run_id:active[0].id},{status:429});

    const recent=await sbSelect(`radar_scan_runs?workspace_id=eq.${workspace.id}&run_type=eq.market_discovery&status=eq.completed&select=finished_at&order=finished_at.desc&limit=1`);
    if(recent[0]?.finished_at&&Date.now()-new Date(recent[0].finished_at).getTime()<90*1000)return NextResponse.json({error:"Market discovery was just run. Showing the latest results.",cooldown:true},{status:429});

    run=(await sbInsert("radar_scan_runs",{workspace_id:workspace.id,run_type:"market_discovery",status:"running"}))[0];
    await sleep(180);
    const contenders=await sbSelect(`radar_scan_runs?workspace_id=eq.${workspace.id}&run_type=eq.market_discovery&status=eq.running&started_at=gte.${encodeURIComponent(activeCutoff)}&select=id,started_at&order=started_at.asc&limit=3`);
    if(contenders[0]?.id&&contenders[0].id!==run?.id){
      await sbUpdate("radar_scan_runs",`id=eq.${run.id}`,{status:"completed",pages_scanned:0,findings:0,finished_at:new Date().toISOString()}).catch(()=>{});
      return NextResponse.json({error:"A discovery run already won the workspace lock.",cooldown:true,running:true,run_id:contenders[0].id},{status:429});
    }

    let expansion:any=null;
    try{expansion=await ensureCompanyBrainExpansion(workspace,{force:Boolean(body?.refreshBrainExpansion)});}catch(error){expansion={search_queries:[],error:error instanceof Error?error.message:"AI Company Brain expansion failed"}}
    const queries=[...new Set([...baseQueries(workspace),...(expansion?.search_queries||[])])].filter(Boolean).slice(0,28);
    if(!queries.length)throw new Error("RADAR could not build discovery queries from the current Company Brain.");

    const [existingQueries,existingCompetitors,existingCandidates]=await Promise.all([
      sbSelect(`radar_discovery_queries?workspace_id=eq.${workspace.id}&select=query`),
      sbSelect(`radar_competitors?workspace_id=eq.${workspace.id}&select=id,name,website`),
      sbSelect(`radar_candidates?workspace_id=eq.${workspace.id}&select=id,domain,status,provisional_score,product_overlap_score,official_website`),
    ]);
    const querySet=new Set(existingQueries.map((r:any)=>r.query));
    const generated=baseQueries(workspace).filter(q=>!querySet.has(q)).map(query=>({workspace_id:workspace.id,query,query_type:"company_brain",enabled:true}));
    if(generated.length)await sbInsert("radar_discovery_queries",generated);

    const ownDomain=domainOf(workspace.website||"");
    const existingDomains=new Set(existingCompetitors.map((x:any)=>domainOf(x.website||"")).filter(Boolean));
    const existingNames=new Set(existingCompetitors.map((x:any)=>String(x.name||"").toLowerCase()));
    const candidateMap=new Map(existingCandidates.map((x:any)=>[x.domain,x]));

    const searches=await Promise.allSettled(queries.map(query=>searchAll(query,8).then(results=>({query,results}))));
    let inspected=0;const raw:any[]=[];
    for(const set of searches){if(set.status!=="fulfilled")continue;inspected+=set.value.results.length;for(const r of set.value.results)raw.push({...r,source_query:set.value.query})}
    const deduped=[...new Map(raw.filter(r=>domainOf(r.url)&&(!ownDomain||domainOf(r.url)!==ownDomain)).map(r=>[r.url,r])).values()].slice(0,140) as any[];

    if(!deduped.length){
      if(existingCandidates.length||existingCompetitors.length){
        await sbUpdate("radar_scan_runs",`id=eq.${run.id}`,{status:"completed",pages_scanned:0,findings:0,finished_at:new Date().toISOString()});
        return NextResponse.json({ok:true,degraded:true,error:"Search providers returned no new public-web results; existing intelligence was preserved.",search:{firecrawl:firecrawlConfigured(),live_search:engineSearchConfigured()},queries_generated:queries.length,inspected:0,candidates_found:0,promoted:0,existing_candidates:existingCandidates.length,existing_competitors:existingCompetitors.length});
      }
      throw new Error("Configured search providers returned no public-web results for the current Company Brain.");
    }

    let analyzed:any[]=[];
    if(radarAIConfigured())for(let i=0;i<deduped.length;i+=20){try{const batch=await analyzeDiscoveryResults(workspace,deduped.slice(i,i+20));if(batch)analyzed.push(...batch)}catch{}}
    const analysisByUrl=new Map(analyzed.map((x:any)=>[x.source_url,x]));const entities:any[]=[];
    for(const result of deduped){
      const sourceDomain=domainOf(result.url);const analysis:any=analysisByUrl.get(result.url);
      if(analysis?.companies?.length){
        for(const c of analysis.companies){const name=cleanCompanyName(c.name);if(!validCompanyName(name))continue;entities.push({name,official_website:c.official_website||"",related_product:c.related_product||"",relationship_reason:c.relationship_reason||result.description||"",relation_confidence:Number(c.relation_confidence||0),product_overlap_score:Number(c.product_overlap_score||0),source_url:result.url,source_query:result.source_query,source_type:analysis.source_type||"other"})}
      }else if(!articleLike(result)){
        const provisional=scoreCandidate(`${result.title||""} ${result.description||""}`,workspace,expansion);const name=cleanCompanyName(result.title||sourceDomain);
        if(provisional>=10&&validCompanyName(name))entities.push({name,official_website:originOf(result.url),related_product:String(result.description||"").slice(0,250),relationship_reason:`Official-looking company result matched RADAR search hypothesis: ${result.source_query}`,relation_confidence:60,product_overlap_score:provisional,source_url:result.url,source_query:result.source_query,source_type:"company"});
      }
    }

    const entityMap=new Map<string,any>();for(const e of entities){const key=e.name.toLowerCase();const old=entityMap.get(key);if(!old||e.product_overlap_score>old.product_overlap_score)entityMap.set(key,e)}
    const shortlisted=[...entityMap.values()].filter(e=>e.product_overlap_score>=12&&e.relation_confidence>=45).sort((a,b)=>b.product_overlap_score-a.product_overlap_score).slice(0,45);
    const resolved=await Promise.all(shortlisted.map(async e=>({...e,official_website:await resolveOfficialWebsite(e.name,e.related_product,e.official_website,ownDomain)})));
    const candidateRows:any[]=[];const candidateUpdates:Promise<any>[]=[];const competitorRows:any[]=[];

    for(const entity of resolved){
      const officialDomain=domainOf(entity.official_website);const sourceDomain=domainOf(entity.source_url);
      const candidateDomain=officialDomain||`source:${sourceDomain}:${entity.name.toLowerCase().replace(/[^a-z0-9]+/g,"-").slice(0,40)}`;
      const provisional=Math.max(scoreCandidate(`${entity.name} ${entity.related_product} ${entity.relationship_reason}`,workspace,expansion),Math.round(entity.product_overlap_score*.75));
      const status=officialDomain&&entity.product_overlap_score>=20&&entity.relation_confidence>=60?"promoted":"candidate";
      const existingCandidate:any=candidateMap.get(candidateDomain);
      const candidatePatch={title:entity.name,url:entity.official_website||entity.source_url,domain:candidateDomain,description:entity.relationship_reason,provisional_score:provisional,status,entity_type:"company",related_product:entity.related_product||null,relationship_reason:entity.relationship_reason||null,relation_confidence:entity.relation_confidence,source_page_url:entity.source_url,official_website:entity.official_website||null,product_overlap_score:entity.product_overlap_score,updated_at:new Date().toISOString()};
      if(!existingCandidate){
        const pending={workspace_id:workspace.id,source_query:entity.source_query,...candidatePatch};candidateRows.push(pending);candidateMap.set(candidateDomain,{__pending:pending});
      }else if(existingCandidate.id){candidateUpdates.push(sbUpdate("radar_candidates",`id=eq.${existingCandidate.id}`,candidatePatch));}
      else if(existingCandidate.__pending){Object.assign(existingCandidate.__pending,candidatePatch);}
      if(officialDomain&&(!ownDomain||officialDomain!==ownDomain)&&!sourceLike(officialDomain)&&entity.product_overlap_score>=20&&entity.relation_confidence>=60&&!existingDomains.has(officialDomain)&&!existingNames.has(entity.name.toLowerCase())){
        const similarity=Math.max(provisional,Math.round(entity.product_overlap_score*.82));const threat=Math.min(100,Math.round(similarity*.72+entity.product_overlap_score*.28));
        competitorRows.push({workspace_id:workspace.id,name:entity.name,website:originOf(entity.official_website),description:entity.related_product||entity.relationship_reason,category:categoryFor(similarity),similarity_score:similarity,threat_score:threat,momentum_score:35,movement:"stable",monitoring_preference:"auto",related_product:entity.related_product||null,relationship_reason:entity.relationship_reason||null,relation_confidence:entity.relation_confidence,product_overlap_score:entity.product_overlap_score,discovery_source_url:entity.source_url,why_it_matters:`${entity.related_product?`${entity.name} makes ${entity.related_product}. `:""}${entity.relationship_reason} Product overlap ${entity.product_overlap_score}%; discovery confidence ${entity.relation_confidence}%.`});
        existingDomains.add(officialDomain);existingNames.add(entity.name.toLowerCase());
      }
    }

    const insertedCandidates=candidateRows.length?await sbInsert("radar_candidates",candidateRows):[];
    const insertedCompetitors=competitorRows.length?await sbInsert("radar_competitors",competitorRows):[];
    await Promise.allSettled(candidateUpdates);
    await sbUpdate("radar_scan_runs",`id=eq.${run.id}`,{status:"completed",pages_scanned:inspected,findings:insertedCompetitors.length,error:null,finished_at:new Date().toISOString()});
    return NextResponse.json({ok:true,search:{firecrawl:firecrawlConfigured(),live_search:engineSearchConfigured()},company_brain_expansion:{used:Boolean(expansion?.search_queries?.length),cached:Boolean(expansion?.cached),provider:expansion?.provider||null,model:expansion?.model||null,queries:Number(expansion?.search_queries?.length||0),error:expansion?.error||null},queries_generated:queries.length,inspected,entities_extracted:shortlisted.length,candidates_found:insertedCandidates.length,promoted:insertedCompetitors.length,competitors:insertedCompetitors,candidates:insertedCandidates.sort((a:any,b:any)=>Number(b.product_overlap_score||0)-Number(a.product_overlap_score||0)).slice(0,75)});
  }catch(error){
    if(run?.id)try{await sbUpdate("radar_scan_runs",`id=eq.${run.id}`,{status:"failed",error:error instanceof Error?error.message:"Discovery failed",finished_at:new Date().toISOString()})}catch{}
    if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});
    return NextResponse.json({error:error instanceof Error?error.message:"Discovery failed"},{status:500});
  }
}
