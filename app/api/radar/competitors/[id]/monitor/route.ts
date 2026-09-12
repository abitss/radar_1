import { NextResponse } from "next/server";
import { createMonitor, firecrawlConfigured } from "@/lib/firecrawl";
import { sbInsert, sbSelect, sbUpdate } from "@/lib/radar-db";
import { workspaceForRequest } from "@/lib/radar-workspace";

function normalizeUrl(raw:string){const value=/^https?:\/\//i.test(raw)?raw:`https://${raw}`;const url=new URL(value);return url.origin}

export async function POST(req:Request,context:{params:Promise<{id:string}>}){
  try{
    if(!firecrawlConfigured())return NextResponse.json({error:"FIRECRAWL_API_KEY is not configured."},{status:503});
    const {workspace}=await workspaceForRequest(req,true);
    const {id}=await context.params;
    const rows=await sbSelect(`radar_competitors?id=eq.${encodeURIComponent(id)}&workspace_id=eq.${workspace.id}&select=*&limit=1`);
    const competitor=rows[0];
    if(!competitor)return NextResponse.json({error:"Competitor not found"},{status:404});
    if(!competitor.website)return NextResponse.json({error:"Competitor website is required before monitoring can start."},{status:400});

    const active=await sbSelect(`radar_monitors?workspace_id=eq.${workspace.id}&competitor_id=eq.${competitor.id}&status=eq.active&select=*&limit=1`);
    if(active[0])return NextResponse.json({ok:true,monitor:active[0],alreadyActive:true});

    const origin=new URL(req.url).origin;
    const secret=process.env.RADAR_API_SECRET||"";
    const target=normalizeUrl(competitor.website);
    const threat=Number(competitor.threat_score||0);
    const schedule=threat>=80?"every 6 hours":threat>=60?"every 12 hours":"daily";
    const goal=`Watch ${competitor.name} for meaningful public changes in product, features, pricing, packaging, positioning, customers, partnerships, hiring, technology, geography, launches and go-to-market. Ignore cosmetic or boilerplate changes. Explain only changes that could matter competitively to ${workspace.name}.`;

    const created=await createMonitor({
      name:`RADAR · ${competitor.name} · competitor watch`,
      schedule:{text:schedule,timezone:"UTC"},
      targets:[{type:"scrape",urls:[target]}],
      goal,
      judgeEnabled:true,
      webhook:{url:`${origin}/api/radar/firecrawl-webhook`,events:["monitor.page","monitor.check.completed"],headers:secret?{"x-radar-webhook-secret":secret}:undefined},
    });
    const providerId=created?.id||created?.data?.id||created?.monitor?.id||null;
    const inserted=await sbInsert("radar_monitors",{workspace_id:workspace.id,competitor_id:competitor.id,provider:"firecrawl",provider_monitor_id:providerId,monitor_type:"entity_surveillance",name:`Competitive watch: ${competitor.name}`,schedule_text:schedule,goal,status:"active"});
    await sbUpdate("radar_competitors",`id=eq.${competitor.id}`,{monitoring_preference:"monitor",updated_at:new Date().toISOString()});
    return NextResponse.json({ok:true,monitor:inserted[0]||null});
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});
    return NextResponse.json({error:error instanceof Error?error.message:"Could not activate competitor monitoring"},{status:500});
  }
}
