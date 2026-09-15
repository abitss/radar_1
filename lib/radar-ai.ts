import { radarEngineAIConfigured, radarEngineJson, radarEngineText } from "@/lib/radar-engine-ai";

type RadarAIInput = {
  question: string;
  workspace: any;
  competitors: any[];
  signals: any[];
  recommendations: any[];
  evidence: any[];
};

export type DiscoveryCompany = {
  name: string;
  official_website?: string;
  related_product?: string;
  relationship_reason?: string;
  relation_confidence?: number;
  product_overlap_score?: number;
};

export type DiscoveryAnalysis = {
  source_url: string;
  source_type: "company" | "article" | "directory" | "research" | "other";
  companies: DiscoveryCompany[];
};

export function radarAIConfigured() {
  return radarEngineAIConfigured();
}

export function radarAIProvider() {
  const requested=String(process.env.RADAR_AI_PROVIDER||process.env.AI_PROVIDER||"").toLowerCase();
  const preferGemini=Boolean(process.env.GEMINI_API_KEY)&&String(process.env.RADAR_PREFER_GEMINI||"").toLowerCase()==="true";
  const provider=requested|| (preferGemini?"gemini":(process.env.RADAR_AI_BASE_URL||"").includes("groq.com")||process.env.GROQ_API_KEY?"groq":"compatible");
  const model=process.env.RADAR_AI_MODEL_REASONING||process.env.AI_MODEL_REASONING||process.env.RADAR_AI_MODEL||process.env.AI_MODEL||(provider==="gemini"?"gemini-2.5-flash":"openai/gpt-oss-20b");
  return {provider,model,configured:radarAIConfigured()};
}

function compact(value: unknown, max = 8500) {
  const text = JSON.stringify(value, null, 2);
  return text.length > max ? `${text.slice(0, max)}\n...[truncated]` : text;
}

export async function analyzeDiscoveryResults(workspace:any, results:Array<{url:string;title?:string;description?:string}>):Promise<DiscoveryAnalysis[]|null>{
  if(!radarAIConfigured()||!results.length)return null;
  const companyContext={
    name:workspace.name, website:workspace.website, description:workspace.description,
    industry:workspace.industry, sub_category:workspace.sub_category, problem:workspace.problem_statement,
    customers:workspace.target_customers, buyer:workspace.buyer, products:workspace.product_keywords,
    features:workspace.major_features, capabilities:workspace.capability_keywords, technologies:workspace.technology_keywords,
    geography:workspace.geography, business_model:workspace.business_model, positioning:workspace.positioning,
  };
  const prompt=`You are RADAR's competitive-entity extraction engine. Identify REAL COMPANIES and the specific PRODUCTS they make that overlap with the founder's company.\n\nRules:\n- A news article, university page, directory, listicle, blog, marketplace, review page or search result is NEVER itself a competitor. It is only a source that may mention companies.\n- For a direct company/product result, return that company.\n- For an article/list/directory, extract only clearly named commercial companies actually mentioned in the supplied title/description. Do not invent names that are not present.\n- Focus on product-level competition: what product/service is related, why it overlaps, and how close it is to the founder's product/use case/customer/workflow.\n- product_overlap_score is 0-100. relation_confidence is 0-100.\n- official_website may be empty if the supplied evidence does not establish it.\n- Exclude universities, publishers, news outlets, generic directories and research projects unless they themselves sell a competing commercial product.\n\nFounder company:\n${compact(companyContext,3500)}\n\nSearch results:\n${compact(results.slice(0,24),6500)}\n\nReturn this exact shape:\n{"results":[{"source_url":"...","source_type":"company|article|directory|research|other","companies":[{"name":"...","official_website":"","related_product":"specific product/service","relationship_reason":"why this product competes or overlaps","relation_confidence":0,"product_overlap_score":0}]}]}`;
  const {data:parsed}=await radarEngineJson(prompt,{feature:"competitor_entity_extraction",maxTokens:1800,temperature:.05});
  const rows=Array.isArray(parsed?.results)?parsed.results:[];
  const allowedUrls=new Set(results.map(r=>r.url));
  return rows.map((r:any)=>({
    source_url:String(r?.source_url||""),
    source_type:["company","article","directory","research","other"].includes(String(r?.source_type))?r.source_type:"other",
    companies:Array.isArray(r?.companies)?r.companies.slice(0,8).map((c:any)=>({
      name:String(c?.name||"").trim().slice(0,120),
      official_website:c?.official_website?String(c.official_website).trim().slice(0,500):"",
      related_product:String(c?.related_product||"").trim().slice(0,300),
      relationship_reason:String(c?.relationship_reason||"").trim().slice(0,1000),
      relation_confidence:Math.max(0,Math.min(100,Math.round(Number(c?.relation_confidence||0)))),
      product_overlap_score:Math.max(0,Math.min(100,Math.round(Number(c?.product_overlap_score||0)))),
    })).filter((c:any)=>c.name):[],
  })).filter((r:any)=>r.source_url&&allowedUrls.has(r.source_url));
}

export async function generateRadarAnswer(input: RadarAIInput): Promise<string | null> {
  if(!radarAIConfigured())return null;
  const context = {
    company: {
      name: input.workspace?.name,
      website: input.workspace?.website,
      description: input.workspace?.description,
      industry: input.workspace?.industry,
      sub_category: input.workspace?.sub_category,
      problem_statement: input.workspace?.problem_statement,
      target_customers: input.workspace?.target_customers,
      buyer: input.workspace?.buyer,
      business_model: input.workspace?.business_model,
      geography: input.workspace?.geography,
      product_keywords: input.workspace?.product_keywords,
      major_features: input.workspace?.major_features,
      capability_keywords: input.workspace?.capability_keywords,
      technology_keywords: input.workspace?.technology_keywords,
    },
    competitors: input.competitors.slice(0, 18).map(c => ({
      name: c.name, website: c.website, related_product:c.related_product, relationship_reason:c.relationship_reason,
      product_overlap_score:c.product_overlap_score, relation_confidence:c.relation_confidence,
      category: c.category, similarity_score: c.similarity_score, threat_score: c.threat_score,
      momentum_score: c.momentum_score, movement: c.movement, why_it_matters: c.why_it_matters, last_scanned_at: c.last_scanned_at,
    })),
    signals: input.signals.slice(0, 12).map(s => ({title:s.title,summary:s.summary,signal_type:s.signal_type,impact_score:s.impact_score,confidence:s.confidence,observed_at:s.observed_at})),
    recommendations: input.recommendations.slice(0, 12).map(r => ({title:r.title,priority:r.priority,rationale:r.rationale,action:r.action,status:r.status,created_at:r.created_at})),
    evidence: input.evidence.slice(0, 24).map(e => ({title:e.title,source_url:e.source_url,fact:e.fact,confidence:e.confidence,observed_at:e.observed_at})),
  };
  const prompt=`You are RADAR, a founder competitive-intelligence analyst. Use ONLY the supplied workspace data, competitors, signals, recommendations and public evidence. Never invent a competitor fact, funding event, launch, customer, metric or market claim. When useful, explicitly separate FACT, INFERENCE and PREDICTION. If evidence is insufficient, say so clearly instead of guessing. Prefer concise, decision-oriented answers. Explain why something matters to the founder. Do not claim whole-internet coverage. Say public/indexable sources or RADAR's current evidence. Never expose internal IDs, secrets, implementation details, API keys or raw database metadata.\n\nFounder question:\n${input.question}\n\nRADAR evidence context:\n${compact(context)}`;
  const result=await radarEngineText(prompt,{feature:"ask_radar",maxTokens:900,temperature:.1});
  return result.text?.trim()||null;
}
