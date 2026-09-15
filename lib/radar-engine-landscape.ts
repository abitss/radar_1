import { searchWebFast } from "@/lib/firecrawl";
import { analyzeCompetitiveLandscape } from "@/lib/radar-ultimate-ai";
import { sbInsert, sbSelect, sbUpdate } from "@/lib/radar-db";

function terms(value:any){return(Array.isArray(value)?value.map(String):String(value||"").split(/[,;|\n]/)).map(x=>x.trim()).filter(x=>x.length>2)}
function domain(raw:string){try{return new URL(raw).hostname.replace(/^www\./,"").toLowerCase()}catch{return""}}
function origin(raw:string){try{return new URL(raw).origin}catch{return raw}}
function clamp(v:any,f=0){const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(100,Math.round(n))):f}
function safeCategory(value:any){const v=String(value||"");return["direct","adjacent","substitute","emerging","incumbent","watchlist"].includes(v)?v:"watchlist"}

function queries(workspace:any){
  const product=terms(workspace.product_keywords).slice(0,5);
  const features=terms(workspace.major_features).slice(0,4);
  const capabilities=terms(workspace.capability_keywords).slice(0,5);
  const customers=[...terms(workspace.target_customers),...terms(workspace.buyer)].slice(0,4);
  const industry=terms(`${workspace.industry||""},${workspace.sub_category||""}`).slice(0,3);
  const problem=terms(workspace.problem_statement).slice(0,5);
  const q=new Set<string>();
  if(product.length){q.add(`${product.slice(0,3).join(" ")} competitors companies`);q.add(`${product.slice(0,2).join(" ")} alternatives startups`);q.add(`${product.slice(0,2).join(" ")} product launch company`)}
  if(product.length&&customers.length){q.add(`${product.slice(0,2).join(" ")} for ${customers.slice(0,2).join(" ")} companies`)}
  if(problem.length)q.add(`companies solving ${problem.slice(0,4).join(" ")}`);
  if(industry.length)q.add(`${industry.slice(0,2).join(" ")} emerging startups competitors`);
  for(const feature of [...features,...capabilities].slice(0,5))q.add(`"${feature}" company product startup`);
  if(workspace.name)q.add(`${workspace.name} alternatives competitors`);
  return[...q].slice(0,12);
}

export async function runCompetitiveLandscape(workspaceId:string){
  const workspace=(await sbSelect(`radar_workspaces?id=eq.${workspaceId}&select=*&limit=1`))[0];
  if(!workspace?.website)return{inspected:0,analyzed:0,updated:0,inserted:0,evidence:0,themes:[]};
  const ownDomain=domain(workspace.website);
  const queryList=queries(workspace);
  const batches=await Promise.allSettled(queryList.map(q=>searchWebFast(q,8).then(rows=>rows.map(row=>({...row,query:q})))));
  const map=new Map<string,any>();
  for(const batch of batches){if(batch.status!=="fulfilled")continue;for(const row of batch.value){if(!row?.url||domain(row.url)===ownDomain||map.has(row.url))continue;map.set(row.url,row)}}
  const evidenceRows=[...map.values()].slice(0,100);
  if(!evidenceRows.length)return{inspected:0,analyzed:0,updated:0,inserted:0,evidence:0,themes:[]};
  const landscape=await analyzeCompetitiveLandscape(workspace,evidenceRows);
  const existing=await sbSelect(`radar_competitors?workspace_id=eq.${workspaceId}&select=*&limit=300`);
  const byDomain=new Map(existing.map((c:any)=>[domain(c.website||""),c]).filter(([d])=>Boolean(d)));
  const byName=new Map(existing.map((c:any)=>[String(c.name||"").trim().toLowerCase(),c]));
  let updated=0,inserted=0,evidenceCount=0;

  for(const item of landscape.competitors||[]){
    const website=origin(String(item.website||""));
    const d=domain(website);
    if(!d||d===ownDomain)continue;
    const evidenceUrls=(item.evidence_urls||[]).filter((u:string)=>map.has(u));
    if(!evidenceUrls.length)continue;
    const similarity=clamp(item.similarity);
    const threat=clamp(item.threat);
    const confidence=clamp(item.confidence,65);
    const productOverlap=clamp(item.components?.product,Math.round(similarity*.75));
    const strategicRelevance=clamp(item.threat_components?.strategic_relevance,similarity);
    const momentum=clamp(item.threat_components?.momentum,40);
    const category=safeCategory(item.classification);
    const why=`${item.related_product?`${item.name} makes ${item.related_product}. `:""}${item.rationale||item.summary||""} RADAR landscape similarity ${similarity}%, threat ${threat}%, confidence ${confidence}%.`;
    const current:any=byDomain.get(d)||byName.get(String(item.name||"").trim().toLowerCase());
    let competitor:any=current;
    const patch:any={name:item.name,website,description:item.summary||item.related_product||current?.description||null,category,similarity_score:similarity,threat_score:threat,momentum_score:momentum,product_overlap_score:productOverlap,relation_confidence:confidence,related_product:item.related_product||current?.related_product||null,relationship_reason:item.rationale||item.summary||current?.relationship_reason||null,discovery_source_url:evidenceUrls[0],monitoring_preference:current?.monitoring_preference||"auto",movement:current?.movement||"stable",why_it_matters:why,updated_at:new Date().toISOString()};
    if(current){const rows=await sbUpdate("radar_competitors",`id=eq.${current.id}&workspace_id=eq.${workspaceId}`,patch);competitor=rows[0]||current;updated++}
    else{const rows=await sbInsert("radar_competitors",{workspace_id:workspaceId,...patch});competitor=rows[0];inserted++;if(competitor){byDomain.set(d,competitor);byName.set(String(item.name||"").trim().toLowerCase(),competitor)}}
    if(!competitor?.id)continue;

    const dims={problem_overlap:clamp(item.components?.problem),customer_overlap:clamp(item.components?.customer),buyer_overlap:clamp(item.components?.customer),product_overlap:productOverlap,workflow_overlap:Math.round((clamp(item.components?.problem)+productOverlap+clamp(item.components?.features))/3),feature_overlap:clamp(item.components?.features),technology_overlap:clamp(item.components?.technology),business_model_overlap:clamp(item.components?.business_model),distribution_overlap:clamp(item.components?.distribution),geography_overlap:clamp(item.components?.geography),updated_at:new Date().toISOString()};
    const existingDims=await sbSelect(`radar_similarity_dimensions?competitor_id=eq.${competitor.id}&select=id&limit=1`);
    if(existingDims[0])await sbUpdate("radar_similarity_dimensions",`id=eq.${existingDims[0].id}`,dims);else await sbInsert("radar_similarity_dimensions",{competitor_id:competitor.id,...dims});

    for(const url of evidenceUrls.slice(0,6)){
      const source=map.get(url);
      const duplicate=(await sbSelect(`radar_evidence?workspace_id=eq.${workspaceId}&competitor_id=eq.${competitor.id}&source_url=eq.${encodeURIComponent(url)}&select=id&limit=1`))[0];
      if(duplicate)continue;
      await sbInsert("radar_evidence",{workspace_id:workspaceId,competitor_id:competitor.id,source_url:url,source_type:"competitive_landscape",title:String(source?.title||item.name).slice(0,240),fact:String(source?.description||item.summary||item.rationale||"").slice(0,1400),summary:String(item.rationale||item.summary||"").slice(0,2200),confidence,claim_type:"supporting"});
      evidenceCount++;
    }

    if(threat>=65||strategicRelevance>=65){
      try{await sbInsert("radar_intelligence_events",{workspace_id:workspaceId,competitor_id:competitor.id,event_type:current?"landscape_update":"new_competitor",severity:threat>=90?"critical":threat>=75?"high":"watch",title:current?`${item.name} competitive position refreshed`:`New competitor detected: ${item.name}`,summary:why,source_url:evidenceUrls[0],confidence,impact_score:threat,dedupe_key:`landscape:${competitor.id}:${new Date().toISOString().slice(0,10)}`})}catch{}
    }
  }
  return{inspected:evidenceRows.length,analyzed:(landscape.competitors||[]).length,updated,inserted,evidence:evidenceCount,themes:landscape.market_themes||[]};
}
