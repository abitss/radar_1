import { engineSearchWeb } from "@/lib/radar-engine-search";
import { analyzeCompetitiveLandscape } from "@/lib/radar-ultimate-ai";
import { sbInsert, sbSelect, sbUpdate } from "@/lib/radar-db";
import { companyBrainReadiness } from "@/lib/radar-profile";
import { cleanDiscoveryQuery, conciseDiscoveryTerms, isOfficialCompanyWebsite, looksLikeSourceUrl, radarDomain, radarOrigin, validRadarCompanyName } from "@/lib/radar-discovery-quality";

type LandscapeResult={inspected:number;analyzed:number;updated:number;inserted:number;evidence:number;themes:any[]};
function clamp(v:any,f=0):number{const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(100,Math.round(n))):f}
function safeCategory(value:any):string{const v=String(value||"");return["direct","adjacent","substitute","emerging","incumbent","watchlist"].includes(v)?v:"watchlist"}

function queries(workspace:any):string[]{
  const own=String(workspace.name||"").toLowerCase();
  const product=conciseDiscoveryTerms(workspace.product_keywords,8).filter(x=>!own||!x.toLowerCase().includes(own)).slice(0,4);
  const features=conciseDiscoveryTerms(workspace.major_features,8).slice(0,4);
  const capabilities=conciseDiscoveryTerms(workspace.capability_keywords,8).slice(0,5);
  const industry=conciseDiscoveryTerms(`${workspace.industry||""},${workspace.sub_category||""}`,6).slice(0,3);
  const geography=conciseDiscoveryTerms(workspace.geography,3).slice(0,1);
  const q=new Set<string>();
  if(product[0]){q.add(`${product[0]} competitors`);q.add(`${product[0]} alternatives`);q.add(`${product[0]} startup company`)}
  if(product[0]&&product[1])q.add(`${product[0]} ${product[1]} company`);
  if(industry[0])q.add(`${industry.slice(0,2).join(" ")} competitors startups`);
  for(const feature of [...features,...capabilities].slice(0,5))q.add(`"${feature}" company product`);
  if(product[0]&&geography[0])q.add(`${product[0]} company ${geography[0]}`);
  return Array.from(q).map(x=>cleanDiscoveryQuery(x)).filter(Boolean).slice(0,12);
}

export async function runCompetitiveLandscape(workspaceId:string):Promise<LandscapeResult>{
  const workspaceRows:any[]=await sbSelect(`radar_workspaces?id=eq.${encodeURIComponent(workspaceId)}&select=*&limit=1`);const workspace:any=workspaceRows[0]||null;
  const readiness=companyBrainReadiness(workspace);if(!readiness.ready)return{inspected:0,analyzed:0,updated:0,inserted:0,evidence:0,themes:[]};
  const ownDomain=radarDomain(String(workspace.website||""));const queryList=queries(workspace);
  const batches=await Promise.allSettled(queryList.map(async(q:string)=>{const rows=await engineSearchWeb(q,8);return rows.map((row:any)=>({...row,query:q}))}));
  const evidenceMap=new Map<string,any>();
  for(const batch of batches){if(batch.status!=="fulfilled")continue;for(const row of batch.value as any[]){const url=String(row?.url||"");if(!url||(ownDomain&&radarDomain(url)===ownDomain)||evidenceMap.has(url))continue;evidenceMap.set(url,row)}}
  const evidenceRows:any[]=Array.from(evidenceMap.values()).slice(0,100);if(!evidenceRows.length)return{inspected:0,analyzed:0,updated:0,inserted:0,evidence:0,themes:[]};

  const landscape:any=await analyzeCompetitiveLandscape(workspace,evidenceRows);
  const existing:any[]=await sbSelect(`radar_competitors?workspace_id=eq.${encodeURIComponent(workspaceId)}&select=*&limit=300`);
  const byDomain=new Map<string,any>();const byName=new Map<string,any>();
  for(const competitor of existing){const d=radarDomain(String(competitor?.website||""));if(d)byDomain.set(d,competitor);const name=String(competitor?.name||"").trim().toLowerCase();if(name)byName.set(name,competitor)}
  let updated=0,inserted=0,evidenceCount=0;const competitors:any[]=Array.isArray(landscape?.competitors)?landscape.competitors:[];

  for(const item of competitors){
    const website=radarOrigin(String(item?.website||""));const d=radarDomain(website);const itemName=String(item?.name||d).trim().slice(0,160);
    if(!d||(ownDomain&&d===ownDomain)||!validRadarCompanyName(itemName)||!isOfficialCompanyWebsite(website))continue;
    const evidenceUrls:string[]=(Array.isArray(item?.evidence_urls)?item.evidence_urls:[]).map((u:any)=>String(u)).filter((u:string)=>evidenceMap.has(u));if(!evidenceUrls.length)continue;
    const firstEvidence:any=evidenceMap.get(evidenceUrls[0]);
    if(looksLikeSourceUrl(website,itemName,String(item?.summary||""))&&radarDomain(evidenceUrls[0])===d)continue;
    if(firstEvidence&&looksLikeSourceUrl(website,firstEvidence.title,firstEvidence.description)&&radarDomain(firstEvidence.url)===d)continue;

    const similarity=clamp(item?.similarity),threat=clamp(item?.threat),confidence=clamp(item?.confidence,65),productOverlap=clamp(item?.components?.product,Math.round(similarity*.75)),strategicRelevance=clamp(item?.threat_components?.strategic_relevance,similarity),momentum=clamp(item?.threat_components?.momentum,40),suggestedCategory=safeCategory(item?.classification);
    const current:any=byDomain.get(d)||byName.get(itemName.toLowerCase())||null;
    const category=current?.category_locked?current.category:suggestedCategory;
    const why=`${item?.related_product?`${itemName} makes ${String(item.related_product)}. `:""}${String(item?.rationale||item?.summary||"")} RADAR landscape similarity ${similarity}%, threat ${threat}%, confidence ${confidence}%.${current?.category_locked?` Founder category override preserved as ${current.category}.`:""}`;
    const patch:any={name:itemName,website,description:String(item?.summary||item?.related_product||current?.description||"").slice(0,2000)||null,category,similarity_score:similarity,threat_score:threat,momentum_score:momentum,product_overlap_score:productOverlap,relation_confidence:confidence,related_product:String(item?.related_product||current?.related_product||"").slice(0,500)||null,relationship_reason:String(item?.rationale||item?.summary||current?.relationship_reason||"").slice(0,2400)||null,discovery_source_url:evidenceUrls[0],monitoring_preference:current?.monitoring_preference||"auto",movement:current?.movement||"stable",why_it_matters:why.slice(0,3000),updated_at:new Date().toISOString()};
    if(!current)patch.category_locked=false;
    let competitor:any=current;
    if(current?.id){const rows:any[]=await sbUpdate("radar_competitors",`id=eq.${encodeURIComponent(String(current.id))}&workspace_id=eq.${encodeURIComponent(workspaceId)}`,patch);competitor=rows[0]||current;updated++}
    else{const rows:any[]=await sbInsert("radar_competitors",{workspace_id:workspaceId,...patch});competitor=rows[0]||null;inserted++;if(competitor){byDomain.set(d,competitor);byName.set(itemName.toLowerCase(),competitor)}}
    if(!competitor?.id)continue;

    const problemOverlap=clamp(item?.components?.problem),featureOverlap=clamp(item?.components?.features);const dims:any={problem_overlap:problemOverlap,customer_overlap:clamp(item?.components?.customer),buyer_overlap:clamp(item?.components?.customer),product_overlap:productOverlap,workflow_overlap:Math.round((problemOverlap+productOverlap+featureOverlap)/3),feature_overlap:featureOverlap,technology_overlap:clamp(item?.components?.technology),business_model_overlap:clamp(item?.components?.business_model),distribution_overlap:clamp(item?.components?.distribution),geography_overlap:clamp(item?.components?.geography),updated_at:new Date().toISOString()};
    const existingDims:any[]=await sbSelect(`radar_similarity_dimensions?competitor_id=eq.${encodeURIComponent(String(competitor.id))}&select=id&limit=1`);if(existingDims[0]?.id)await sbUpdate("radar_similarity_dimensions",`id=eq.${encodeURIComponent(String(existingDims[0].id))}`,dims);else await sbInsert("radar_similarity_dimensions",{competitor_id:competitor.id,...dims});
    for(const url of evidenceUrls.slice(0,6)){const source:any=evidenceMap.get(url);const duplicates:any[]=await sbSelect(`radar_evidence?workspace_id=eq.${encodeURIComponent(workspaceId)}&competitor_id=eq.${encodeURIComponent(String(competitor.id))}&source_url=eq.${encodeURIComponent(url)}&select=id&limit=1`);if(duplicates[0])continue;await sbInsert("radar_evidence",{workspace_id:workspaceId,competitor_id:competitor.id,source_url:url,source_type:"competitive_landscape",title:String(source?.title||itemName).slice(0,240),fact:String(source?.description||item?.summary||item?.rationale||"").slice(0,1400),summary:String(item?.rationale||item?.summary||"").slice(0,2200),confidence,claim_type:"supporting"});evidenceCount++}
    if(threat>=65||strategicRelevance>=65){try{await sbInsert("radar_intelligence_events",{workspace_id:workspaceId,competitor_id:competitor.id,event_type:current?"landscape_update":"new_competitor",severity:threat>=90?"critical":threat>=75?"high":"watch",title:current?`${itemName} competitive position refreshed`:`New competitor detected: ${itemName}`,summary:why.slice(0,2200),source_url:evidenceUrls[0],confidence,impact_score:threat,dedupe_key:`landscape:${String(competitor.id)}:${new Date().toISOString().slice(0,10)}`})}catch{}}
  }
  return{inspected:evidenceRows.length,analyzed:competitors.length,updated,inserted,evidence:evidenceCount,themes:Array.isArray(landscape?.market_themes)?landscape.market_themes:[]};
}
