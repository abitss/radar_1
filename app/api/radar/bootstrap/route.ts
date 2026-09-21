import { publicRadarError } from "@/lib/radar-errors";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { scrapeCompanyProfile, firecrawlConfigured } from "@/lib/firecrawl";
import { crawlStartupEngine, sourceTypeForUrl } from "@/lib/radar-engine-crawl";
import { analyzeCompanyProfileFromEvidence } from "@/lib/radar-ultimate-ai";
import { sbInsert, sbSelect, sbUpdate } from "@/lib/radar-db";
import { workspaceForRequest } from "@/lib/radar-workspace";

function normalizeUrl(raw:string){
  const input=raw.trim();
  const value=/^https?:\/\//i.test(input)?input:`https://${input}`;
  const url=new URL(value);
  if(!["http:","https:"].includes(url.protocol))throw new Error("Use a public website URL.");
  return url.origin;
}

function stringList(value:any,limit:number){return Array.isArray(value)?value.map(String).map(x=>x.trim()).filter(Boolean).slice(0,limit):[]}
function keepText(incoming:any,current:any){const value=String(incoming??"").trim();return value||String(current??"").trim()}
function keepList(incoming:any,current:any,limit:number){const next=stringList(incoming,limit);return next.length?next:stringList(current,limit)}

export async function POST(req:Request){
  try{
    const {workspace}=await workspaceForRequest(req,true);
    const body=await req.json();
    const website=normalizeUrl(String(body.website||""));

    let crawl:any=null;
    let profile:any={};
    let profileSource="direct_first_party";
    let directError="";

    try{
      crawl=await crawlStartupEngine(website,6);
      if(String(crawl?.combinedText||"").length<500)throw new Error("Direct crawl returned insufficient public text");
      profile=await analyzeCompanyProfileFromEvidence(website,crawl.combinedText);
    }catch(error){
      directError=error instanceof Error?error.message:"Direct first-party crawl failed";
      console.error("RADAR optional website enrichment unavailable",error);
      if(firecrawlConfigured()){
        profileSource="firecrawl_fallback";
        try{const scraped=await scrapeCompanyProfile(website);profile=scraped?.json||scraped?.data?.json||{};}catch{profileSource="unavailable";}
      }else profileSource="unavailable";
    }

    // Website enrichment must be additive. Never erase founder-provided Company Brain
    // fields when a crawl/provider returns an empty or incomplete profile.
    const extractedName=String(profile.company_name||"").trim();
    const name=extractedName||String(workspace.name||"").trim()||new URL(website).hostname.replace(/^www\./,"").split(".")[0]||"My startup";
    const updated=await sbUpdate("radar_workspaces",`id=eq.${workspace.id}`,{
      name,
      website,
      description:keepText(profile.one_line_description,workspace.description),
      industry:keepText(profile.industry,workspace.industry),
      sub_category:keepText(profile.sub_category,workspace.sub_category),
      problem_statement:keepText(profile.problem_statement,workspace.problem_statement),
      target_customers:keepText(profile.target_customers,workspace.target_customers),
      buyer:keepText(profile.buyer,workspace.buyer),
      product_keywords:keepList(profile.product_keywords,workspace.product_keywords,16),
      capability_keywords:keepList(profile.capability_keywords,workspace.capability_keywords,20),
      technology_keywords:keepList(profile.technology_keywords,workspace.technology_keywords,16),
      major_features:keepList(profile.major_features,workspace.major_features,20),
      geography:keepText(profile.geography,workspace.geography),
      business_model:keepText(profile.business_model,workspace.business_model),
      pricing_context:keepText(profile.pricing_context,workspace.pricing_context),
      positioning:keepText(profile.positioning,workspace.positioning),
      public_team_facts:keepText(profile.public_team_facts,workspace.public_team_facts),
      updated_at:new Date().toISOString(),
    });

    let sourcesAdded=0;
    let snapshotsAdded=0;
    if(crawl?.pages?.length){
      const existing=await sbSelect(`radar_sources?workspace_id=eq.${workspace.id}&select=id,url&limit=500`);
      const sourceByUrl=new Map(existing.map((s:any)=>[String(s.url),s]));
      for(const page of crawl.pages.slice(0,12)){
        let source:any=sourceByUrl.get(page.url);
        if(!source){
          const type=sourceTypeForUrl(page.url);
          const rows=await sbInsert("radar_sources",{
            workspace_id:workspace.id,
            competitor_id:null,
            url:page.url,
            title:page.title||page.url,
            source_type:type,
            reliability:95,
            priority:type==="pricing"?95:type==="product"||type==="changelog"?90:75,
            check_frequency_minutes:type==="pricing"?120:360,
            status:"active",
            health:"healthy",
            last_checked_at:new Date().toISOString(),
            last_success_at:new Date().toISOString(),
            next_check_at:new Date(Date.now()+(type==="pricing"?120:360)*60000).toISOString(),
          });
          source=rows[0];
          if(source){sourceByUrl.set(page.url,source);sourcesAdded++}
        }
        if(source?.id&&page.text){
          const hash=createHash("sha256").update(String(page.text)).digest("hex");
          const latest=(await sbSelect(`radar_snapshots?source_id=eq.${source.id}&select=id,content_hash&order=fetched_at.desc&limit=1`))[0];
          if(!latest||latest.content_hash!==hash){
            await sbInsert("radar_snapshots",{source_id:source.id,content_hash:hash,content_text:String(page.text).slice(0,60000),metadata:{baseline:true,title:page.title||"",url:page.url}});
            snapshotsAdded++;
          }
          const evidenceExists=(await sbSelect(`radar_evidence?workspace_id=eq.${workspace.id}&source_url=eq.${encodeURIComponent(page.url)}&competitor_id=is.null&select=id&limit=1`))[0];
          if(!evidenceExists)await sbInsert("radar_evidence",{workspace_id:workspace.id,competitor_id:null,source_url:page.url,source_type:"first_party_company_profile",title:page.title||name,fact:String(page.text).slice(0,1200),summary:"First-party evidence used to build the Company Brain.",confidence:95,claim_type:"fact"});
        }
      }
      for(const feedUrl of (crawl.feeds||[]).slice(0,8)){
        if(sourceByUrl.has(feedUrl))continue;
        const rows=await sbInsert("radar_sources",{workspace_id:workspace.id,competitor_id:null,url:feedUrl,title:"RSS / Atom feed",source_type:"rss",reliability:95,priority:85,check_frequency_minutes:60,status:"active",health:"healthy",next_check_at:new Date(Date.now()+60*60000).toISOString()});
        if(rows[0]){sourceByUrl.set(feedUrl,rows[0]);sourcesAdded++}
      }
    }

    return NextResponse.json({ok:true,workspace:updated[0],source:website,engine:{profile_source:profileSource,first_party_pages:crawl?.pages?.length||0,feeds:crawl?.feeds?.length||0,sources_added:sourcesAdded,snapshots_added:snapshotsAdded,warning:directError?"Website enrichment was incomplete. Your existing Company Brain was preserved.":null}});
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});
    return NextResponse.json({error:publicRadarError(error,"Could not understand startup website")},{status:500});
  }
}
