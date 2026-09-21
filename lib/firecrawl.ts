import { engineSearchConfigured, engineSearchWeb } from "@/lib/radar-engine-search";

const FIRECRAWL_BASE = "https://api.firecrawl.dev/v2";

export function firecrawlConfigured() {
  return Boolean(process.env.FIRECRAWL_API_KEY);
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

async function firecrawlRequest(path: string, body: unknown, timeoutMs = 30000) {
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
  const tasks:Promise<FirecrawlSearchResult[]>[]=[];
  if(firecrawlConfigured())tasks.push(firecrawlRequest("/search", {query,limit,sources:["web"],ignoreInvalidURLs:true}, 18000).then(searchRows));
  tasks.push(oldEngineRows(query,limit));
  const settled=await Promise.allSettled(tasks);
  const fireIndex=firecrawlConfigured()?0:-1;
  const fire=fireIndex>=0&&settled[fireIndex]?.status==="fulfilled"?(settled[fireIndex] as PromiseFulfilledResult<FirecrawlSearchResult[]>).value:[];
  const engineResult=settled[settled.length-1];
  const engine=engineResult?.status==="fulfilled"?engineResult.value:[];
  if(!fire.length&&!engine.length&&fireIndex>=0&&settled[fireIndex]?.status==="rejected"){
    const error=(settled[fireIndex] as PromiseRejectedResult).reason;
    if(!isTransientFirecrawlError(error))throw error;
  }
  return mergeSearchRows(fire,engine,Math.max(limit,Math.min(limit*2,12)));
}

export async function searchWeb(query: string, limit = 6): Promise<FirecrawlSearchResult[]> {
  const tasks:Promise<FirecrawlSearchResult[]>[]=[];
  if(firecrawlConfigured())tasks.push(firecrawlRequest("/search", {
    query,
    limit,
    sources: ["web"],
    ignoreInvalidURLs: true,
    scrapeOptions: {
      formats: ["markdown"],
      onlyMainContent: true,
      maxAge: 21600000,
    },
  }, 30000).then(searchRows));
  tasks.push(oldEngineRows(query,limit));
  const settled=await Promise.allSettled(tasks);
  const fireIndex=firecrawlConfigured()?0:-1;
  const fire=fireIndex>=0&&settled[fireIndex]?.status==="fulfilled"?(settled[fireIndex] as PromiseFulfilledResult<FirecrawlSearchResult[]>).value:[];
  const engineResult=settled[settled.length-1];
  const engine=engineResult?.status==="fulfilled"?engineResult.value:[];
  if(!fire.length&&!engine.length&&fireIndex>=0&&settled[fireIndex]?.status==="rejected"){
    const error=(settled[fireIndex] as PromiseRejectedResult).reason;
    if(!isTransientFirecrawlError(error))throw error;
  }
  return mergeSearchRows(fire,engine,Math.max(limit,Math.min(limit*2,16)));
}

export async function scrapeUrl(url:string) {
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
