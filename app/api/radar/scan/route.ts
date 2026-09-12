import { NextResponse } from "next/server";
import { sbInsert, sbSelect, sbUpdate } from "@/lib/radar-db";
import { createMonitor, searchWeb } from "@/lib/firecrawl";
import { workspaceForRequest } from "@/lib/radar-workspace";

function normalizeTerms(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).flatMap(x => x.split(/[,;|]/)).map(x => x.trim().toLowerCase()).filter(x => x.length > 2);
  return String(value || "").split(/[,;|\n]/).map(x => x.trim().toLowerCase()).filter(x => x.length > 2);
}
function termScore(text: string, terms: string[]) { const unique=[...new Set(terms)]; return unique.length?Math.round((unique.filter(term=>text.includes(term)).length/unique.length)*100):0; }
function classify(score:number, productOverlap:number){ if(productOverlap>=78&&score>=62)return"direct"; if(productOverlap>=55||score>=55)return"adjacent"; if(productOverlap>=32||score>=30)return"micro"; return"emerging"; }
function domainOf(raw:string){ try{return new URL(raw).hostname.replace(/^www\./,"").toLowerCase()}catch{return""} }

export async function POST(req: Request) {
  try {
    const { workspace } = await workspaceForRequest(req, true);
    const body = await req.json();
    const competitorId = body?.competitorId;
    const quick = Boolean(body?.quick);
    const competitors = await sbSelect(`radar_competitors?id=eq.${encodeURIComponent(competitorId)}&workspace_id=eq.${workspace.id}&select=*`);
    const competitor = competitors[0];
    if (!competitor?.website) return NextResponse.json({ error:"Competitor not found in this workspace." },{status:404});
    const domain=domainOf(competitor.website);
    if(!domain) return NextResponse.json({error:"Competitor website is invalid."},{status:400});
    if(competitor.last_scanned_at&&Date.now()-new Date(competitor.last_scanned_at).getTime()<3*60*1000) return NextResponse.json({error:"This competitor was deep-scanned recently. Wait a few minutes before scanning again.",cooldown:true},{status:429});

    const run=(await sbInsert("radar_scan_runs",{workspace_id:workspace.id,competitor_id:competitor.id,run_type:"deep_public_scan",status:"running"}))[0];
    const relatedProduct=String(competitor.related_product||"").trim();
    const founderProducts=normalizeTerms(workspace.product_keywords).slice(0,4).join(" ");
    const founderFeatures=[...normalizeTerms(workspace.major_features),...normalizeTerms(workspace.capability_keywords)].slice(0,5).join(" ");
    const productAnchor=relatedProduct||founderProducts||competitor.name;
    const queries=quick
      ? [
          `site:${domain} ${productAnchor} product features`,
          `site:${domain} ${productAnchor} pricing customers use case`,
          `site:${domain} ${founderProducts} ${founderFeatures}`,
        ]
      : [
          `site:${domain} ${productAnchor} product features capabilities`,
          `site:${domain} ${productAnchor} pricing plans packaging`,
          `site:${domain} ${productAnchor} customers use cases creators`,
          `site:${domain} ${productAnchor} docs technology AI autonomous`,
          `site:${domain} ${productAnchor} integrations partners launch`,
          `site:${domain} ${founderProducts} ${founderFeatures}`,
        ];

    const searchSets = await Promise.allSettled(queries.map(q=>searchWeb(q,quick?3:4)));
    const pages:any[]=[]; const seen=new Set<string>();
    for(const set of searchSets){
      if(set.status!=="fulfilled") continue;
      for(const row of set.value){ if(!row?.url||seen.has(row.url)||domainOf(row.url)!==domain)continue; seen.add(row.url);pages.push(row); }
    }
    if(!pages.length) pages.push(...await searchWeb(`${competitor.name} ${relatedProduct||founderProducts} official product`,4));
    const limitedPages = pages.filter(p=>domainOf(p.url)===domain).slice(0,quick?8:18);

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
    const why=limitedPages.length
      ? `${productLabel} has ${productOverlap}% verified product overlap with ${workspace.name}. Overall strategic similarity is ${weighted}% and threat is ${threat}%.${matched.length?` Shared evidence includes ${matched.slice(0,8).join(", ")}.`:""}`
      : `RADAR could not verify enough first-party product evidence from ${competitor.name}. Keep this company provisional until stronger evidence is available.`;

    const evidenceRows = limitedPages.slice(0,quick?6:10).map(page=>({workspace_id:workspace.id,competitor_id:competitor.id,source_url:page.url,source_type:"first_party_product_scan",title:String(page.title||`${competitor.name} product page`).slice(0,200),fact:String(page.description||`First-party page related to ${productLabel}.`).slice(0,1000),summary:String(page.markdown||page.description||"").replace(/\s+/g," ").slice(0,2200),confidence}));
    if(evidenceRows.length) await sbInsert("radar_evidence",evidenceRows);

    const dims={problem_overlap:problem,customer_overlap:customer,buyer_overlap:buyer,product_overlap:productOverlap,workflow_overlap:workflow,feature_overlap:feature,technology_overlap:technology,business_model_overlap:business,distribution_overlap:distribution,geography_overlap:geography,updated_at:new Date().toISOString()};
    const existingDims=await sbSelect(`radar_similarity_dimensions?competitor_id=eq.${competitor.id}&select=id`);
    if(existingDims[0]) await sbUpdate("radar_similarity_dimensions",`id=eq.${existingDims[0].id}`,dims); else await sbInsert("radar_similarity_dimensions",{competitor_id:competitor.id,...dims});

    await Promise.all([
      sbUpdate("radar_competitors",`id=eq.${competitor.id}`,{previous_similarity_score:previous,similarity_score:weighted,product_overlap_score:productOverlap,relation_confidence:Math.max(Number(competitor.relation_confidence||0),confidence),threat_score:threat,momentum_score:Math.min(100,momentumBase+Math.abs(weighted-previous)),movement,category,why_it_matters:why,last_scanned_at:new Date().toISOString(),updated_at:new Date().toISOString()}),
      sbInsert("radar_signals",{workspace_id:workspace.id,competitor_id:competitor.id,signal_type:movement==="closer"?"competitive_convergence":"product_intelligence",title:movement==="closer"?`${competitor.name} moved closer through ${productLabel}`:`${competitor.name}: ${productOverlap}% product overlap`,summary:why,impact_score:threat,confidence,status:"new"}),
      (productOverlap>=35||weighted>=45||movement==="closer") ? sbInsert("radar_recommendations",{workspace_id:workspace.id,competitor_id:competitor.id,priority:productOverlap>=75||threat>=80?"high":productOverlap>=50||weighted>=55?"medium":"low",title:`Review ${competitor.name}'s ${productLabel}`,rationale:why,action:productOverlap>=70?"Compare product promise, autonomous capabilities, target user, pricing, camera/AI workflow and differentiation before the next product or GTM decision.":"Review the overlapping product capabilities and decide whether this product belongs in active surveillance."}) : Promise.resolve(null),
    ]);

    let monitorActive = false;
    if(!quick){
      const existingMonitor=await sbSelect(`radar_monitors?workspace_id=eq.${workspace.id}&competitor_id=eq.${competitor.id}&monitor_type=eq.entity_surveillance&status=eq.active&select=id&limit=1`);
      monitorActive = Boolean(existingMonitor[0]);
      if(!existingMonitor[0]&&limitedPages.length){
        const urls=[...new Set(limitedPages.map(p=>p.url).filter((u:string)=>domainOf(u)===domain))].slice(0,10);
        const schedule=threat>=80?"every 6 hours":threat>=55?"every 12 hours":"daily";
        const secret=process.env.RADAR_API_SECRET||"";
        const created=await createMonitor({name:`RADAR · ${competitor.name} · ${productLabel}`,schedule:{text:schedule,timezone:"UTC"},targets:[{type:"scrape",urls,scrapeOptions:{}}],goal:`Watch ${competitor.name}'s ${productLabel} for meaningful changes in product capabilities, autonomous behavior, AI/technology, target customers, use cases, camera/creator workflow, pricing, positioning, launches and partnerships. Ignore unrelated products and cosmetic page edits.`,judgeEnabled:true,webhook:{url:`${new URL(req.url).origin}/api/radar/firecrawl-webhook`,events:["monitor.page","monitor.check.completed"],headers:secret?{"x-radar-webhook-secret":secret}:undefined}});
        const providerId=created?.id||created?.data?.id||created?.monitor?.id;
        await sbInsert("radar_monitors",{workspace_id:workspace.id,competitor_id:competitor.id,provider:"firecrawl",provider_monitor_id:providerId||null,monitor_type:"entity_surveillance",name:`Product surveillance: ${competitor.name} · ${productLabel}`,schedule_text:schedule,goal:`Meaningful changes to ${productLabel}`,status:"active"});
        monitorActive = true;
      }
    }

    await sbUpdate("radar_scan_runs",`id=eq.${run.id}`,{status:"completed",pages_scanned:limitedPages.length,findings:matched.length,finished_at:new Date().toISOString()});
    return NextResponse.json({similarity:weighted,product_overlap:productOverlap,threat,movement,category,matched,dimensions:dims,why,pages_scanned:limitedPages.length,monitor_active:monitorActive,quick,confidence});
  } catch (error) {
    if(error instanceof Error&&error.message==="UNAUTHORIZED") return NextResponse.json({error:"Unauthorized"},{status:401});
    return NextResponse.json({error:error instanceof Error?error.message:"Scan failed"},{status:500});
  }
}
