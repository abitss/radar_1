import { createHash } from "node:crypto";
import { radarEngineAIConfigured, radarEngineJson } from "@/lib/radar-engine-ai";
import { sbDelete, sbInsert, sbSelect } from "@/lib/radar-db";
import { companyBrainSummary } from "@/lib/radar-profile";

type Expansion = {
  adjacent_categories:string[];
  substitute_workflows:string[];
  customer_synonyms:string[];
  buyer_synonyms:string[];
  alternative_terminology:string[];
  hidden_competitor_angles:string[];
  search_queries:string[];
};

type ExpansionResult = Expansion & {
  cached:boolean;
  hash:string;
  provider?:string;
  model?:string;
};

const EMPTY:Expansion={
  adjacent_categories:[],
  substitute_workflows:[],
  customer_synonyms:[],
  buyer_synonyms:[],
  alternative_terminology:[],
  hidden_competitor_angles:[],
  search_queries:[],
};

const TYPE_MAP:Record<keyof Expansion,string>={
  adjacent_categories:"ai_brain_adjacent_category",
  substitute_workflows:"ai_brain_substitute_workflow",
  customer_synonyms:"ai_brain_customer_synonym",
  buyer_synonyms:"ai_brain_buyer_synonym",
  alternative_terminology:"ai_brain_alt_terminology",
  hidden_competitor_angles:"ai_brain_hidden_angle",
  search_queries:"ai_brain_search",
};

function cleanList(value:unknown,max=12,maxLen=180){
  if(!Array.isArray(value))return[];
  const seen=new Set<string>();
  const out:string[]=[];
  for(const item of value){
    const text=String(item||"").replace(/\s+/g," ").trim().slice(0,maxLen);
    if(!text)continue;
    const key=text.toLowerCase();
    if(seen.has(key))continue;
    seen.add(key);out.push(text);
    if(out.length>=max)break;
  }
  return out;
}

function normalizeExpansion(data:any):Expansion{
  return{
    adjacent_categories:cleanList(data?.adjacent_categories,10),
    substitute_workflows:cleanList(data?.substitute_workflows,10),
    customer_synonyms:cleanList(data?.customer_synonyms,12),
    buyer_synonyms:cleanList(data?.buyer_synonyms,10),
    alternative_terminology:cleanList(data?.alternative_terminology,16),
    hidden_competitor_angles:cleanList(data?.hidden_competitor_angles,12),
    search_queries:cleanList(data?.search_queries,24,220),
  };
}

function brainHash(workspace:any){
  return createHash("sha256").update(JSON.stringify(companyBrainSummary(workspace))).digest("hex");
}

function fromRows(rows:any[]):Expansion{
  const out:Expansion={...EMPTY};
  for(const [key,type] of Object.entries(TYPE_MAP) as Array<[keyof Expansion,string]>){
    out[key]=cleanList(rows.filter((r:any)=>r.query_type===type&&r.enabled!==false).map((r:any)=>r.query),key==="search_queries"?24:16,key==="search_queries"?220:180);
  }
  return out;
}

export async function loadCompanyBrainExpansion(workspaceId:string):Promise<ExpansionResult|null>{
  const rows:any[]=await sbSelect(`radar_discovery_queries?workspace_id=eq.${encodeURIComponent(workspaceId)}&select=query,query_type,enabled&limit=500`);
  const marker=rows.find((r:any)=>r.query_type==="ai_brain_meta");
  if(!marker?.query)return null;
  const expansion=fromRows(rows);
  return{...expansion,cached:true,hash:String(marker.query)};
}

export async function loadCompanyBrainExpansionQueries(workspaceId:string){
  const expansion=await loadCompanyBrainExpansion(workspaceId);
  return expansion?.search_queries||[];
}

export async function ensureCompanyBrainExpansion(workspace:any,options:{force?:boolean}={}):Promise<ExpansionResult>{
  const hash=brainHash(workspace);
  const workspaceId=String(workspace.id);
  const existing:any[]=await sbSelect(`radar_discovery_queries?workspace_id=eq.${encodeURIComponent(workspaceId)}&select=query,query_type,enabled&limit=500`);
  const marker=existing.find((r:any)=>r.query_type==="ai_brain_meta");
  if(!options.force&&String(marker?.query||"")===hash){
    const cached=fromRows(existing);
    if(cached.search_queries.length>=4)return{...cached,cached:true,hash};
  }

  if(!radarEngineAIConfigured())return{...EMPTY,cached:false,hash};

  const brain=companyBrainSummary(workspace);
  const prompt=`You are expanding a founder-declared Company Brain for competitive-intelligence discovery.

FOUNDER COMPANY BRAIN (treat this as primary truth):
${JSON.stringify(brain,null,2)}

Generate semantic discovery expansion ONLY. Do not invent traction, customers, competitors, funding, product claims, or any market fact. These are search hypotheses, not facts.

Return JSON with exactly these arrays:
{
  "adjacent_categories": ["nearby product/category names that could contain competitors"],
  "substitute_workflows": ["different ways the same customer currently solves the problem"],
  "customer_synonyms": ["alternative names for the same target user/customer"],
  "buyer_synonyms": ["alternative titles for the buyer/decision maker"],
  "alternative_terminology": ["industry jargon, technical terms, plain-language phrases, older/newer terminology"],
  "hidden_competitor_angles": ["non-obvious competitive search angles such as service substitutes, incumbent workflows, bundled features, adjacent verticals"],
  "search_queries": ["high-intent public-web queries to discover direct, adjacent, substitute, emerging and incumbent competitors"]
}

Rules:
- Keep every item concise and usable for web search.
- Prefer specific phrases over broad buzzwords.
- Use the founder's geography only when it materially narrows the market.
- Include direct competitors, adjacent competitors, substitutes, incumbents and emerging threats in the query mix.
- Do not include the founder's own company as a competitor.
- Do not name a company unless it was already present in the founder input.
- Produce 6-10 adjacent categories, 5-10 substitute workflows, 6-12 customer synonyms, 4-10 buyer synonyms, 8-16 alternative terms, 6-12 hidden angles and 16-24 search queries.`;

  const result=await radarEngineJson(prompt,{feature:"company_profile_expansion",maxTokens:3000,temperature:0.05,web:false});
  const expansion=normalizeExpansion(result.data);

  const types=["ai_brain_meta",...Object.values(TYPE_MAP)];
  await Promise.all(types.map(type=>sbDelete("radar_discovery_queries",`workspace_id=eq.${encodeURIComponent(workspaceId)}&query_type=eq.${encodeURIComponent(type)}`).catch(()=>[])));

  const rows:any[]=[{workspace_id:workspaceId,query:hash,query_type:"ai_brain_meta",enabled:false}];
  for(const [key,type] of Object.entries(TYPE_MAP) as Array<[keyof Expansion,string]>){
    for(const query of expansion[key])rows.push({workspace_id:workspaceId,query,query_type:type,enabled:true});
  }
  if(rows.length)await sbInsert("radar_discovery_queries",rows);

  return{...expansion,cached:false,hash,provider:result.provider,model:result.model};
}
