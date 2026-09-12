import { NextResponse } from "next/server";
import { sbInsert, sbSelect, sbUpdate } from "@/lib/radar-db";
import { createMonitor, searchWebFast } from "@/lib/firecrawl";
import { analyzeDiscoveryResults, radarAIConfigured } from "@/lib/radar-ai";

function domainOf(raw:string){try{return new URL(raw).hostname.replace(/^www\./,"").toLowerCase()}catch{return""}}
function originOf(raw:string){try{return new URL(raw).origin}catch{return raw}}
function flattenEvents(payload:any){const data=payload?.data; if(Array.isArray(data))return data; if(data&&typeof data==="object")return[data]; return[]}
function categoryFor(score:number){if(score>=75)return"direct";if(score>=50)return"adjacent";if(score>=28)return"micro";return"emerging"}
const sourceDomains=["wikipedia.org","ycombinator.com","crunchbase.com","tracxn.com","wellfound.com","linkedin.com","youtube.com","reddit.com","news.mit.edu","mit.edu","caltech.edu","techcrunch.com","forbes.com","reuters.com","bloomberg.com","medium.com","uavcoach.com","startup0km.com","cbinsights.com","g2.com","capterra.com","producthunt.com"];
function sourceLike(domain:string){return sourceDomains.some(x=>domain===x||domain.endsWith(`.${x}`))}
async function resolveOfficial(name:string,relatedProduct:string,supplied:string,ownDomain:string){const d=domainOf(supplied||"");if(d&&!sourceLike(d)&&d!==ownDomain)return originOf(supplied);try{const rows=await searchWebFast(`"${name}" ${relatedProduct||"product"} official`,4);const tokens=name.toLowerCase().split(/[^a-z0-9]+/).filter(x=>x.length>2);const hit=rows.find((r:any)=>{const rd=domainOf(r.url);if(!rd||sourceLike(rd)||rd===ownDomain)return false;const hay=`${r.title||""} ${r.description||""} ${rd}`.toLowerCase();return tokens.some(t=>hay.includes(t))});return hit?originOf(hit.url):""}catch{return""}}

export async function POST(req:Request){
  try{
    const expected=process.env.RADAR_API_SECRET||""; const supplied=req.headers.get("x-radar-webhook-secret")||"";
    if(!expected||supplied!==expected)return NextResponse.json({error:"Unauthorized"},{status:401});
    const payload=await req.json(); const type=String(payload?.type||""); const monitorId=payload?.data?.monitorId||payload?.monitorId||payload?.metadata?.monitorId||null;
    if(!monitorId)return NextResponse.json({ok:true,ignored:"missing_monitor_id"});
    const monitorRows=await sbSelect(`radar_monitors?provider_monitor_id=eq.${encodeURIComponent(String(monitorId))}&select=*&limit=1`); const monitor=monitorRows[0];
    if(!monitor)return NextResponse.json({ok:true,ignored:"monitor_not_found"});
    await sbUpdate("radar_monitors",`id=eq.${monitor.id}`,{last_event_at:new Date().toISOString(),updated_at:new Date().toISOString(),last_error:null});
    if(type==="monitor.check.completed")return NextResponse.json({ok:true,type,processed:0});
    const workspace=(await sbSelect(`radar_workspaces?id=eq.${monitor.workspace_id}&select=*`))[0]; if(!workspace)return NextResponse.json({ok:true,ignored:"workspace_not_found"});
    const ownDomain=domainOf(workspace.website||""); const boundCompetitor=monitor.competitor_id?(await sbSelect(`radar_competitors?id=eq.${monitor.competitor_id}&workspace_id=eq.${workspace.id}&select=*&limit=1`))[0]||null:null;
    let processed=0,promoted=0;

    for(const event of flattenEvents(payload)){
      const meaningful=event?.isMeaningful??event?.judgment?.meaningful??true; if(!meaningful)continue;
      const url=String(event?.url||event?.sourceUrl||event?.metadata?.url||""); const domain=domainOf(url); if(!url||!domain||domain===ownDomain)continue;
      const reason=String(event?.judgment?.reason||event?.reason||"A meaningful public change matched this RADAR monitor.").slice(0,2000);
      const diffText=String(event?.diff?.text||event?.content||event?.markdown||"").slice(0,12000); const title=String(event?.title||event?.metadata?.title||domain).slice(0,200);
      const confidence=event?.judgment?.confidence==="high"?92:event?.judgment?.confidence==="low"?60:78;
      let competitor=boundCompetitor;

      if(monitor.monitor_type==="web_discovery"){
        let extracted:any[]=[];
        if(radarAIConfigured()){
          try{const analysis=await analyzeDiscoveryResults(workspace,[{url,title,description:`${reason} ${diffText}`.slice(0,5000)}]);extracted=analysis?.[0]?.companies||[]}catch{}
        }
        for(const entity of extracted.slice(0,5)){
          const name=String(entity.name||"").trim(); if(!name)continue;
          const official=await resolveOfficial(name,String(entity.related_product||""),String(entity.official_website||""),ownDomain); const officialDomain=domainOf(official);
          const productOverlap=Math.max(0,Math.min(100,Number(entity.product_overlap_score||0))); const relationConfidence=Math.max(0,Math.min(100,Number(entity.relation_confidence||0)));
          const candidateDomain=officialDomain||`source:${domain}:${name.toLowerCase().replace(/[^a-z0-9]+/g,"-").slice(0,40)}`;
          const existingCandidate=(await sbSelect(`radar_candidates?workspace_id=eq.${workspace.id}&domain=eq.${encodeURIComponent(candidateDomain)}&select=*&limit=1`))[0];
          const candidatePatch={url:official||url,title:name,description:entity.relationship_reason||reason,provisional_score:Math.round(productOverlap*.8),status:officialDomain&&productOverlap>=20&&relationConfidence>=60?"promoted":"candidate",entity_type:"company",related_product:entity.related_product||null,relationship_reason:entity.relationship_reason||reason,relation_confidence:relationConfidence,source_page_url:url,official_website:official||null,product_overlap_score:productOverlap,updated_at:new Date().toISOString()};
          if(existingCandidate)await sbUpdate("radar_candidates",`id=eq.${existingCandidate.id}`,candidatePatch);else await sbInsert("radar_candidates",{workspace_id:workspace.id,source_query:"continuous_firecrawl_monitor",domain:candidateDomain,...candidatePatch});
          if(!officialDomain||sourceLike(officialDomain)||productOverlap<20||relationConfidence<60)continue;
          const existing=(await sbSelect(`radar_competitors?workspace_id=eq.${workspace.id}&website=eq.${encodeURIComponent(originOf(official))}&select=*&limit=1`))[0];
          if(existing){competitor=existing;continue}
          const similarity=Math.round(productOverlap*.82); const threat=Math.min(100,Math.round(similarity*.72+productOverlap*.28));
          const rows=await sbInsert("radar_competitors",{workspace_id:workspace.id,name,website:originOf(official),description:entity.related_product||entity.relationship_reason||reason,category:categoryFor(similarity),similarity_score:similarity,product_overlap_score:productOverlap,relation_confidence:relationConfidence,related_product:entity.related_product||null,relationship_reason:entity.relationship_reason||reason,discovery_source_url:url,threat_score:threat,momentum_score:45,movement:"closer",monitoring_preference:"neutral",why_it_matters:`${name} makes ${entity.related_product||"a related product"}. ${entity.relationship_reason||reason} Product overlap ${productOverlap}%; discovery confidence ${relationConfidence}%.`});
          competitor=rows[0]||null;promoted++;
        }
        if(!extracted.length){
          await sbInsert("radar_evidence",{workspace_id:workspace.id,competitor_id:null,source_url:url,source_type:"discovery_source",title,fact:reason,summary:diffText||"Public source detected. No verified company entity extracted yet.",confidence}); processed++; continue;
        }
      }

      await sbInsert("radar_evidence",{workspace_id:workspace.id,competitor_id:competitor?.id||null,source_url:url,source_type:monitor.monitor_type==="entity_surveillance"?"competitor_change":"continuous_web_monitor",title,fact:reason,summary:diffText||"New public information detected by continuous monitoring.",confidence});
      const impact=competitor?Math.max(55,Math.round(Number(competitor.threat_score||0))):55;
      await sbInsert("radar_signals",{workspace_id:workspace.id,competitor_id:competitor?.id||null,signal_type:monitor.monitor_type==="entity_surveillance"?"competitor_change":competitor?"new_competitor":"new_web_candidate",title:competitor?`${competitor.name}: ${reason.slice(0,120)}`:`New competitive source: ${title}`,summary:diffText||reason,impact_score:impact,confidence,status:"new"});
      if(competitor&&impact>=65)await sbInsert("radar_recommendations",{workspace_id:workspace.id,competitor_id:competitor.id,priority:impact>=85?"high":"medium",title:`Review ${competitor.related_product||competitor.name}`,rationale:reason,action:"Review the verified product overlap, source evidence and strongest competitive dimensions before deciding whether roadmap, positioning, pricing or GTM requires a response."});
      processed++;
    }
    return NextResponse.json({ok:true,type,processed,promoted,monitor_type:monitor.monitor_type,competitor_id:boundCompetitor?.id||null});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Webhook processing failed"},{status:500})}
}
