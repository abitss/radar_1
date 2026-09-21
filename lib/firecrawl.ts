import { fetchSnapshotEngine } from "@/lib/radar-engine-crawl";
import { engineSearchConfigured, engineSearchWeb } from "@/lib/radar-engine-search";

const FIRECRAWL_BASE = "https://api.firecrawl.dev/v2";

export function firecrawlConfigured() {
  return Boolean(process.env.FIRECRAWL_API_KEY) && process.env.FIRECRAWL_FALLBACK_ENABLED?.toLowerCase() === "true";
}

function apiKey() {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("FIRECRAWL_API_KEY is not configured.");
  return key;
}

function isTransientFirecrawlError(error:unknown){
  const message=error instanceof Error?error.message:String(error||"");
  return /(rate limit|too many requests|\b429\b|retry after|timeout|timed out|fetch failed|econnreset|etimedout|temporarily unavailable|\b502\b|\b503\b|\b504\b)/i.test(message);
}
function isFirecrawlQuotaError(error:unknown){
  const message=error instanceof Error?error.message:String(error||"");
  return /(insufficient credits|more credits|upgrade your plan|credit balance|credits exhausted|billing)/i.test(message);
}

async function firecrawlRequest(path: string, body: unknown, timeoutMs = 30000) {
  if (!firecrawlConfigured()) throw new Error("Premium crawler fallback is disabled.");
  const response = await fetch(`${FIRECRAWL_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await response.text();
  let data: any;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!response.ok) {
    const message=data?.error || data?.message || `Firecrawl request failed with HTTP ${response.status}`;
    throw new Error(`${message}${response.status===429?" [HTTP 429]":""}`);
  }
  return data;
}

async function firecrawlDelete(path:string,timeoutMs=20000){
  const response=await fetch(`${FIRECRAWL_BASE}${path}`,{
    method:"DELETE",
    headers:{Authorization:`Bearer ${apiKey()}`,"Content-Type":"application/json"},
    cache:"no-store",
    signal:AbortSignal.timeout(timeoutMs),
  });
  const text=await response.text();
  let data:any;
  try{data=text?JSON.parse(text):{}}catch{data={raw:text}}
  if(!response.ok&&response.status!==404){
    const message=data?.error||data?.message||`Firecrawl delete failed with HTTP ${response.status}`;
    throw new Error(message);
  }
  return{...data,notFound:response.status===404};
}

export type FirecrawlSearchResult = {
  title?: string;
  description?: string;
  url: string;
  markdown?: string;
};

function searchRows(payload: any): FirecrawlSearchResult[] {
  const direct = Array.isArray(payload?.data) ? payload.data : null;
  const rows = direct || payload?.data?.web || payload?.web || payload?.results || [];
  if(!Array.isArray(rows))return[];
  return rows.map((row:any)=>({
    title:String(row?.title||row?.metadata?.title||""),
    description:String(row?.description||row?.snippet||row?.markdown||row?.metadata?.description||""),
    url:String(row?.url||row?.link||row?.metadata?.sourceURL||row?.metadata?.url||""),
    markdown:row?.markdown?String(row.markdown):undefined,
  })).filter((row:any)=>row.url);
}

function mergeSearchRows(primary:FirecrawlSearchResult[],secondary:FirecrawlSearchResult[],limit:number){
  const seen=new Set<string>();
  const merged:FirecrawlSearchResult[]=[];
  for(const row of [...primary,...secondary]){
    if(!row?.url||seen.has(row.url))continue;
    seen.add(row.url);
    merged.push(row);
    if(merged.length>=limit)break;
  }
  return merged;
}

async function oldEngineRows(query:string,limit:number):Promise<FirecrawlSearchResult[]>{
  if(!engineSearchConfigured())return[];
  try{
    const rows=await engineSearchWeb(query,limit);
    return rows.map(row=>({title:row.title,description:row.description,url:row.url}));
  }catch{return[]}
}

export async function searchWebFast(query: string, limit = 5): Promise<FirecrawlSearchResult[]> {
  return searchWeb(query, limit);
}

export async function searchWeb(query: string, limit = 6): Promise<FirecrawlSearchResult[]> {
  const rows = await oldEngineRows(query, limit);
  if (rows.length || !firecrawlConfigured()) return rows;
  try {
    return searchRows(await firecrawlRequest("/search", {query, limit, sources:["web"]}, 18000));
  } catch (error) {
    console.error("RADAR optional crawler search unavailable", error);
    return [];
  }
}

export async function scrapeUrl(url:string) {
  try {
    const page = await fetchSnapshotEngine(url);
    if (page.text.length >= 80) return {url:page.url, title:page.title, markdown:page.text, metadata:{provider:"direct"}};
  } catch (error) { console.error("RADAR direct fetch unavailable", error); }

  const payload = await firecrawlRequest("/scrape", {
    url,
    formats: ["markdown"],
    onlyMainContent: true,
    maxAge: 0,
    timeout: 45000,
  }, 52000);
  const data = payload?.data || payload || {};
  return {
    url: String(data?.metadata?.sourceURL || data?.metadata?.url || url),
    title: String(data?.metadata?.title || data?.title || ""),
    markdown: String(data?.markdown || "").slice(0, 90000),
    metadata: data?.metadata || {},
  };
}

export async function scrapeCompanyProfile(url: string) {
  const schema = {
    type: "object",
    properties: {
      company_name: { type: "string" },
      one_line_description: { type: "string" },
      industry: { type: "string" },
      sub_category: { type: "string" },
      problem_statement: { type: "string" },
      target_customers: { type: "string" },
      buyer: { type: "string" },
      product_keywords: { type: "array", items: { type: "string" } },
      capability_keywords: { type: "array", items: { type: "string" } },
      technology_keywords: { type: "array", items: { type: "string" } },
      major_features: { type: "array", items: { type: "string" } },
      geography: { type: "string" },
      business_model: { type: "string" },
      pricing_context: { type: "string" },
      positioning: { type: "string" },
      public_team_facts: { type: "string" },
    },
    required: [
      "company_name","one_line_description","industry","sub_category","problem_statement","target_customers","buyer",
      "product_keywords","capability_keywords","technology_keywords","major_features","geography","business_model",
      "pricing_context","positioning","public_team_facts"
    ],
  };

  const payload = await firecrawlRequest("/scrape", {
    url,
    formats: [
      "markdown",
      {
        type: "json",
        schema,
        prompt: "Build an evidence-grounded company profile for competitive intelligence. Extract only claims supported by this public page. Identify industry, sub-category, products/services, problem/use case, target customers, likely buyer only when supported, geography, business model, pricing or price-band evidence, technologies, major features, positioning/messaging and relevant public team/company facts. Use concise phrases. Do not invent missing facts. Return empty strings or arrays when uncertain."
      }
    ],
    onlyMainContent: true,
    timeout: 70000,
  }, 80000);

  return payload?.data || payload;
}

export async function createMonitor(body: unknown) {
  return firecrawlRequest("/monitor", body, 25000);
}

export async function deleteMonitor(monitorId:string){
  if(!monitorId)return{ok:true,skipped:true};
  return firecrawlDelete(`/monitor/${encodeURIComponent(monitorId)}`,20000);
}
