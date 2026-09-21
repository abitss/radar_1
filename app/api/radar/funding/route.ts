import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { engineSearchWeb } from "@/lib/radar-engine-search";
import { radarEngineAIConfigured, radarEngineJson } from "@/lib/radar-engine-ai";
import { sbInsert, sbSelect, sbUpdate } from "@/lib/radar-db";
import { companyBrainReadiness, companyBrainSummary } from "@/lib/radar-profile";
import { conciseDiscoveryTerms, cleanDiscoveryQuery } from "@/lib/radar-discovery-quality";
import { workspaceForRequest } from "@/lib/radar-workspace";

export const runtime="nodejs";
export const dynamic="force-dynamic";

type FundingType="grant"|"equity"|"accelerator"|"challenge"|"incubator"|"loan"|"other";
type FundingStatus="open"|"upcoming"|"rolling"|"unknown"|"closed";
type PipelineStatus="new"|"saved"|"preparing"|"applied"|"interview"|"awarded"|"rejected"|"ignored";

function terms(value:unknown){return conciseDiscoveryTerms(value,24)}
function compactGeo(value:unknown){
  const raw=String(value||"").replace(/\s+/g," ").trim();
  if(!raw)return"";
  const first=raw.split(/[.;]/)[0].trim();
  return (first||raw).slice(0,80);
}
function cleanFundingGoal(value:unknown,founderGoal:unknown){
  const raw=String(value||"").replace(/\s+/g," ").trim().slice(0,400);
  if(!raw)return"";
  if(raw===String(founderGoal||"").replace(/\s+/g," ").trim().slice(0,400))return"";
  if(/competitor|competitive|market white space|pricing changes|school partnerships|technology trends/i.test(raw)&&!/grant|fund|raise|capital|seed|equity|non-dilutive|investment/i.test(raw))return"";
  return raw;
}
function clamp(value:unknown,fallback=0){const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(100,Math.round(n))):fallback}
function cleanArray(value:unknown,max=8){
  if(!Array.isArray(value))return[];
  const seen=new Set<string>(),out:string[]=[];
  for(const row of value){const text=String(row||"").replace(/\s+/g," ").trim().slice(0,320);if(!text)continue;const key=text.toLowerCase();if(seen.has(key))continue;seen.add(key);out.push(text);if(out.length>=max)break}
  return out;
}
function safeType(value:unknown):FundingType{
  const v=String(value||"").toLowerCase();
  return(["grant","equity","accelerator","challenge","incubator","loan","other"] as const).includes(v as FundingType)?v as FundingType:"other";
}
function safeStatus(value:unknown):FundingStatus{
  const v=String(value||"").toLowerCase();
  return(["open","upcoming","rolling","unknown","closed"] as const).includes(v as FundingStatus)?v as FundingStatus:"unknown";
}
function safePipeline(value:unknown):PipelineStatus|null{
  const v=String(value||"").toLowerCase();
  return(["new","saved","preparing","applied","interview","awarded","rejected","ignored"] as const).includes(v as PipelineStatus)?v as PipelineStatus:null;
}
function domain(raw:string){try{return new URL(raw).hostname.replace(/^www\./,"").toLowerCase()}catch{return""}}
function fingerprint(name:string,organization:string,url:string){
  return createHash("sha256").update(`${name.trim().toLowerCase()}|${organization.trim().toLowerCase()}|${domain(url)}`).digest("hex");
}
function deadlineDate(raw:unknown){
  const text=String(raw||"").trim();
  const m=text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if(!m)return null;
  const d=new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
  if(Number.isNaN(d.getTime()))return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}
function buildQueries(workspace:any,preferences:any){
  const product=terms(workspace.product_keywords).slice(0,4);
  const tech=terms(workspace.technology_keywords).slice(0,4);
  const industry=terms(`${workspace.industry||""},${workspace.sub_category||""}`).slice(0,3);
  const geography=compactGeo(preferences?.geography||workspace.geography||workspace.founder_country||"");
  const stage=String(preferences?.stage||"").replace(/\s+/g," ").trim().slice(0,60);
  const q=new Set<string>();
  const core=[...industry,...product].filter(Boolean).slice(0,4).join(" ");
  if(core){
    q.add(`${core} startup grant open call ${geography}`.trim());
    q.add(`${core} startup funding program accelerator ${geography}`.trim());
    q.add(`${core} seed fund venture capital ${geography}`.trim());
    q.add(`${core} innovation challenge startup funding ${geography}`.trim());
  }
  if(tech.length){
    q.add(`${tech.slice(0,2).join(" ")} startup grant accelerator ${geography}`.trim());
    q.add(`${tech.slice(0,2).join(" ")} deep tech funding program startup ${geography}`.trim());
  }
  if(geography){
    q.add(`${geography} startup grant government innovation fund open applications`);
    q.add(`${geography} startup accelerator seed funding applications open`);
    q.add(`${geography} startup incubator grant funding call`);
  }
  if(stage)q.add(`${stage} startup funding grant accelerator ${geography} ${industry[0]||""}`.trim());
  q.add(`startup non dilutive funding grants open applications ${core} ${geography}`.trim());
  return [...q].map(x=>cleanDiscoveryQuery(x,180)).filter(Boolean).slice(0,10);
}
async function collectEvidence(queries:string[]){
  const settled=await Promise.allSettled(queries.map(async query=>({query,rows:await engineSearchWeb(query,8)})));
  const map=new Map<string,any>();
  for(const item of settled){
    if(item.status!=="fulfilled")continue;
    for(const row of item.value.rows){
      const url=String(row?.url||"");if(!url||map.has(url))continue;
      map.set(url,{id:`e${map.size+1}`,query:item.value.query,title:String(row?.title||domain(url)||"Source").slice(0,240),description:String(row?.description||row?.markdown||"").replace(/\s+/g," ").trim().slice(0,1600),url});
      if(map.size>=80)break;
    }
    if(map.size>=80)break;
  }
  return [...map.values()];
}
function serialize(row:any){
  return {
    id:row.id,name:row.name,organization:row.organization,type:row.funding_type,status:row.availability_status,pipeline_status:row.pipeline_status,
    fit_score:Number(row.fit_score||0),fit_reasons:Array.isArray(row.fit_reasons)?row.fit_reasons:[],summary:row.summary||"",amount:row.amount||null,equity:row.equity||null,
    deadline:row.deadline_text||null,deadline_at:row.deadline_at||null,geography:row.geography||null,stage:row.stage||null,sector:row.sector||null,
    eligibility:Array.isArray(row.eligibility)?row.eligibility:[],next_action:row.next_action||"",source_url:row.source_url,source_title:row.source_title||null,
    founder_note:row.founder_note||null,owner:row.owner||null,first_seen_at:row.first_seen_at,last_seen_at:row.last_seen_at,last_verified_at:row.last_verified_at,updated_at:row.updated_at
  };
}
function stats(rows:any[]){
  const active=rows.filter(r=>r.pipeline_status!=="ignored");
  return {
    total:active.length,
    grants:active.filter(x=>x.funding_type==="grant").length,
    equity:active.filter(x=>x.funding_type==="equity").length,
    accelerators:active.filter(x=>["accelerator","incubator","challenge"].includes(x.funding_type)).length,
    open:active.filter(x=>["open","rolling"].includes(x.availability_status)).length,
    high_fit:active.filter(x=>Number(x.fit_score||0)>=80).length,
    applied:active.filter(x=>["applied","interview"].includes(x.pipeline_status)).length,
    awarded:active.filter(x=>x.pipeline_status==="awarded").length,
    tracked:active.filter(x=>["saved","preparing","applied","interview","awarded"].includes(x.pipeline_status)).length
  };
}

export async function GET(req:Request){
  try{
    const {workspace}=await workspaceForRequest(req,true);
    const [prefs,opportunities,scans]=await Promise.all([
      sbSelect(`radar_funding_preferences?workspace_id=eq.${workspace.id}&select=*&limit=1`).catch(()=>[]),
      sbSelect(`radar_funding_opportunities?workspace_id=eq.${workspace.id}&select=*&order=fit_score.desc,last_seen_at.desc&limit=300`).catch(()=>[]),
      sbSelect(`radar_funding_scans?workspace_id=eq.${workspace.id}&select=id,status,evidence_count,opportunity_count,warning,error,started_at,finished_at&order=started_at.desc&limit=10`).catch(()=>[])
    ]);
    return NextResponse.json({
      ok:true,configured:radarEngineAIConfigured(),company_brain:companyBrainReadiness(workspace),profile:companyBrainSummary(workspace),
      preferences:prefs[0]?{...prefs[0],geography:compactGeo(prefs[0].geography||workspace.geography||workspace.founder_country||""),funding_goal:cleanFundingGoal(prefs[0].funding_goal,workspace.founder_goal)}:null,opportunities:opportunities.map(serialize),stats:stats(opportunities),scans,last_scan:scans[0]||null
    });
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});
    return NextResponse.json({error:error instanceof Error?error.message:"Funding RADAR failed"},{status:500});
  }
}

export async function POST(req:Request){
  const started=Date.now();let scan:any=null;
  try{
    const {workspace}=await workspaceForRequest(req,true);
    const readiness=companyBrainReadiness(workspace);
    if(!readiness.ready)return NextResponse.json({error:`Complete the Company Brain first. Missing: ${readiness.missing.join(", ")}.`,company_brain:readiness},{status:400});
    if(!radarEngineAIConfigured())return NextResponse.json({error:"RADAR AI is not configured."},{status:503});

    const body:any=await req.json().catch(()=>({}));
    const requestedType=String(body?.type||"all").toLowerCase();
    const preferences={
      type:["all","grant","equity","accelerator","challenge","incubator","loan","other"].includes(requestedType)?requestedType:"all",
      stage:String(body?.stage||"").trim().slice(0,100),
      geography:compactGeo(body?.geography||workspace.geography||workspace.founder_country||""),
      funding_goal:cleanFundingGoal(body?.funding_goal,workspace.founder_goal),
      include_closed:Boolean(body?.include_closed)
    };
    const existingPref=await sbSelect(`radar_funding_preferences?workspace_id=eq.${workspace.id}&select=workspace_id&limit=1`).catch(()=>[]);
    const prefRow={funding_type:preferences.type,stage:preferences.stage||null,geography:preferences.geography||null,funding_goal:preferences.funding_goal||null,include_closed:preferences.include_closed,updated_at:new Date().toISOString()};
    if(existingPref[0])await sbUpdate("radar_funding_preferences",`workspace_id=eq.${workspace.id}`,prefRow);
    else await sbInsert("radar_funding_preferences",{workspace_id:workspace.id,...prefRow});

    const queries=buildQueries(workspace,preferences);
    scan=(await sbInsert("radar_funding_scans",{workspace_id:workspace.id,status:"running",preferences,queries,started_at:new Date().toISOString()}))[0];
    const evidence=await collectEvidence(queries);
    if(!evidence.length){
      const warning="No current public funding sources were returned by the configured search providers.";
      await sbUpdate("radar_funding_scans",`id=eq.${scan.id}`,{status:"completed",evidence_count:0,opportunity_count:0,warning,finished_at:new Date().toISOString()});
      const stored=await sbSelect(`radar_funding_opportunities?workspace_id=eq.${workspace.id}&select=*&order=fit_score.desc,last_seen_at.desc&limit=300`).catch(()=>[]);
      return NextResponse.json({ok:true,opportunities:stored.map(serialize),stats:stats(stored),queries,evidence_count:0,warning,scan_id:scan.id,generated_at:new Date().toISOString(),duration_ms:Date.now()-started});
    }

    const founderContext={...companyBrainSummary(workspace),founder_country:workspace.founder_country||null,founder_goal:workspace.founder_goal||null,public_team_facts:workspace.public_team_facts||null,funding_preferences:preferences};
    const today=new Date().toISOString().slice(0,10);
    const prompt=`You are RADAR Funding Intelligence. Match CURRENT funding and grant opportunities to one founder using only the supplied public-web evidence plus live-web verification when needed.

DATE: ${today}

FOUNDER COMPANY BRAIN:
${JSON.stringify(founderContext,null,2)}

PUBLIC-WEB EVIDENCE:
${JSON.stringify(evidence,null,2)}

Return JSON exactly:
{"opportunities":[{"name":"","organization":"","type":"grant|equity|accelerator|challenge|incubator|loan|other","status":"open|upcoming|rolling|unknown|closed","fit_score":0,"fit_reasons":[],"summary":"","amount":null,"equity":null,"deadline":null,"geography":null,"stage":null,"sector":null,"eligibility":[],"next_action":"","source_id":"e1"}]}

Rules:
- Personalize to this Company Brain. Do not return a generic funding directory.
- Prefer OPEN, UPCOMING or ROLLING opportunities.
- Never invent deadline, amount, equity terms, eligibility, geography, stage or status. Use null/unknown if unsupported.
- Every opportunity MUST cite exactly one supplied source_id supporting existence. Prefer official program/fund pages.
- fit_score is startup-specific fit, not prestige.
- Do not say the founder is eligible unless evidence establishes it. State what must be verified.
- Deduplicate the same program/fund.
- Return at most 24, highest fit first.`;

    const analyzed=await radarEngineJson(prompt,{feature:"funding_match",web:true,maxTokens:5200,temperature:0.04});
    const evidenceById=new Map(evidence.map((row:any)=>[String(row.id),row]));
    const raw=Array.isArray(analyzed.data?.opportunities)?analyzed.data.opportunities:[];
    const seen=new Set<string>(),now=new Date().toISOString();
    let persisted=0;
    for(const item of raw){
      const source:any=evidenceById.get(String(item?.source_id||""));if(!source)continue;
      const name=String(item?.name||"").replace(/\s+/g," ").trim().slice(0,240);
      const organization=String(item?.organization||"").replace(/\s+/g," ").trim().slice(0,200);
      if(!name||!organization)continue;
      const availability=safeStatus(item?.status);
      if(availability==="closed"&&!preferences.include_closed)continue;
      const type=safeType(item?.type);
      if(preferences.type!=="all"&&preferences.type!==type)continue;
      const key=fingerprint(name,organization,String(source.url));if(seen.has(key))continue;seen.add(key);
      const existing=(await sbSelect(`radar_funding_opportunities?workspace_id=eq.${workspace.id}&fingerprint=eq.${key}&select=id,pipeline_status,founder_note,owner,first_seen_at&limit=1`).catch(()=>[]))[0];
      const row={
        workspace_id:workspace.id,fingerprint:key,name,organization,funding_type:type,availability_status:availability,fit_score:clamp(item?.fit_score,50),
        fit_reasons:cleanArray(item?.fit_reasons,5),summary:String(item?.summary||"").replace(/\s+/g," ").trim().slice(0,1400),
        amount:item?.amount?String(item.amount).slice(0,240):null,equity:item?.equity?String(item.equity).slice(0,240):null,
        deadline_text:item?.deadline?String(item.deadline).slice(0,160):null,deadline_at:deadlineDate(item?.deadline),
        geography:item?.geography?String(item.geography).slice(0,200):null,stage:item?.stage?String(item.stage).slice(0,200):null,sector:item?.sector?String(item.sector).slice(0,200):null,
        eligibility:cleanArray(item?.eligibility,7),next_action:String(item?.next_action||"Review the official source and verify current eligibility before applying.").replace(/\s+/g," ").trim().slice(0,600),
        source_url:String(source.url),source_title:String(source.title),source_domain:domain(String(source.url)),scan_preferences:preferences,last_seen_at:now,last_verified_at:now,updated_at:now
      };
      if(existing)await sbUpdate("radar_funding_opportunities",`id=eq.${existing.id}&workspace_id=eq.${workspace.id}`,row);
      else await sbInsert("radar_funding_opportunities",{...row,pipeline_status:"new",first_seen_at:now});
      persisted++;
      if(persisted>=24)break;
    }

    const stored=await sbSelect(`radar_funding_opportunities?workspace_id=eq.${workspace.id}&select=*&order=fit_score.desc,last_seen_at.desc&limit=300`);
    await sbUpdate("radar_funding_scans",`id=eq.${scan.id}`,{status:"completed",evidence_count:evidence.length,opportunity_count:persisted,provider:analyzed.provider||null,model:analyzed.model||null,finished_at:new Date().toISOString()});
    return NextResponse.json({ok:true,mode:"persistent-live-funding",profile:founderContext,preferences,queries,evidence_count:evidence.length,opportunities:stored.map(serialize),stats:stats(stored),provider:analyzed.provider,model:analyzed.model,scan_id:scan.id,generated_at:new Date().toISOString(),duration_ms:Date.now()-started});
  }catch(error){
    if(scan?.id)await sbUpdate("radar_funding_scans",`id=eq.${scan.id}`,{status:"failed",error:error instanceof Error?error.message.slice(0,800):"Funding scan failed",finished_at:new Date().toISOString()}).catch(()=>{});
    if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});
    return NextResponse.json({error:error instanceof Error?error.message:"Funding intelligence scan failed",duration_ms:Date.now()-started},{status:500});
  }
}

export async function PATCH(req:Request){
  try{
    const {workspace}=await workspaceForRequest(req,true);
    const body:any=await req.json().catch(()=>({}));
    const id=String(body.id||"");
    if(!id)return NextResponse.json({error:"Opportunity is required"},{status:400});
    const current=(await sbSelect(`radar_funding_opportunities?id=eq.${encodeURIComponent(id)}&workspace_id=eq.${workspace.id}&select=*&limit=1`))[0];
    if(!current)return NextResponse.json({error:"Funding opportunity not found"},{status:404});
    const patch:any={updated_at:new Date().toISOString()};
    if(body.pipeline_status!==undefined){const status=safePipeline(body.pipeline_status);if(!status)return NextResponse.json({error:"Invalid pipeline status"},{status:400});patch.pipeline_status=status}
    if(body.founder_note!==undefined)patch.founder_note=String(body.founder_note||"").trim().slice(0,1500)||null;
    if(body.owner!==undefined)patch.owner=String(body.owner||"").trim().slice(0,120)||null;
    const rows=await sbUpdate("radar_funding_opportunities",`id=eq.${id}&workspace_id=eq.${workspace.id}`,patch);
    return NextResponse.json(serialize(rows[0]||current));
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});
    return NextResponse.json({error:error instanceof Error?error.message:"Could not update funding opportunity"},{status:500});
  }
}
