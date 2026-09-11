import { NextResponse } from "next/server";
import { sbInsert, sbSelect, sbUpdate } from "@/lib/radar-db";

function domainOf(raw:string){try{return new URL(raw).hostname.replace(/^www\./,"").toLowerCase()}catch{return""}}
function flattenEvents(payload:any){const data=payload?.data; if(Array.isArray(data))return data; if(data&&typeof data==="object")return[data]; return[]}

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
    const competitorRows=monitor.competitor_id?await sbSelect(`radar_competitors?id=eq.${monitor.competitor_id}&workspace_id=eq.${workspace.id}&select=*&limit=1`):[];
    const competitor=competitorRows[0]||null;

    let processed=0;
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

      if(monitor.monitor_type==="web_discovery"){
        const existing=await sbSelect(`radar_candidates?workspace_id=eq.${workspace.id}&domain=eq.${encodeURIComponent(domain)}&select=*&limit=1`);
        if(!existing[0]) await sbInsert("radar_candidates",{workspace_id:workspace.id,source_query:"continuous_firecrawl_monitor",title,url,domain,description:reason,provisional_score:20,status:"candidate"});
        else await sbUpdate("radar_candidates",`id=eq.${existing[0].id}`,{url,description:reason,updated_at:new Date().toISOString()});
      }

      await sbInsert("radar_evidence",{workspace_id:workspace.id,competitor_id:competitor?.id||null,source_url:url,source_type:monitor.monitor_type==="entity_surveillance"?"competitor_change":"continuous_web_monitor",title,fact:reason,summary:diffText||"New public information detected by continuous monitoring.",confidence});
      const impact=competitor?Math.max(55,Math.round(Number(competitor.threat_score||0))):55;
      await sbInsert("radar_signals",{workspace_id:workspace.id,competitor_id:competitor?.id||null,signal_type:monitor.monitor_type==="entity_surveillance"?"competitor_change":"new_web_candidate",title:competitor?`${competitor.name}: ${reason.slice(0,120)}`:`New competitive candidate: ${title}`,summary:diffText||reason,impact_score:impact,confidence,status:"new"});

      if(competitor&&impact>=65){
        await sbInsert("radar_recommendations",{workspace_id:workspace.id,competitor_id:competitor.id,priority:impact>=85?"high":"medium",title:`Review new change from ${competitor.name}`,rationale:reason,action:"Review the source diff, determine whether it changes competitive proximity, and decide whether positioning, roadmap, pricing or GTM requires a response."});
        await sbUpdate("radar_competitors",`id=eq.${competitor.id}`,{momentum_score:Math.min(100,Number(competitor.momentum_score||0)+8),updated_at:new Date().toISOString()});
      }
      processed++;
    }
    return NextResponse.json({ok:true,type,processed,monitor_type:monitor.monitor_type,competitor_id:competitor?.id||null});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Webhook processing failed"},{status:500})}
}
