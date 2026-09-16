import { NextResponse } from "next/server";
import { searchWebFast } from "@/lib/firecrawl";
import { radarEngineAIConfigured, radarEngineJson } from "@/lib/radar-engine-ai";
import { companyBrainReadiness, companyBrainSummary } from "@/lib/radar-profile";
import { workspaceForRequest } from "@/lib/radar-workspace";

export const runtime="nodejs";
export const dynamic="force-dynamic";

type FundingType="grant"|"equity"|"accelerator"|"challenge"|"incubator"|"loan"|"other";
type FundingStatus="open"|"upcoming"|"rolling"|"unknown"|"closed";

type FundingOpportunity={
  name:string;
  organization:string;
  type:FundingType;
  status:FundingStatus;
  fit_score:number;
  fit_reasons:string[];
  summary:string;
  amount:string|null;
  equity:string|null;
  deadline:string|null;
  geography:string|null;
  stage:string|null;
  sector:string|null;
  eligibility:string[];
  next_action:string;
  source_url:string;
  source_title:string;
};

function terms(value:unknown){
  if(Array.isArray(value))return value.map(String).map(x=>x.trim()).filter(Boolean);
  return String(value||"").split(/[,;|\n]/).map(x=>x.trim()).filter(Boolean);
}

function clamp(value:unknown,fallback=0){
  const n=Number(value);
  return Number.isFinite(n)?Math.max(0,Math.min(100,Math.round(n))):fallback;
}

function cleanArray(value:unknown,max=8){
  if(!Array.isArray(value))return[];
  const seen=new Set<string>();
  const out:string[]=[];
  for(const row of value){
    const text=String(row||"").replace(/\s+/g," ").trim().slice(0,320);
    if(!text)continue;
    const key=text.toLowerCase();
    if(seen.has(key))continue;
    seen.add(key);out.push(text);
    if(out.length>=max)break;
  }
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

function buildQueries(workspace:any,preferences:any){
  const product=terms(workspace.product_keywords).slice(0,4);
  const tech=terms(workspace.technology_keywords).slice(0,4);
  const industry=terms(`${workspace.industry||""},${workspace.sub_category||""}`).slice(0,3);
  const geography=String(preferences?.geography||workspace.geography||workspace.founder_country||"").trim();
  const stage=String(preferences?.stage||"").trim();
  const q=new Set<string>();
  const core=[...industry,...product].slice(0,4).join(" ");
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
  return [...q].filter(x=>x.length>8).slice(0,10);
}

function domain(raw:string){try{return new URL(raw).hostname.replace(/^www\./,"").toLowerCase()}catch{return""}}

async function collectEvidence(queries:string[]){
  const settled=await Promise.allSettled(queries.map(async query=>({query,rows:await searchWebFast(query,8)})));
  const map=new Map<string,any>();
  for(const item of settled){
    if(item.status!=="fulfilled")continue;
    for(const row of item.value.rows){
      const url=String(row?.url||"");
      if(!url||map.has(url))continue;
      map.set(url,{id:`e${map.size+1}`,query:item.value.query,title:String(row?.title||domain(url)||"Source").slice(0,240),description:String(row?.description||row?.markdown||"").replace(/\s+/g," ").trim().slice(0,1600),url});
      if(map.size>=80)break;
    }
    if(map.size>=80)break;
  }
  return [...map.values()];
}

export async function GET(req:Request){
  try{
    const {workspace}=await workspaceForRequest(req,true);
    return NextResponse.json({ok:true,configured:radarEngineAIConfigured(),company_brain:companyBrainReadiness(workspace),profile:companyBrainSummary(workspace)});
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});
    return NextResponse.json({error:error instanceof Error?error.message:"Funding RADAR failed"},{status:500});
  }
}

export async function POST(req:Request){
  const started=Date.now();
  try{
    const {workspace}=await workspaceForRequest(req,true);
    const readiness=companyBrainReadiness(workspace);
    if(!readiness.ready)return NextResponse.json({error:`Complete the Company Brain first. Missing: ${readiness.missing.join(", ")}.`,company_brain:readiness},{status:400});
    if(!radarEngineAIConfigured())return NextResponse.json({error:"RADAR AI is not configured."},{status:503});

    const body:any=await req.json().catch(()=>({}));
    const preferences={
      type:String(body?.type||"all").toLowerCase(),
      stage:String(body?.stage||"").trim().slice(0,100),
      geography:String(body?.geography||"").trim().slice(0,120),
      funding_goal:String(body?.funding_goal||"").trim().slice(0,400),
    };
    const queries=buildQueries(workspace,preferences);
    const evidence=await collectEvidence(queries);
    if(!evidence.length)return NextResponse.json({ok:true,opportunities:[],queries,evidence_count:0,generated_at:new Date().toISOString(),duration_ms:Date.now()-started,warning:"No current public funding sources were returned by the configured search providers."});

    const founderContext={...companyBrainSummary(workspace),founder_country:workspace.founder_country||null,founder_goal:workspace.founder_goal||null,public_team_facts:workspace.public_team_facts||null,funding_preferences:preferences};
    const today=new Date().toISOString().slice(0,10);
    const prompt=`You are RADAR Funding Intelligence. Match CURRENT funding and grant opportunities to one founder using only the supplied public-web evidence plus live-web verification when needed.

DATE: ${today}

FOUNDER COMPANY BRAIN:
${JSON.stringify(founderContext,null,2)}

PUBLIC-WEB EVIDENCE:
${JSON.stringify(evidence,null,2)}

Return JSON exactly in this shape:
{"opportunities":[{"name":"program/fund name","organization":"provider","type":"grant|equity|accelerator|challenge|incubator|loan|other","status":"open|upcoming|rolling|unknown|closed","fit_score":0,"fit_reasons":["..."],"summary":"...","amount":"exact public amount/range or null","equity":"equity terms if public or null","deadline":"YYYY-MM-DD, human-readable deadline, rolling, or null","geography":"... or null","stage":"... or null","sector":"... or null","eligibility":["..."],"next_action":"specific founder action","source_id":"e1"}]}

Rules:
- This is personalized matching, not a generic funding list.
- Include grants/non-dilutive funding, accelerators/challenges/incubators with funding, and equity investors/funds when relevant.
- Prefer OPEN, UPCOMING or ROLLING opportunities. Exclude clearly closed opportunities unless they are unusually important and label them closed.
- Never invent a deadline, amount, equity term, eligibility rule, geography, stage or funding status. Use null/unknown when the evidence does not establish it.
- Every opportunity MUST cite exactly one supplied source_id that supports the program/fund existence. Prefer official program/fund pages over news/listicles.
- fit_score measures fit to this specific Company Brain, stage, sector, geography, technology and founder goal, not prestige.
- fit_reasons must explain specific matching dimensions.
- For equity investors, only claim stage/sector/geography if supported by evidence.
- Do not claim the founder is eligible when evidence is incomplete. Say what must be verified.
- Deduplicate the same program/fund across multiple sources.
- Return at most 24 opportunities, ordered by fit_score descending.`;

    const analyzed=await radarEngineJson(prompt,{feature:"funding_match",web:true,maxTokens:5200,temperature:0.04});
    const evidenceById=new Map(evidence.map((row:any)=>[String(row.id),row]));
    const raw=Array.isArray(analyzed.data?.opportunities)?analyzed.data.opportunities:[];
    const seen=new Set<string>();
    const opportunities:FundingOpportunity[]=[];
    for(const item of raw){
      const source=evidenceById.get(String(item?.source_id||""));
      if(!source)continue;
      const name=String(item?.name||"").replace(/\s+/g," ").trim().slice(0,240);
      const organization=String(item?.organization||"").replace(/\s+/g," ").trim().slice(0,200);
      if(!name||!organization)continue;
      const key=`${name}|${organization}`.toLowerCase();
      if(seen.has(key))continue;
      seen.add(key);
      const status=safeStatus(item?.status);
      if(status==="closed"&&!Boolean(body?.include_closed))continue;
      const type=safeType(item?.type);
      if(preferences.type!=="all"&&preferences.type!==type)continue;
      opportunities.push({
        name,organization,type,status,fit_score:clamp(item?.fit_score,50),fit_reasons:cleanArray(item?.fit_reasons,5),summary:String(item?.summary||"").replace(/\s+/g," ").trim().slice(0,1400),amount:item?.amount?String(item.amount).slice(0,240):null,equity:item?.equity?String(item.equity).slice(0,240):null,deadline:item?.deadline?String(item.deadline).slice(0,160):null,geography:item?.geography?String(item.geography).slice(0,200):null,stage:item?.stage?String(item.stage).slice(0,200):null,sector:item?.sector?String(item.sector).slice(0,200):null,eligibility:cleanArray(item?.eligibility,7),next_action:String(item?.next_action||"Review the official source and verify current eligibility before applying.").replace(/\s+/g," ").trim().slice(0,600),source_url:String(source.url),source_title:String(source.title),
      });
      if(opportunities.length>=24)break;
    }
    opportunities.sort((a,b)=>b.fit_score-a.fit_score);

    const stats={
      total:opportunities.length,
      grants:opportunities.filter(x=>x.type==="grant").length,
      equity:opportunities.filter(x=>x.type==="equity").length,
      accelerators:opportunities.filter(x=>["accelerator","incubator","challenge"].includes(x.type)).length,
      open:opportunities.filter(x=>["open","rolling"].includes(x.status)).length,
      high_fit:opportunities.filter(x=>x.fit_score>=80).length,
    };

    return NextResponse.json({ok:true,mode:"personalized-live-funding",profile:founderContext,preferences,queries,evidence_count:evidence.length,opportunities,stats,provider:analyzed.provider,model:analyzed.model,generated_at:new Date().toISOString(),duration_ms:Date.now()-started});
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});
    return NextResponse.json({error:error instanceof Error?error.message:"Funding intelligence scan failed",duration_ms:Date.now()-started},{status:500});
  }
}
