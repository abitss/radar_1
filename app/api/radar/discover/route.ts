import { NextResponse } from "next/server";
import { sbInsert, sbSelect, sbUpdate } from "@/lib/radar-db";
import { firecrawlConfigured, searchWebFast } from "@/lib/firecrawl";
import { engineSearchConfigured } from "@/lib/radar-engine-search";
import { analyzeDiscoveryResults, radarAIConfigured } from "@/lib/radar-ai";
import { ensureCompanyBrainExpansion } from "@/lib/radar-brain-expansion";
import { companyBrainReadiness } from "@/lib/radar-profile";
import { workspaceForRequest } from "@/lib/radar-workspace";
import {
  cleanDiscoveryQuery,
  cleanRadarCompanyName,
  conciseDiscoveryTerms,
  isOfficialCompanyWebsite,
  looksLikeSourceUrl,
  radarDomain,
  radarOrigin,
  splitDiscoveryTerms,
  validRadarCompanyName,
} from "@/lib/radar-discovery-quality";

function tokens(value:unknown){
  return [...new Set(splitDiscoveryTerms(value).flatMap(x=>x.toLowerCase().split(/[^a-z0-9]+/)).filter(x=>x.length>=4))];
}
function scoreGroup(text:string,values:unknown,weight:number){
  const phrases=conciseDiscoveryTerms(values,40).map(x=>x.toLowerCase());
  const toks=tokens(values);
  if(!phrases.length&&!toks.length)return 0;
  const phraseRatio=phrases.length?phrases.filter(x=>text.includes(x)).length/phrases.length:0;
  const tokenRatio=toks.length?toks.filter(x=>text.includes(x)).length/toks.length:0;
  return Math.max(phraseRatio,Math.min(1,tokenRatio*1.35))*weight;
}
function scoreCandidate(text:string,workspace:any,expansion:any){
  const lower=text.toLowerCase();
  let score=0;
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
function safeOrigin(raw:string){try{return new URL(raw).origin}catch{return""}}
function sourceKey(raw:string){
  try{
    const u=new URL(raw);
    const normalized=`${u.origin}${u.pathname}`.replace(/\/$/,"").toLowerCase();
    return `source:${normalized}`.slice(0,500);
  }catch{return `source:${String(raw||"").slice(0,480)}`}
}

function baseQueries(workspace:any){
  const own=String(workspace.name||"").toLowerCase();
  const product=conciseDiscoveryTerms(workspace.product_keywords,8).filter(x=>!own||!x.toLowerCase().includes(own)).slice(0,5);
  const features=conciseDiscoveryTerms(workspace.major_features,8).slice(0,5);
  const caps=conciseDiscoveryTerms(workspace.capability_keywords,10).slice(0,6);
  const industry=conciseDiscoveryTerms(`${workspace.industry||""},${workspace.sub_category||""}`,8).slice(0,4);
  const geography=conciseDiscoveryTerms(workspace.geography,4).slice(0,1);
  const q=new Set<string>();
  if(product[0]){q.add(`${product[0]} competitors`);q.add(`${product[0]} alternatives`);q.add(`${product[0]} startup company`)}
  if(product[0]&&product[1])q.add(`${product[0]} ${product[1]} company`);
  if(industry[0])q.add(`${industry.slice(0,2).join(" ")} startups companies`);
  for(const cap of [...features,...caps].slice(0,4))q.add(`"${cap}" company product`);
  if(product[0]&&geography[0])q.add(`${product[0]} company ${geography[0]}`);
  return [...q].map(x=>cleanDiscoveryQuery(x)).filter(Boolean).slice(0,8);
}

// searchWebFast already combines Firecrawl and the configured engine-search provider.
// Calling engineSearchWeb again here previously doubled provider traffic and contributed to rate-limit storms.
async function searchAll(query:string,limit=6){
  const rows=await searchWebFast(query,limit);
  return rows.map((r:any)=>({...r,provider:r.provider||"firecrawl"}));
}

async function searchQueries(queries:string[]){
  const raw:any[]=[];
  let inspected=0,succeeded=0,failed=0;
  for(let i=0;i<queries.length;i+=4){
    const batch=queries.slice(i,i+4);
    const settled=await Promise.allSettled(batch.map(query=>searchAll(query,6).then(results=>({query,results}))));
    for(const item of settled){
      if(item.status!=="fulfilled"){failed++;continue}
      succeeded++;
      inspected+=item.value.results.length;
      for(const row of item.value.results)raw.push({...row,source_query:item.value.query});
    }
    if(i+4<queries.length)await sleep(180);
  }
  return{raw,inspected,succeeded,failed};
}

async function resolveOfficialWebsite(name:string,relatedProduct:string,supplied:string,ownDomain:string,sourceUrl:string,sourceType:string){
  if(isOfficialCompanyWebsite(supplied,sourceUrl,sourceType)&&radarDomain(supplied)!==ownDomain)return radarOrigin(supplied);
  try{
    const productHint=conciseDiscoveryTerms(relatedProduct,2)[0]||"product";
    const q=cleanDiscoveryQuery(`"${name}" ${productHint} official`)||`"${name}" official`;
    const results=await searchAll(q,4);
    const nameTokens=name.toLowerCase().split(/[^a-z0-9]+/).filter(x=>x.length>2);
    const hit=results.find((r:any)=>{
      const d=radarDomain(r.url);
      if(!d||d===ownDomain||looksLikeSourceUrl(r.url,r.title,r.description))return false;
      const hay=`${r.title||""} ${r.description||""} ${d}`.toLowerCase();
      return nameTokens.some(t=>hay.includes(t));
    });
    return hit?radarOrigin(hit.url):"";
  }catch{return""}
}

async function resolveMissingWebsites(entities:any[],ownDomain:string){
  const resolved=entities.map(x=>({...x}));
  const indexes=resolved.map((e,i)=>({e,i})).filter(x=>!isOfficialCompanyWebsite(x.e.official_website,x.e.source_url,x.e.source_type)).slice(0,18);
  for(let i=0;i<indexes.length;i+=3){
    const batch=indexes.slice(i,i+3);
    const results=await Promise.all(batch.map(async ({e,i:index})=>({index,website:await resolveOfficialWebsite(e.name,e.related_product,e.official_website,ownDomain,e.source_url,e.source_type)})));
    for(const r of results)if(r.website)resolved[r.index].official_website=r.website;
    if(i+3<indexes.length)await sleep(180);
  }
  return resolved;
}

export async function GET(req:Request){
  try{
    const {workspace}=await workspaceForRequest(req,true);
    const [candidateRows,expansionRows,recentRuns,monitors,competitors]=await Promise.all([
      sbSelect(`radar_candidates?workspace_id=eq.${workspace.id}&select=*&order=product_overlap_score.desc,provisional_score.desc&limit=250`),
      sbSelect(`radar_discovery_queries?workspace_id=eq.${workspace.id}&query_type=like.ai_brain_%25&enabled=eq.true&select=query,query_type&limit=250`).catch(()=>[]),
      sbSelect(`radar_scan_runs?workspace_id=eq.${workspace.id}&run_type=eq.market_discovery&select=id,status,pages_scanned,findings,error,started_at,finished_at&order=started_at.desc&limit=8`).catch(()=>[]),
      sbSelect(`radar_monitors?workspace_id=eq.${workspace.id}&status=eq.active&select=id,competitor_id,monitor_type&limit=200`).catch(()=>[]),
      sbSelect(`radar_competitors?workspace_id=eq.${workspace.id}&select=id,name,website,last_scanned_at,monitoring_preference,similarity_score,threat_score&limit=250`).catch(()=>[]),
    ]);
    const monitorIds=new Set(monitors.map((m:any)=>String(m.competitor_id||"")).filter(Boolean));
    const byDomain=new Map<string,any>();
    const byName=new Map<string,any>();
    for(const c of competitors){const d=radarDomain(c.website||"");if(d)byDomain.set(d,c);byName.set(String(c.name||"").toLowerCase(),c)}
    const candidates=candidateRows.map((candidate:any)=>{
      if(candidate.entity_type==="source")return candidate;
      const d=radarDomain(candidate.official_website||candidate.url||"");
      const competitor=(d&&byDomain.get(d))||byName.get(String(candidate.title||"").toLowerCase())||null;
      return{
        ...candidate,
        competitor_id:competitor?.id||null,
        verified:Boolean(competitor?.last_scanned_at),
        last_scanned_at:competitor?.last_scanned_at||null,
        watch_active:Boolean(competitor?.id&&monitorIds.has(String(competitor.id))),
        competitor_similarity:competitor?.similarity_score??null,
        competitor_threat:competitor?.threat_score??null,
      };
    });
    const running=recentRuns.find((r:any)=>r.status==="running")||null;
    return NextResponse.json({
      configured:firecrawlConfigured()||engineSearchConfigured(),
      firecrawl:firecrawlConfigured(),
      live_search:engineSearchConfigured(),
      ai:radarAIConfigured(),
      company_brain:companyBrainReadiness(workspace),
      ai_expansion_items:expansionRows.length,
      candidates,
      last_run:recentRuns[0]||null,
      recent_runs:recentRuns,
      running_discovery:Boolean(running),
      running_run_id:running?.id||null,
      active_entity_monitors:monitors.filter((m:any)=>Boolean(m.competitor_id)).length,
      promoted_competitors:competitors.length,
    });
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});
    return NextResponse.json({error:error instanceof Error?error.message:"Could not load discovery"},{status:500});
  }
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
    if(recent[0]?.finished_at&&Date.now()-new Date(recent[0].finished_at).getTime()<90*1000&&!body?.force)return NextResponse.json({error:"Market discovery was just run. Showing the latest results.",cooldown:true},{status:429});

    run=(await sbInsert("radar_scan_runs",{workspace_id:workspace.id,run_type:"market_discovery",status:"running"}))[0];
    await sleep(150);
    const contenders=await sbSelect(`radar_scan_runs?workspace_id=eq.${workspace.id}&run_type=eq.market_discovery&status=eq.running&started_at=gte.${encodeURIComponent(activeCutoff)}&select=id,started_at&order=started_at.asc&limit=3`);
    if(contenders[0]?.id&&contenders[0].id!==run?.id){
      await sbUpdate("radar_scan_runs",`id=eq.${run.id}`,{status:"completed",pages_scanned:0,findings:0,finished_at:new Date().toISOString()}).catch(()=>{});
      return NextResponse.json({error:"A discovery run already won the workspace lock.",cooldown:true,running:true,run_id:contenders[0].id},{status:429});
    }

    let expansion:any=null;
    try{expansion=await ensureCompanyBrainExpansion(workspace,{force:Boolean(body?.refreshBrainExpansion)})}
    catch(error){expansion={search_queries:[],error:error instanceof Error?error.message:"AI Company Brain expansion failed"}}

    const aiQueries=(Array.isArray(expansion?.search_queries)?expansion.search_queries:[]).map((q:any)=>cleanDiscoveryQuery(String(q))).filter(Boolean).slice(0,6);
    const manualQueries=baseQueries(workspace).slice(0,8);
    const queries=[...new Set([...manualQueries,...aiQueries])].slice(0,12);
    if(!queries.length)throw new Error("RADAR could not build clean discovery queries from the current Company Brain.");

    const [existingQueries,existingCompetitors,existingCandidates]=await Promise.all([
      sbSelect(`radar_discovery_queries?workspace_id=eq.${workspace.id}&select=query`),
      sbSelect(`radar_competitors?workspace_id=eq.${workspace.id}&select=id,name,website`),
      sbSelect(`radar_candidates?workspace_id=eq.${workspace.id}&select=id,domain,status,entity_type,title,url,provisional_score,product_overlap_score,official_website`),
    ]);
    const querySet=new Set(existingQueries.map((r:any)=>r.query));
    const generated=manualQueries.filter(q=>!querySet.has(q)).map(query=>({workspace_id:workspace.id,query,query_type:"company_brain",enabled:true}));
    if(generated.length)await sbInsert("radar_discovery_queries",generated);

    const ownDomain=radarDomain(workspace.website||"");
    const existingDomains=new Set(existingCompetitors.map((x:any)=>radarDomain(x.website||"")).filter(Boolean));
    const existingNames=new Set(existingCompetitors.map((x:any)=>String(x.name||"").toLowerCase()));
    const candidateMap=new Map(existingCandidates.map((x:any)=>[String(x.domain),x]));
    const candidateByOfficial=new Map(existingCandidates.map((x:any)=>[radarDomain(x.official_website||x.url||""),x]).filter(([d]:any)=>Boolean(d)) as any);

    const searchResult=await searchQueries(queries);
    const deduped=[...new Map(searchResult.raw.filter((r:any)=>radarDomain(r.url)&&(!ownDomain||radarDomain(r.url)!==ownDomain)).map((r:any)=>[String(r.url).split("#")[0],r])).values()].slice(0,100) as any[];
    if(!deduped.length){
      if(existingCandidates.length||existingCompetitors.length){
        await sbUpdate("radar_scan_runs",`id=eq.${run.id}`,{status:"completed",pages_scanned:0,findings:0,error:"No new public-web results were returned; existing intelligence was preserved.",finished_at:new Date().toISOString()});
        return NextResponse.json({ok:true,degraded:true,error:"Search providers returned no new public-web results; existing intelligence was preserved.",search:{firecrawl:firecrawlConfigured(),live_search:engineSearchConfigured()},queries_generated:queries.length,searches_succeeded:searchResult.succeeded,searches_failed:searchResult.failed,inspected:0,candidates_found:0,source_leads_found:0,promoted:0,existing_candidates:existingCandidates.length,existing_competitors:existingCompetitors.length});
      }
      throw new Error("Configured search providers returned no public-web results for the current Company Brain.");
    }

    // Persist source-like results separately. These rows are evidence leads only and can never be promoted.
    const sourceRows:any[]=[];
    const sourceUpdates:Promise<any>[]=[];
    for(const result of deduped.filter(r=>looksLikeSourceUrl(r.url,r.title,r.description)).slice(0,30)){
      const key=sourceKey(result.url);
      const provisional=scoreCandidate(`${result.title||""} ${result.description||""}`,workspace,expansion);
      if(provisional<5)continue;
      const patch={
        title:String(result.title||radarDomain(result.url)).slice(0,240),
        url:String(result.url),
        domain:key,
        description:String(result.description||"Evidence source relevant to this market search.").slice(0,1200),
        provisional_score:provisional,
        status:"candidate",
        entity_type:"source",
        related_product:null,
        relationship_reason:`Evidence source discovered through: ${result.source_query}`.slice(0,1200),
        relation_confidence:0,
        source_page_url:String(result.url),
        official_website:null,
        product_overlap_score:provisional,
        updated_at:new Date().toISOString(),
      };
      const existing:any=candidateMap.get(key);
      if(existing?.id){
        const keepStatus=["ignored","rejected"].includes(existing.status)?existing.status:"candidate";
        sourceUpdates.push(sbUpdate("radar_candidates",`id=eq.${existing.id}`,{...patch,status:keepStatus}));
      }else{
        const row={workspace_id:workspace.id,source_query:result.source_query,...patch};
        sourceRows.push(row);candidateMap.set(key,row);
      }
    }

    let analyzed:any[]=[];
    if(radarAIConfigured()){
      for(let i=0;i<deduped.length;i+=18){
        try{const batch=await analyzeDiscoveryResults(workspace,deduped.slice(i,i+18));if(batch)analyzed.push(...batch)}catch{}
      }
    }

    const analysisByUrl=new Map(analyzed.map((x:any)=>[x.source_url,x]));
    const entities:any[]=[];
    for(const result of deduped){
      const analysis:any=analysisByUrl.get(result.url);
      if(analysis?.companies?.length){
        for(const c of analysis.companies){
          const name=cleanRadarCompanyName(c.name);
          if(!validRadarCompanyName(name))continue;
          entities.push({
            name,
            official_website:c.official_website||"",
            related_product:c.related_product||"",
            relationship_reason:c.relationship_reason||result.description||"",
            relation_confidence:Number(c.relation_confidence||0),
            product_overlap_score:Number(c.product_overlap_score||0),
            source_url:result.url,
            source_query:result.source_query,
            source_type:analysis.source_type||"other",
          });
        }
      }else if(!looksLikeSourceUrl(result.url,result.title,result.description)){
        const provisional=scoreCandidate(`${result.title||""} ${result.description||""}`,workspace,expansion);
        const name=cleanRadarCompanyName(result.title||radarDomain(result.url));
        if(provisional>=14&&validRadarCompanyName(name))entities.push({
          name,
          official_website:radarOrigin(result.url),
          related_product:String(result.description||"").slice(0,250),
          relationship_reason:`Company-domain result matched a RADAR search angle: ${result.source_query}`,
          relation_confidence:55,
          product_overlap_score:provisional,
          source_url:result.url,
          source_query:result.source_query,
          source_type:"company",
        });
      }
    }

    const entityMap=new Map<string,any>();
    for(const e of entities){
      const key=e.name.toLowerCase();
      const old=entityMap.get(key);
      if(!old||e.product_overlap_score>old.product_overlap_score)entityMap.set(key,e);
    }
    const shortlisted=[...entityMap.values()].filter(e=>e.product_overlap_score>=14&&e.relation_confidence>=50).sort((a,b)=>b.product_overlap_score-a.product_overlap_score).slice(0,30);
    const resolved=await resolveMissingWebsites(shortlisted,ownDomain);

    const candidateRows:any[]=[];
    const candidateUpdates:Promise<any>[]=[];
    const promotePlans:any[]=[];
    for(const entity of resolved){
      const officialDomain=radarDomain(entity.official_website);
      const sourceDomain=radarDomain(entity.source_url);
      const candidateDomain=officialDomain||`source:${sourceDomain}:${entity.name.toLowerCase().replace(/[^a-z0-9]+/g,"-").slice(0,60)}`;
      const provisional=Math.max(scoreCandidate(`${entity.name} ${entity.related_product} ${entity.relationship_reason}`,workspace,expansion),Math.round(entity.product_overlap_score*.75));
      const autoEligible=Boolean(officialDomain)&&isOfficialCompanyWebsite(entity.official_website,entity.source_url,entity.source_type)&&entity.product_overlap_score>=50&&entity.relation_confidence>=70;
      const existingCandidate:any=candidateMap.get(candidateDomain)||candidateByOfficial.get(officialDomain)||null;
      const protectedStatus=existingCandidate?.status&&["rejected","ignored","promoted"].includes(existingCandidate.status)?existingCandidate.status:"candidate";
      const candidatePatch={
        title:entity.name,
        url:entity.official_website||entity.source_url,
        description:entity.relationship_reason,
        provisional_score:provisional,
        status:protectedStatus,
        entity_type:"company",
        related_product:entity.related_product||null,
        relationship_reason:entity.relationship_reason||null,
        relation_confidence:Math.max(0,Math.min(100,Math.round(entity.relation_confidence))),
        source_page_url:entity.source_url,
        official_website:entity.official_website||null,
        product_overlap_score:Math.max(0,Math.min(100,Math.round(entity.product_overlap_score))),
        updated_at:new Date().toISOString(),
      };
      if(!existingCandidate){
        const pending={workspace_id:workspace.id,source_query:entity.source_query,domain:candidateDomain,...candidatePatch};
        candidateRows.push(pending);candidateMap.set(candidateDomain,pending);
      }else if(existingCandidate.id){
        candidateUpdates.push(sbUpdate("radar_candidates",`id=eq.${existingCandidate.id}`,candidatePatch));
      }
      const reviewBlocked=["rejected","ignored"].includes(String(existingCandidate?.status||""));
      if((autoEligible||existingCandidate?.status==="promoted")&&!reviewBlocked&&officialDomain&&officialDomain!==ownDomain){
        promotePlans.push({entity,officialDomain,candidateDomain,provisional,existingCandidate});
      }
    }

    const insertedSources=sourceRows.length?await sbInsert("radar_candidates",sourceRows):[];
    const insertedCandidates=candidateRows.length?await sbInsert("radar_candidates",candidateRows):[];
    await Promise.allSettled([...sourceUpdates,...candidateUpdates]);

    let promoted=0;
    const promotedCompetitors:any[]=[];
    for(const plan of promotePlans){
      let competitor=existingCompetitors.find((c:any)=>radarDomain(c.website||"")===plan.officialDomain||String(c.name||"").toLowerCase()===plan.entity.name.toLowerCase())||null;
      if(!competitor){
        const similarity=Math.max(plan.provisional,Math.round(plan.entity.product_overlap_score*.82));
        const threat=Math.min(100,Math.round(similarity*.72+plan.entity.product_overlap_score*.28));
        try{
          const created=await sbInsert("radar_competitors",{
            workspace_id:workspace.id,
            name:plan.entity.name,
            website:radarOrigin(plan.entity.official_website),
            description:plan.entity.related_product||plan.entity.relationship_reason,
            category:categoryFor(similarity),
            similarity_score:similarity,
            threat_score:threat,
            momentum_score:35,
            movement:"stable",
            monitoring_preference:"auto",
            related_product:plan.entity.related_product||null,
            relationship_reason:plan.entity.relationship_reason||null,
            relation_confidence:plan.entity.relation_confidence,
            product_overlap_score:plan.entity.product_overlap_score,
            discovery_source_url:plan.entity.source_url,
            why_it_matters:`${plan.entity.related_product?`${plan.entity.name} makes ${plan.entity.related_product}. `:""}${plan.entity.relationship_reason} Product overlap ${plan.entity.product_overlap_score}%; discovery confidence ${plan.entity.relation_confidence}%.`,
          });
          competitor=created[0]||null;
          if(competitor){existingCompetitors.push(competitor);existingDomains.add(plan.officialDomain);existingNames.add(plan.entity.name.toLowerCase());promoted++;promotedCompetitors.push(competitor)}
        }catch{
          const rows=await sbSelect(`radar_competitors?workspace_id=eq.${workspace.id}&website=eq.${encodeURIComponent(radarOrigin(plan.entity.official_website))}&select=*&limit=1`).catch(()=>[]);
          competitor=rows[0]||null;
        }
      }
      if(competitor){
        const candidate=await sbSelect(`radar_candidates?workspace_id=eq.${workspace.id}&or=(domain.eq.${encodeURIComponent(plan.candidateDomain)},official_website.eq.${encodeURIComponent(radarOrigin(plan.entity.official_website))})&select=id,status&limit=1`).catch(()=>[]);
        if(candidate[0]&&candidate[0].status!=="promoted")await sbUpdate("radar_candidates",`id=eq.${candidate[0].id}`,{status:"promoted",updated_at:new Date().toISOString()}).catch(()=>{});
      }
    }

    const findings=promoted+insertedCandidates.length;
    await sbUpdate("radar_scan_runs",`id=eq.${run.id}`,{
      status:"completed",
      pages_scanned:searchResult.inspected,
      findings,
      error:searchResult.failed?`${searchResult.failed} discovery search batch item(s) failed; successful results were preserved.`:null,
      finished_at:new Date().toISOString(),
    });

    return NextResponse.json({
      ok:true,
      search:{firecrawl:firecrawlConfigured(),live_search:engineSearchConfigured()},
      company_brain_expansion:{used:Boolean(aiQueries.length),cached:Boolean(expansion?.cached),provider:expansion?.provider||null,model:expansion?.model||null,queries:aiQueries.length,error:expansion?.error||null},
      queries_generated:queries.length,
      searches_succeeded:searchResult.succeeded,
      searches_failed:searchResult.failed,
      inspected:searchResult.inspected,
      entities_extracted:shortlisted.length,
      candidates_found:insertedCandidates.length,
      source_leads_found:insertedSources.length,
      promoted,
      competitors:promotedCompetitors,
      candidates:insertedCandidates.sort((a:any,b:any)=>Number(b.product_overlap_score||0)-Number(a.product_overlap_score||0)).slice(0,75),
    });
  }catch(error){
    if(run?.id)try{await sbUpdate("radar_scan_runs",`id=eq.${run.id}`,{status:"failed",error:error instanceof Error?error.message:"Discovery failed",finished_at:new Date().toISOString()})}catch{}
    if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});
    return NextResponse.json({error:error instanceof Error?error.message:"Discovery failed"},{status:500});
  }
}
