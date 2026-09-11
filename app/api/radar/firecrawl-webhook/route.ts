import { NextResponse } from "next/server";
import { sbInsert, sbSelect, sbUpdate } from "@/lib/radar-db";

function domainOf(raw:string){try{return new URL(raw).hostname.replace(/^www\./,"").toLowerCase()}catch{return""}}
function originOf(raw:string){try{return new URL(raw).origin}catch{return raw}}
function flattenEvents(payload:any){const data=payload?.data; if(Array.isArray(data))return data; if(data&&typeof data==="object")return[data]; return[]}
function normalizeTerms(value:unknown):string[]{if(Array.isArray(value))return value.map(String).flatMap(x=>x.split(/[,;|]/)).map(x=>x.trim().toLowerCase()).filter(x=>x.length>2);return String(value||"").split(/[,;|\n]/).map(x=>x.trim().toLowerCase()).filter(x=>x.length>2)}
function provisionalScore(text:string,workspace:any){const lower=text.toLowerCase();const groups:Array<[string[],number]>=[[normalizeTerms(workspace.product_keywords),28],[normalizeTerms(workspace.capability_keywords),22],[normalizeTerms(workspace.technology_keywords),10],[normalizeTerms(workspace.target_customers),16],[normalizeTerms(workspace.buyer),8],[normalizeTerms(workspace.problem_statement),12],[normalizeTerms(workspace.business_model),4]];let score=0;for(const [items,weight] of groups){const unique=[...new Set(items)];if(!unique.length)continue;score+=(unique.filter(t=>lower.includes(t)).length/unique.length)*weight}return Math.min(100,Math.round(score))}
function categoryFor(score:number){if(score>=80)return"direct";if(score>=55)return"adjacent";if(score>=30)return"micro";return"emerging"}

export async function POST(req:Request){
  try{
    const expected=process.env.RADAR_API_SECRET||"";
    const supplied=req.headers.get("x-radar-webhook-secret")||"";
    if(!expected||supplied!==expected) return NextResponse.json({error:"Unauthorized"},{status:401});

    const payload=await req.json();
    const type=String(payload?.type||"");
    const monitorId=payload?.data?.monitorId||payload?.monitorId||payload?.metadata?.monitorId||null;
    if(!monitorId) return NextResponse.json({ok:true,ignored:"missing_monitor_id"});
    const monitorRows=await sbSelect(`radar_monitors?provider_monitor_id=eq.${encodeURIComponent(String(monitorId))}&select=*&limit=1`);
    const monitor=monitorRows[0];
    if(!monitor) return NextResponse.json({ok:true,ignored:"monitor_not_found"});
    await sbUpdate("radar_monitors",`id=eq.${monitor.id}`,{last_event_at:new Date().toISOString(),updated_at:new Date().toISOString(),last_error:null});
    if(type==="monitor.check.completed") return NextResponse.json({ok:true,type,processed:0});

    const workspaceRows=await sbSelect(`radar_workspaces?id=eq.${monitor.workspace_id}&select=*`);
    const workspace=workspaceRows[0];
    if(!workspace) return NextResponse.json({ok:true,ignored:"workspace_not_found"});
    const ownDomain=domainOf(workspace.website||"");
    const boundCompetitorRows=monitor.competitor_id?await sbSelect(`radar_competitors?id=eq.${monitor.competitor_id}&workspace_id=eq.${workspace.id}&select=*&limit=1`):[];
    const boundCompetitor=boundCompetitorRows[0]||null;

    let processed=0, promoted=0;
    for(const event of flattenEvents(payload)){
      const meaningful=event?.isMeaningful??event?.judgment?.meaningful??true;
      if(!meaningful)continue;
      const url=String(event?.url||event?.sourceUrl||event?.metadata?.url||"");
      const domain=domainOf(url);
      if(!url||!domain||domain===ownDomain)continue;
      const reason=String(event?.judgment?.reason||event?.reason||"A meaningful public change matched this RADAR monitor.").slice(0,2000);
      const diffText=String(event?.diff?.text||event?.content||event?.markdown||"").slice(0,10000);
      const title=String(event?.title||event?.metadata?.title||domain).slice(0,200);
      const confidence=event?.judgment?.confidence==="high"?92:event?.judgment?.confidence==="low"?60:78;
      let competitor=boundCompetitor;

      if(monitor.monitor_type==="web_discovery"){
        const score=provisionalScore(`${title} ${reason} ${diffText}`,workspace);
        const existingCandidate=await sbSelect(`radar_candidates?workspace_id=eq.${workspace.id}&domain=eq.${encodeURIComponent(domain)}&select=*&limit=1`);
        const candidateStatus=score>=24&&confidence>=78?"promoted":"candidate";
        if(!existingCandidate[0]) await sbInsert("radar_candidates",{workspace_id:workspace.id,source_query:"continuous_firecrawl_monitor",title,url,domain,description:reason,provisional_score:score,status:candidateStatus});
        else await sbUpdate("radar_candidates",`id=eq.${existingCandidate[0].id}`,{url,description:reason,provisional_score:Math.max(Number(existingCandidate[0].provisional_score||0),score),status:candidateStatus,updated_at:new Date().toISOString()});

        const existingCompetitor=await sbSelect(`radar_competitors?workspace_id=eq.${workspace.id}&website=eq.${encodeURIComponent(originOf(url))}&select=*&limit=1`);
        if(existingCompetitor[0]) competitor=existingCompetitor[0];
        else if(score>=24&&confidence>=78){
          const rows=await sbInsert("radar_competitors",{workspace_id:workspace.id,name:title.split(/[|–—-]/)[0].trim().slice(0,80)||domain.split(".")[0],website:originOf(url),description:reason,category:categoryFor(score),similarity_score:score,threat_score:Math.min(100,Math.round(score*1.08)),momentum_score:45,movement:"closer",why_it_matters:`Automatically promoted from continuous public-web discovery. Provisional similarity ${score}% with ${confidence}% discovery confidence.`});
          competitor=rows[0]||null; promoted++;
        }
      }

      await sbInsert("radar_evidence",{workspace_id:workspace.id,competitor_id:competitor?.id||null,source_url:url,source_type:monitor.monitor_type==="entity_surveillance"?"competitor_change":"continuous_web_monitor",title,fact:reason,summary:diffText||"New public information detected by continuous monitoring.",confidence});
      const impact=competitor?Math.max(55,Math.round(Number(competitor.threat_score||0))):55;
      await sbInsert("radar_signals",{workspace_id:workspace.id,competitor_id:competitor?.id||null,signal_type:monitor.monitor_type==="entity_surveillance"?"competitor_change":competitor?"new_competitor":"new_web_candidate",title:competitor?`${competitor.name}: ${reason.slice(0,120)}`:`New competitive candidate: ${title}`,summary:diffText||reason,impact_score:impact,confidence,status:"new"});

      if(competitor&&impact>=65){
        await sbInsert("radar_recommendations",{workspace_id:workspace.id,competitor_id:competitor.id,priority:impact>=85?"high":"medium",title:monitor.monitor_type==="web_discovery"?`Investigate newly discovered competitor ${competitor.name}`:`Review new change from ${competitor.name}`,rationale:reason,action:"Review the source evidence, compare the strongest overlap dimensions, and decide whether positioning, roadmap, pricing or GTM requires a response."});
        await sbUpdate("radar_competitors",`id=eq.${competitor.id}`,{momentum_score:Math.min(100,Number(competitor.momentum_score||0)+8),updated_at:new Date().toISOString()});
      }
      processed++;
    }
    return NextResponse.json({ok:true,type,processed,promoted,monitor_type:monitor.monitor_type,competitor_id:boundCompetitor?.id||null});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Webhook processing failed"},{status:500})}
}
