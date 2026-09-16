import { NextResponse } from "next/server";
import { sbInsert, sbSelect, sbUpdate } from "@/lib/radar-db";
import { searchWebFast } from "@/lib/firecrawl";
import { analyzeDiscoveryResults, radarAIConfigured } from "@/lib/radar-ai";
import { scheduleWorkspaceRecurringTasks } from "@/lib/radar-source-monitor";
import { cleanRadarCompanyName, isOfficialCompanyWebsite, looksLikeSourceUrl, radarDomain, radarOrigin, validRadarCompanyName } from "@/lib/radar-discovery-quality";

function flattenEvents(payload:any){const data=payload?.data;if(Array.isArray(data))return data;if(data&&typeof data==="object")return[data];return[]}
function categoryFor(score:number,productOverlap:number){if(productOverlap>=78&&score>=62)return"direct";if(productOverlap>=55||score>=55)return"adjacent";if(productOverlap>=32||score>=30)return"substitute";return"emerging"}
function severityFor(impact:number){return impact>=90?"critical":impact>=75?"high":impact>=55?"watch":"info"}
function sourceKey(raw:string){try{const u=new URL(raw);return`source:${`${u.origin}${u.pathname}`.replace(/\/$/,"").toLowerCase()}`.slice(0,500)}catch{return`source:${String(raw||"").slice(0,480)}`}}
async function liveEvent(data:any){try{await sbInsert("radar_intelligence_events",data)}catch{}}

async function runMaintenance(req:Request,workspaceId:string,secret:string){
  try{
    const res=await fetch(new URL("/api/radar/maintenance",req.url),{method:"POST",headers:{"Content-Type":"application/json","x-radar-api-key":secret,"x-radar-system-workspace":workspaceId},body:JSON.stringify({providerHeartbeat:true}),cache:"no-store",signal:AbortSignal.timeout(240000)});
    const data=await res.json().catch(()=>({}));
    return{ok:res.ok,status:res.status,data};
  }catch(error){return{ok:false,status:0,data:{error:error instanceof Error?error.message:"maintenance failed"}}}
}

async function resolveOfficial(name:string,relatedProduct:string,supplied:string,ownDomain:string,sourceUrl:string){
  const suppliedDomain=radarDomain(supplied||"");
  if(suppliedDomain&&suppliedDomain!==ownDomain&&isOfficialCompanyWebsite(supplied,sourceUrl,"company"))return radarOrigin(supplied);
  try{
    const rows=await searchWebFast(`"${name}" ${relatedProduct||"product"} official`,4);
    const tokens=name.toLowerCase().split(/[^a-z0-9]+/).filter(x=>x.length>2);
    const hit=rows.find((r:any)=>{
      const d=radarDomain(r.url);
      if(!d||d===ownDomain||looksLikeSourceUrl(r.url,r.title,r.description))return false;
      const hay=`${r.title||""} ${r.description||""} ${d}`.toLowerCase();
      return tokens.some(t=>hay.includes(t));
    });
    return hit?radarOrigin(hit.url):"";
  }catch{return""}
}

export async function POST(req:Request){
  try{
    const expected=process.env.RADAR_API_SECRET||"";
    const supplied=req.headers.get("x-radar-webhook-secret")||"";
    if(!expected||supplied!==expected)return NextResponse.json({error:"Unauthorized"},{status:401});

    const payload=await req.json();
    const type=String(payload?.type||"");
    const monitorId=payload?.data?.monitorId||payload?.monitorId||payload?.metadata?.monitorId||null;
    if(!monitorId)return NextResponse.json({ok:true,ignored:"missing_monitor_id"});

    const monitor=(await sbSelect(`radar_monitors?provider_monitor_id=eq.${encodeURIComponent(String(monitorId))}&select=*&limit=1`))[0];
    if(!monitor)return NextResponse.json({ok:true,ignored:"monitor_not_found"});
    if(monitor.status!=="active")return NextResponse.json({ok:true,ignored:"monitor_not_active",status:monitor.status});

    await sbUpdate("radar_monitors",`id=eq.${monitor.id}`,{last_event_at:new Date().toISOString(),updated_at:new Date().toISOString(),last_error:null});

    if(type==="monitor.check.completed"){
      await scheduleWorkspaceRecurringTasks(monitor.workspace_id).catch(()=>{});
      const maintenance=await runMaintenance(req,monitor.workspace_id,expected);
      return NextResponse.json({ok:true,type,processed:0,maintenance});
    }

    const workspace=(await sbSelect(`radar_workspaces?id=eq.${monitor.workspace_id}&select=*&limit=1`))[0];
    if(!workspace)return NextResponse.json({ok:true,ignored:"workspace_not_found"});
    const ownDomain=radarDomain(workspace.website||"");
    const boundCompetitor=monitor.competitor_id?(await sbSelect(`radar_competitors?id=eq.${monitor.competitor_id}&workspace_id=eq.${workspace.id}&select=*&limit=1`))[0]||null:null;
    if(boundCompetitor?.monitoring_preference==="ignore")return NextResponse.json({ok:true,ignored:"competitor_ignored"});

    let processed=0,promoted=0;

    for(const event of flattenEvents(payload)){
      const meaningful=event?.isMeaningful??event?.judgment?.meaningful??true;
      if(!meaningful)continue;
      const url=String(event?.url||event?.sourceUrl||event?.metadata?.url||"");
      const domain=radarDomain(url);
      if(!url||!domain||domain===ownDomain)continue;
      const reason=String(event?.judgment?.reason||event?.reason||"A meaningful public change matched this RADAR monitor.").slice(0,2000);
      const diffText=String(event?.diff?.text||event?.content||event?.markdown||"").slice(0,12000);
      const title=String(event?.title||event?.metadata?.title||domain).slice(0,200);
      const confidence=event?.judgment?.confidence==="high"?92:event?.judgment?.confidence==="low"?60:78;
      let competitor=boundCompetitor;

      if(monitor.monitor_type==="web_discovery"){
        let extracted:any[]=[];
        if(radarAIConfigured()){
          try{const analysis=await analyzeDiscoveryResults(workspace,[{url,title,description:`${reason} ${diffText}`.slice(0,5000)}]);extracted=analysis?.[0]?.companies||[]}catch{}
        }

        for(const entity of extracted.slice(0,5)){
          const name=cleanRadarCompanyName(entity.name);
          if(!validRadarCompanyName(name))continue;
          const relatedProduct=String(entity.related_product||"");
          const official=await resolveOfficial(name,relatedProduct,String(entity.official_website||""),ownDomain,url);
          const officialDomain=radarDomain(official);
          const productOverlap=Math.max(0,Math.min(100,Math.round(Number(entity.product_overlap_score||0))));
          const relationConfidence=Math.max(0,Math.min(100,Math.round(Number(entity.relation_confidence||0))));
          const candidateDomain=officialDomain||`source:${domain}:${name.toLowerCase().replace(/[^a-z0-9]+/g,"-").slice(0,50)}`;
          const existingCandidate=(await sbSelect(`radar_candidates?workspace_id=eq.${workspace.id}&domain=eq.${encodeURIComponent(candidateDomain)}&select=*&limit=1`))[0];
          const protectedStatus=existingCandidate?.status&&["rejected","ignored","promoted"].includes(existingCandidate.status)?existingCandidate.status:"candidate";
          const candidatePatch={url:official||url,title:name,description:entity.relationship_reason||reason,provisional_score:Math.round(productOverlap*.8),status:protectedStatus,entity_type:"company",related_product:relatedProduct||null,relationship_reason:entity.relationship_reason||reason,relation_confidence:relationConfidence,source_page_url:url,official_website:official||null,product_overlap_score:productOverlap,updated_at:new Date().toISOString()};
          if(existingCandidate)await sbUpdate("radar_candidates",`id=eq.${existingCandidate.id}`,candidatePatch);else await sbInsert("radar_candidates",{workspace_id:workspace.id,source_query:"continuous_firecrawl_monitor",domain:candidateDomain,...candidatePatch});

          const reviewBlocked=["rejected","ignored"].includes(String(existingCandidate?.status||""));
          if(reviewBlocked||!officialDomain||productOverlap<50||relationConfidence<70||!isOfficialCompanyWebsite(official,url,"company"))continue;
          const existing=(await sbSelect(`radar_competitors?workspace_id=eq.${workspace.id}&website=eq.${encodeURIComponent(radarOrigin(official))}&select=*&limit=1`))[0];
          if(existing){competitor=existing;if(existingCandidate?.id&&existingCandidate.status!=="promoted")await sbUpdate("radar_candidates",`id=eq.${existingCandidate.id}`,{status:"promoted",updated_at:new Date().toISOString()}).catch(()=>{});continue}

          const similarity=Math.round(productOverlap*.82);
          const threat=Math.min(100,Math.round(similarity*.72+productOverlap*.28));
          try{
            const rows=await sbInsert("radar_competitors",{workspace_id:workspace.id,name,website:radarOrigin(official),description:relatedProduct||entity.relationship_reason||reason,category:categoryFor(similarity,productOverlap),category_locked:false,similarity_score:similarity,product_overlap_score:productOverlap,relation_confidence:relationConfidence,related_product:relatedProduct||null,relationship_reason:entity.relationship_reason||reason,discovery_source_url:url,threat_score:threat,momentum_score:35,movement:"stable",monitoring_preference:"auto",why_it_matters:`${name} makes ${relatedProduct||"a related product"}. ${entity.relationship_reason||reason} Product overlap ${productOverlap}%; discovery confidence ${relationConfidence}%.`});
            competitor=rows[0]||null;
          }catch{
            const retry=await sbSelect(`radar_competitors?workspace_id=eq.${workspace.id}&website=eq.${encodeURIComponent(radarOrigin(official))}&select=*&limit=1`).catch(()=>[]);
            competitor=retry[0]||null;
          }
          if(competitor){
            promoted++;
            const promotedCandidate=await sbSelect(`radar_candidates?workspace_id=eq.${workspace.id}&domain=eq.${encodeURIComponent(candidateDomain)}&select=id,status&limit=1`).catch(()=>[]);
            if(promotedCandidate[0]&&promotedCandidate[0].status!=="promoted")await sbUpdate("radar_candidates",`id=eq.${promotedCandidate[0].id}`,{status:"promoted",updated_at:new Date().toISOString()}).catch(()=>{});
            await liveEvent({workspace_id:workspace.id,competitor_id:competitor.id,event_type:"new_competitor",severity:severityFor(threat),title:`New competitor detected: ${name}`,summary:`${relatedProduct||"Related product"} · ${productOverlap}% product overlap · ${threat}% provisional threat. ${entity.relationship_reason||reason}`,source_url:url,confidence:relationConfidence,impact_score:threat,dedupe_key:`new_competitor:${competitor.id}`});
          }
        }

        if(!extracted.length){
          const key=sourceKey(url);
          const existingSource=(await sbSelect(`radar_candidates?workspace_id=eq.${workspace.id}&domain=eq.${encodeURIComponent(key)}&select=id&limit=1`).catch(()=>[]))[0];
          if(!existingSource)await sbInsert("radar_candidates",{workspace_id:workspace.id,source_query:"continuous_firecrawl_monitor",title,url,domain:key,description:reason,provisional_score:0,status:"candidate",entity_type:"source",relationship_reason:reason,relation_confidence:0,source_page_url:url,product_overlap_score:0}).catch(()=>{});
          await sbInsert("radar_evidence",{workspace_id:workspace.id,competitor_id:null,source_url:url,source_type:"discovery_source",title,fact:reason,summary:diffText||"Public source detected. No verified company entity extracted yet.",confidence}).catch(()=>{});
          processed++;
          continue;
        }
      }

      if(!competitor&&monitor.monitor_type==="entity_surveillance")continue;
      const recentEvidence=await sbSelect(`radar_evidence?workspace_id=eq.${workspace.id}&source_url=eq.${encodeURIComponent(url)}&source_type=eq.${monitor.monitor_type==="entity_surveillance"?"competitor_change":"continuous_web_monitor"}&select=id,observed_at&order=observed_at.desc&limit=1`).catch(()=>[]);
      const duplicateRecent=recentEvidence[0]?.observed_at&&Date.now()-new Date(recentEvidence[0].observed_at).getTime()<15*60*1000;
      if(duplicateRecent)continue;

      await sbInsert("radar_evidence",{workspace_id:workspace.id,competitor_id:competitor?.id||null,source_url:url,source_type:monitor.monitor_type==="entity_surveillance"?"competitor_change":"continuous_web_monitor",title,fact:reason,summary:diffText||"New public information detected by continuous monitoring.",confidence});
      const impact=competitor?Math.max(55,Math.round(Number(competitor.threat_score||0))):55;
      const signalTitle=competitor?`${competitor.name}: ${reason.slice(0,120)}`:`New competitive source: ${title}`;
      await sbInsert("radar_signals",{workspace_id:workspace.id,competitor_id:competitor?.id||null,signal_type:monitor.monitor_type==="entity_surveillance"?"competitor_change":competitor?"new_competitor":"new_web_candidate",title:signalTitle,summary:diffText||reason,impact_score:impact,confidence,status:"new"});
      await liveEvent({workspace_id:workspace.id,competitor_id:competitor?.id||null,event_type:monitor.monitor_type==="entity_surveillance"?"competitor_change":"market_signal",severity:severityFor(impact),title:signalTitle,summary:diffText||reason,source_url:url,confidence,impact_score:impact,dedupe_key:`event:${monitor.id}:${url}:${reason.slice(0,100)}`});
      if(competitor&&impact>=65){
        const existingRec=await sbSelect(`radar_recommendations?workspace_id=eq.${workspace.id}&competitor_id=eq.${competitor.id}&status=eq.open&select=id,created_at&order=created_at.desc&limit=1`).catch(()=>[]);
        const fresh=existingRec[0]?.created_at&&Date.now()-new Date(existingRec[0].created_at).getTime()<24*60*60*1000;
        if(!fresh)await sbInsert("radar_recommendations",{workspace_id:workspace.id,competitor_id:competitor.id,priority:impact>=85?"high":"medium",title:`Review ${competitor.related_product||competitor.name}`,rationale:reason,action:"Review the verified product overlap, source evidence and strongest competitive dimensions before deciding whether roadmap, positioning, pricing or go-to-market requires a response.",status:"open"}).catch(()=>{});
      }
      processed++;
    }
    return NextResponse.json({ok:true,type,processed,promoted,monitor_type:monitor.monitor_type,competitor_id:boundCompetitor?.id||null});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Webhook processing failed"},{status:500})}
}
