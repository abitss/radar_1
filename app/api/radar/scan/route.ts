import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { sbInsert, sbSelect, sbUpdate } from "@/lib/radar-db";
import { createMonitor, searchWeb } from "@/lib/firecrawl";
import { crawlStartupEngine, sourceTypeForUrl } from "@/lib/radar-engine-crawl";
import { workspaceForRequest } from "@/lib/radar-workspace";

function normalizeTerms(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).flatMap(x => x.split(/[,;|\n]/)).map(x => x.trim().toLowerCase()).filter(x => x.length > 2 && x.length < 100);
  return String(value || "").split(/[,;|\n]/).map(x => x.trim().toLowerCase()).filter(x => x.length > 2 && x.length < 100);
}
function termScore(text: string, terms: string[]) { const unique=[...new Set(terms)]; return unique.length?Math.round((unique.filter(term=>text.includes(term)).length/unique.length)*100):0; }
function classify(score:number, productOverlap:number){ if(productOverlap>=78&&score>=62)return"direct"; if(productOverlap>=55||score>=55)return"adjacent"; if(productOverlap>=32||score>=30)return"substitute"; return"emerging"; }
function domainOf(raw:string){ try{return new URL(raw).hostname.replace(/^www\./,"").toLowerCase()}catch{return""} }
function severityFor(impact:number){return impact>=90?"critical":impact>=75?"high":impact>=55?"watch":"info"}
function changedEnough(previous:number,next:number){return previous===0||Math.abs(next-previous)>=5}
function genericReviewAction(name:string,product:string,high:boolean){return high?`Compare ${name}'s ${product} against your product promise, target customer, workflow, capabilities, pricing, distribution and positioning before the next product or go-to-market decision.`:`Review the overlapping product, customer and workflow evidence and decide whether ${name} belongs in active surveillance.`}

export async function POST(req: Request) {
  let run:any=null;
  try {
    const { workspace } = await workspaceForRequest(req, true);
    const body = await req.json().catch(()=>({}));
    const competitorId = body?.competitorId;
    const quick = Boolean(body?.quick);
    const competitors = await sbSelect(`radar_competitors?id=eq.${encodeURIComponent(competitorId)}&workspace_id=eq.${workspace.id}&select=*`);
    const competitor = competitors[0];
    if (!competitor?.website) return NextResponse.json({ error:"Competitor not found in this workspace." },{status:404});
    const domain=domainOf(competitor.website);
    if(!domain) return NextResponse.json({error:"Competitor website is invalid."},{status:400});
    if(competitor.last_scanned_at&&Date.now()-new Date(competitor.last_scanned_at).getTime()<3*60*1000) return NextResponse.json({error:"This competitor was deep-scanned recently. Wait a few minutes before scanning again.",cooldown:true},{status:429});

    const activeCutoff=new Date(Date.now()-10*60*1000).toISOString();
    const activeRuns=await sbSelect(`radar_scan_runs?workspace_id=eq.${workspace.id}&competitor_id=eq.${competitor.id}&run_type=eq.deep_public_scan&status=eq.running&started_at=gte.${encodeURIComponent(activeCutoff)}&select=id,started_at&order=started_at.asc&limit=1`);
    if(activeRuns[0]) return NextResponse.json({error:"A deep scan is already running for this competitor.",cooldown:true,running:true,run_id:activeRuns[0].id},{status:429});

    run=(await sbInsert("radar_scan_runs",{workspace_id:workspace.id,competitor_id:competitor.id,run_type:"deep_public_scan",status:"running"}))[0];
    const relatedProduct=String(competitor.related_product||"").trim();
    const founderProducts=normalizeTerms(workspace.product_keywords).slice(0,4).join(" ");
    const founderFeatures=[...normalizeTerms(workspace.major_features),...normalizeTerms(workspace.capability_keywords)].slice(0,5).join(" ");
    const founderCustomers=[...normalizeTerms(workspace.target_customers),...normalizeTerms(workspace.buyer)].slice(0,4).join(" ");
    const productAnchor=relatedProduct||founderProducts||competitor.name;

    const pages:any[]=[];
    const seen=new Set<string>();
    let strategicCrawlPages=0;
    try{
      const crawl=await crawlStartupEngine(competitor.website,quick?5:8);
      for(const page of crawl.pages||[]){
        if(!page?.url||domainOf(page.url)!==domain||seen.has(page.url))continue;
        seen.add(page.url);
        pages.push({url:page.url,title:page.title||competitor.name,description:String(page.text||"").slice(0,1200),markdown:String(page.text||"")});
        strategicCrawlPages++;
      }
      for(const feedUrl of crawl.feeds||[]){
        const existingFeed=(await sbSelect(`radar_sources?workspace_id=eq.${workspace.id}&url=eq.${encodeURIComponent(feedUrl)}&select=id&limit=1`))[0];
        if(!existingFeed)await sbInsert("radar_sources",{workspace_id:workspace.id,competitor_id:competitor.id,url:feedUrl,title:`${competitor.name} RSS / Atom feed`,source_type:"rss",reliability:95,priority:80,check_frequency_minutes:60,status:"active",health:"healthy",next_check_at:new Date(Date.now()+60*60000).toISOString()}).catch(()=>{});
      }
    }catch{}

    const rawQueries=quick
      ? [`site:${domain} ${productAnchor} product features`,`site:${domain} ${productAnchor} pricing customers use cases`,`site:${domain} ${founderProducts} ${founderFeatures}`]
      : [`site:${domain} ${productAnchor} product features capabilities`,`site:${domain} ${productAnchor} pricing plans packaging`,`site:${domain} ${productAnchor} customers use cases`,`site:${domain} ${productAnchor} docs technology integrations`,`site:${domain} ${productAnchor} partnerships launch releases`,`site:${domain} ${founderProducts} ${founderFeatures} ${founderCustomers}`];
    const queries=rawQueries.map(q=>q.replace(/\s+/g," ").trim()).filter(q=>q.length>10).slice(0,quick?3:6);

    // Search is supplemental. The direct first-party crawl above is the primary verification path,
    // so a provider quota or temporary outage must not invalidate a healthy scan.
    for(const q of queries){
      try{
        const rows=await searchWeb(q,quick?3:4);
        for(const row of rows){if(!row?.url||seen.has(row.url)||domainOf(row.url)!==domain)continue;seen.add(row.url);pages.push(row)}
      }catch{}
    }
    if(!pages.length){
      try{
        const fallback=await searchWeb(`${competitor.name} ${relatedProduct||founderProducts} official product`,4);
        for(const row of fallback){if(row?.url&&domainOf(row.url)===domain&&!seen.has(row.url)){seen.add(row.url);pages.push(row)}}
      }catch{}
    }

    const limitedPages = pages.filter(p=>domainOf(p.url)===domain).slice(0,quick?8:18);
    if(!limitedPages.length){
      await sbUpdate("radar_scan_runs",`id=eq.${run.id}`,{status:"completed",pages_scanned:0,findings:0,error:"No first-party evidence was available during this scan.",finished_at:new Date().toISOString()});
      return NextResponse.json({ok:true,degraded:true,why:`RADAR could not verify enough first-party evidence from ${competitor.name}. Existing scores were preserved.`,pages_scanned:0,strategic_crawl_pages:strategicCrawlPages,monitor_active:Boolean((await sbSelect(`radar_monitors?workspace_id=eq.${workspace.id}&competitor_id=eq.${competitor.id}&status=eq.active&select=id&limit=1`).catch(()=>[]))[0]),quick,confidence:0});
    }

    const corpus=limitedPages.map(p=>`${p.title||""}\n${p.description||""}\n${p.markdown||""}`).join("\n\n").toLowerCase().slice(0,quick?110000:220000);
    const productTerms=[...normalizeTerms(workspace.product_keywords),...normalizeTerms(relatedProduct)].slice(0,16);
    const capabilityTerms=[...normalizeTerms(workspace.major_features),...normalizeTerms(workspace.capability_keywords)].slice(0,24);
    const techTerms=normalizeTerms(workspace.technology_keywords), customerTerms=normalizeTerms(`${workspace.target_customers||""},${workspace.buyer||""}`), problemTerms=normalizeTerms(workspace.problem_statement), modelTerms=normalizeTerms(workspace.business_model), geoTerms=normalizeTerms(workspace.geography);
    const product=termScore(corpus,productTerms), feature=termScore(corpus,capabilityTerms), technology=termScore(corpus,techTerms), customer=termScore(corpus,customerTerms), problem=termScore(corpus,problemTerms), business=termScore(corpus,modelTerms), geography=termScore(corpus,geoTerms), buyer=customer;
    const workflow=Math.round((product+feature+problem)/3), distribution=Math.round((customer+business)/2);
    const productSeed=Math.max(0,Math.min(100,Number(competitor.product_overlap_score||0)));
    const verifiedProduct=Math.round(product*.65+feature*.25+problem*.10);
    const productOverlap=Math.round(verifiedProduct*.8+productSeed*.2);
    const strategic=Math.round(problem*.16+customer*.12+buyer*.04+product*.18+workflow*.13+feature*.15+technology*.07+business*.03+distribution*.02+geography*.02+productOverlap*.08);
    const weighted=Math.min(100,Math.max(strategic,Math.round(productOverlap*.72+strategic*.28)));
    const previous=Number(competitor.similarity_score||0);
    const movement=previous===0?"stable":weighted>=previous+5?"closer":weighted<=previous-5?"away":"stable";
    const confidence=Math.min(96,limitedPages.length>=8?92:limitedPages.length>=4?84:70);
    const momentumBase=movement==="closer"?65:movement==="away"?25:45;
    const threat=Math.min(100,Math.round(productOverlap*.42+weighted*.34+Math.max(customer,feature,technology)*.14+momentumBase*.10));
    const category=classify(weighted,productOverlap);
    const matched=[...new Set([...productTerms,...capabilityTerms,...techTerms,...customerTerms,...problemTerms])].filter(term=>corpus.includes(term)).slice(0,24);
    const productLabel=relatedProduct||competitor.name;
    const why=`${productLabel} has ${productOverlap}% verified product overlap with ${workspace.name}. Overall strategic similarity is ${weighted}% and threat is ${threat}%.${matched.length?` Shared evidence includes ${matched.slice(0,8).join(", ")}.`:""}`;

    const existingEvidence=await sbSelect(`radar_evidence?workspace_id=eq.${workspace.id}&competitor_id=eq.${competitor.id}&source_type=eq.first_party_product_scan&select=id,source_url&limit=500`).catch(()=>[]);
    const evidenceUrls=new Set(existingEvidence.map((e:any)=>String(e.source_url||"")));
    const evidenceRows = limitedPages.slice(0,quick?6:10).filter(page=>!evidenceUrls.has(page.url)).map(page=>({workspace_id:workspace.id,competitor_id:competitor.id,source_url:page.url,source_type:"first_party_product_scan",title:String(page.title||`${competitor.name} product page`).slice(0,200),fact:String(page.description||`First-party page related to ${productLabel}.`).slice(0,1000),summary:String(page.markdown||page.description||"").replace(/\s+/g," ").slice(0,2200),confidence,claim_type:"fact"}));
    if(evidenceRows.length) await sbInsert("radar_evidence",evidenceRows);

    const existingSources=await sbSelect(`radar_sources?workspace_id=eq.${workspace.id}&competitor_id=eq.${competitor.id}&select=id,url&limit=500`);
    const sourceMap=new Map(existingSources.map((s:any)=>[String(s.url),s]));
    for(const page of limitedPages.slice(0,12)){
      let source:any=sourceMap.get(page.url);
      if(!source){
        const type=sourceTypeForUrl(page.url);
        const rows=await sbInsert("radar_sources",{workspace_id:workspace.id,competitor_id:competitor.id,url:page.url,title:String(page.title||page.url).slice(0,240),source_type:type,reliability:95,priority:type==="pricing"?95:type==="product"||type==="changelog"?90:Math.max(65,threat),check_frequency_minutes:type==="pricing"?120:threat>=75?60:360,status:"active",health:"healthy",next_check_at:new Date(Date.now()+(type==="pricing"?120:threat>=75?60:360)*60000).toISOString()}).catch(()=>[]);
        source=rows[0];if(source)sourceMap.set(page.url,source);
      }
      const text=String(page.markdown||page.description||"").replace(/\s+/g," ").trim().slice(0,60000);
      if(source?.id&&text.length>=80){
        const contentHash=createHash("sha256").update(text).digest("hex");
        const latest=(await sbSelect(`radar_snapshots?source_id=eq.${source.id}&select=id,content_hash&order=fetched_at.desc&limit=1`))[0];
        if(!latest||latest.content_hash!==contentHash)await sbInsert("radar_snapshots",{source_id:source.id,content_hash:contentHash,content_text:text,metadata:{baseline:!latest,title:page.title||"",url:page.url,origin:"deep_scan"}}).catch(()=>{});
      }
    }

    const dims={problem_overlap:problem,customer_overlap:customer,buyer_overlap:buyer,product_overlap:productOverlap,workflow_overlap:workflow,feature_overlap:feature,technology_overlap:technology,business_model_overlap:business,distribution_overlap:distribution,geography_overlap:geography,updated_at:new Date().toISOString()};
    const existingDims=await sbSelect(`radar_similarity_dimensions?competitor_id=eq.${competitor.id}&select=id`);
    if(existingDims[0]) await sbUpdate("radar_similarity_dimensions",`id=eq.${existingDims[0].id}`,dims); else await sbInsert("radar_similarity_dimensions",{competitor_id:competitor.id,...dims});

    await sbUpdate("radar_competitors",`id=eq.${competitor.id}`,{previous_similarity_score:previous,similarity_score:weighted,product_overlap_score:productOverlap,relation_confidence:Math.max(Number(competitor.relation_confidence||0),confidence),threat_score:threat,momentum_score:Math.min(100,momentumBase+Math.abs(weighted-previous)),movement,category,why_it_matters:why,last_scanned_at:new Date().toISOString(),updated_at:new Date().toISOString()});

    const materialChange=movement==="closer"||movement==="away"||changedEnough(previous,weighted);
    if(materialChange){
      await Promise.allSettled([
        sbInsert("radar_signals",{workspace_id:workspace.id,competitor_id:competitor.id,signal_type:movement==="closer"?"competitive_convergence":"product_intelligence",title:movement==="closer"?`${competitor.name} moved closer through ${productLabel}`:`${competitor.name}: ${productOverlap}% product overlap`,summary:why,impact_score:threat,confidence,status:"new"}),
        sbInsert("radar_intelligence_events",{workspace_id:workspace.id,competitor_id:competitor.id,event_type:movement==="closer"?"competitive_convergence":"deep_scan",severity:severityFor(threat),title:movement==="closer"?`${competitor.name} moved closer`:`${competitor.name} intelligence refreshed`,summary:why,source_url:limitedPages[0]?.url||competitor.website,confidence,impact_score:threat,dedupe_key:`deep_scan:${competitor.id}:${new Date().toISOString().slice(0,13)}`}),
      ]);
      if(productOverlap>=35||weighted>=45||movement==="closer"){
        const recentRecommendation=await sbSelect(`radar_recommendations?workspace_id=eq.${workspace.id}&competitor_id=eq.${competitor.id}&status=eq.open&select=id,created_at&order=created_at.desc&limit=1`).catch(()=>[]);
        const fresh=recentRecommendation[0]?.created_at&&Date.now()-new Date(recentRecommendation[0].created_at).getTime()<24*60*60*1000;
        if(!fresh)await sbInsert("radar_recommendations",{workspace_id:workspace.id,competitor_id:competitor.id,priority:productOverlap>=75||threat>=80?"high":productOverlap>=50||weighted>=55?"medium":"low",title:`Review ${competitor.name}'s ${productLabel}`,rationale:why,action:genericReviewAction(competitor.name,productLabel,productOverlap>=70),status:"open"}).catch(()=>{});
      }
    }

    let monitorActive = false;let monitorError:string|null=null;
    const existingMonitor=await sbSelect(`radar_monitors?workspace_id=eq.${workspace.id}&competitor_id=eq.${competitor.id}&status=eq.active&select=id&limit=1`).catch(()=>[]);
    monitorActive=Boolean(existingMonitor[0]);
    if(!quick&&!monitorActive&&limitedPages.length){
      try{
        const urls=[...new Set(limitedPages.map(p=>p.url).filter((u:string)=>domainOf(u)===domain))].slice(0,10);
        const secret=process.env.RADAR_API_SECRET||"";
        const goal=`Watch ${competitor.name}'s ${productLabel} for meaningful changes in product capabilities, pricing, packaging, positioning, target customers, use cases, technology, integrations, distribution, geography, launches, partnerships and customer evidence. Ignore unrelated business lines and cosmetic page edits.`;
        const created=await createMonitor({name:`RADAR · ${competitor.name} · ${productLabel}`,schedule:{text:"every hour",timezone:"UTC"},targets:[{type:"scrape",urls,scrapeOptions:{}}],goal,judgeEnabled:true,webhook:{url:`${new URL(req.url).origin}/api/radar/firecrawl-webhook`,events:["monitor.page","monitor.check.completed"],headers:secret?{"x-radar-webhook-secret":secret}:undefined}});
        const providerId=created?.id||created?.data?.id||created?.monitor?.id;
        await sbInsert("radar_monitors",{workspace_id:workspace.id,competitor_id:competitor.id,provider:"firecrawl",provider_monitor_id:providerId||null,monitor_type:"entity_surveillance",name:`Product surveillance: ${competitor.name} · ${productLabel}`,schedule_text:"every hour",goal,status:"active"});
        await sbUpdate("radar_competitors",`id=eq.${competitor.id}`,{monitoring_preference:"monitor",updated_at:new Date().toISOString()}).catch(()=>{});
        monitorActive = true;
      }catch(error){monitorError=error instanceof Error?error.message:"Monitor activation failed";}
    }

    await sbUpdate("radar_scan_runs",`id=eq.${run.id}`,{status:"completed",pages_scanned:limitedPages.length,findings:matched.length,error:null,finished_at:new Date().toISOString()});
    return NextResponse.json({ok:true,similarity:weighted,product_overlap:productOverlap,threat,movement,category,matched,dimensions:dims,why,pages_scanned:limitedPages.length,strategic_crawl_pages:strategicCrawlPages,monitor_active:monitorActive,monitor_error:monitorError,quick,confidence,evidence_added:evidenceRows.length,material_change:materialChange});
  } catch (error) {
    if(run?.id)try{await sbUpdate("radar_scan_runs",`id=eq.${run.id}`,{status:"failed",error:error instanceof Error?error.message.slice(0,500):"Scan failed",finished_at:new Date().toISOString()})}catch{}
    if(error instanceof Error&&error.message==="UNAUTHORIZED") return NextResponse.json({error:"Unauthorized"},{status:401});
    return NextResponse.json({error:error instanceof Error?error.message:"Scan failed"},{status:500});
  }
}
