import { radarEngineText } from "@/lib/radar-engine-ai";

export type EngineSearchResult={title:string;url:string;description:string;score:number;provider:string};

function hasKey(provider:string){
  if(provider==="openrouter")return Boolean(process.env.OPENROUTER_API_KEY);
  if(provider==="tavily")return Boolean(process.env.TAVILY_API_KEY);
  if(provider==="brave")return Boolean(process.env.BRAVE_SEARCH_API_KEY);
  if(provider==="serper")return Boolean(process.env.SERPER_API_KEY);
  if(provider==="searxng")return Boolean(process.env.SEARXNG_BASE_URL);
  if(provider==="gdelt")return String(process.env.GDELT_ENABLED||"true").toLowerCase()!=="false";
  return false;
}

function firstPublicUrl(text:string){
  const matches=String(text||"").match(/https?:\/\/[^\s"'<>)}\]]+/gi)||[];
  for(const raw of matches){
    const cleaned=raw.replace(/[.,;:!?]+$/,"");
    try{
      const url=new URL(cleaned);
      if(!["http:","https:"].includes(url.protocol)||url.username||url.password)continue;
      const host=url.hostname.toLowerCase();
      if(!host||host==="localhost"||host.endsWith(".local")||!host.includes("."))continue;
      if(/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)||host.includes(":"))continue;
      return url.toString();
    }catch{}
  }
  return null;
}

function dedupe(items:EngineSearchResult[]){
  const seen=new Set<string>();
  return items.filter(item=>{
    if(!item?.url||seen.has(item.url))return false;
    seen.add(item.url);return true;
  });
}

export function configuredEngineSearchProvider(){
  const requested=String(process.env.SEARCH_PROVIDER||"auto").toLowerCase();
  if(requested&&requested!=="auto")return hasKey(requested)?requested:null;
  for(const provider of ["searxng","tavily","brave","serper","openrouter"])if(hasKey(provider))return provider;
  return null;
}

export function engineSearchConfigured(){
  return Boolean(configuredEngineSearchProvider()||process.env.OPENROUTER_API_KEY||String(process.env.GDELT_ENABLED||"true").toLowerCase()!=="false");
}

export async function engineSearchWeb(query:string,maxResults=8):Promise<EngineSearchResult[]>{
  const provider=configuredEngineSearchProvider();
  const supplemental=Boolean(process.env.OPENROUTER_API_KEY)&&String(process.env.OPENROUTER_LIVE_WEB_ENABLED||"true").toLowerCase()!=="false";
  const tasks:Promise<EngineSearchResult[]>[]=[];

  if(provider==="searxng")tasks.push(searchSearxng(query,maxResults));
  else if(provider==="tavily")tasks.push(searchTavily(query,maxResults));
  else if(provider==="brave")tasks.push(searchBrave(query,maxResults));
  else if(provider==="serper")tasks.push(searchSerper(query,maxResults));
  else if(provider==="openrouter")tasks.push(searchOpenRouter(query,maxResults));

  if(String(process.env.GDELT_ENABLED||"true").toLowerCase()!=="false")tasks.push(searchGdelt(query,Math.min(maxResults,8)));
  if(supplemental&&provider!=="openrouter")tasks.push(searchOpenRouter(query,Math.min(maxResults,6)));
  if(!tasks.length)return[];

  const settled=await Promise.allSettled(tasks);
  const rows:EngineSearchResult[]=[];
  for(const item of settled)if(item.status==="fulfilled")rows.push(...item.value);
  return dedupe(rows).slice(0,Math.max(maxResults,Math.min(maxResults*2,16)));
}

async function searchOpenRouter(query:string,maxResults:number):Promise<EngineSearchResult[]>{
  if(!process.env.OPENROUTER_API_KEY)return[];
  const result=await radarEngineText(
    `Find current public-web sources relevant to this competitive-intelligence query: ${query}\n\nPrioritize first-party company pages, official product/pricing pages, reputable news, filings, press releases, launch announcements, hiring/careers pages, partnerships and customer announcements. Do not fabricate URLs. Summarize the evidence you found in a few concise sentences.`,
    {feature:"live_web_discovery",web:true,maxTokens:1200,temperature:0.02}
  );
  const citations=Array.isArray(result.citations)?result.citations:[];
  const summary=String(result.text||"").replace(/\s+/g," ").trim().slice(0,2400);
  return citations.slice(0,maxResults).map((citation,index)=>({
    title:String(citation.title||`Live web source ${index+1}`).slice(0,240),
    url:String(citation.url),
    description:summary||`OpenRouter live-web evidence for: ${query}`,
    score:Math.max(.45,1-index*.04),
    provider:"openrouter-web",
  }));
}

async function extractTavily(url:string){
  if(!process.env.TAVILY_API_KEY)return null;
  const response=await fetch("https://api.tavily.com/extract",{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${process.env.TAVILY_API_KEY}`},body:JSON.stringify({urls:url,extract_depth:"basic",include_images:false,include_favicon:false,format:"markdown",include_usage:false}),signal:AbortSignal.timeout(Number(process.env.SEARCH_TIMEOUT_MS||30000)),cache:"no-store"});
  if(!response.ok)return null;
  const data:any=await response.json();
  const hit=data.results?.[0];
  if(!hit?.url||!String(hit.raw_content||"").trim())return null;
  let title=hit.url;try{title=`First-party source: ${new URL(hit.url).hostname}`}catch{}
  return{title,url:hit.url,description:String(hit.raw_content).slice(0,12000),score:1,provider:"tavily"} as EngineSearchResult;
}

async function searchTavily(query:string,maxResults:number){
  if(!process.env.TAVILY_API_KEY)return[];
  const exactUrl=firstPublicUrl(query);
  const extracted=exactUrl?await extractTavily(exactUrl).catch(()=>null):null;
  let results:EngineSearchResult[]=[];
  try{
    const response=await fetch("https://api.tavily.com/search",{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${process.env.TAVILY_API_KEY}`},body:JSON.stringify({query,max_results:maxResults,search_depth:"advanced",include_answer:false}),signal:AbortSignal.timeout(Number(process.env.SEARCH_TIMEOUT_MS||30000)),cache:"no-store"});
    if(!response.ok)throw new Error(`Tavily search failed (${response.status})`);
    const data:any=await response.json();
    results=(data.results||[]).map((r:any)=>({title:String(r.title||r.url||""),url:String(r.url||""),description:String(r.content||""),score:Number(r.score||0),provider:"tavily"}));
  }catch(error){if(!extracted)throw error}
  return dedupe([...(extracted?[extracted]:[]),...results]).slice(0,Math.max(1,maxResults+1));
}

async function searchBrave(query:string,maxResults:number){
  if(!process.env.BRAVE_SEARCH_API_KEY)return[];
  const response=await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${Math.min(maxResults,20)}`,{headers:{accept:"application/json","X-Subscription-Token":process.env.BRAVE_SEARCH_API_KEY},signal:AbortSignal.timeout(Number(process.env.SEARCH_TIMEOUT_MS||30000)),cache:"no-store"});
  if(!response.ok)throw new Error(`Brave search failed (${response.status})`);
  const data:any=await response.json();
  return(data.web?.results||[]).map((r:any)=>({title:String(r.title||r.url||""),url:String(r.url||""),description:String(r.description||""),score:0,provider:"brave"}));
}

async function searchSerper(query:string,maxResults:number){
  if(!process.env.SERPER_API_KEY)return[];
  const response=await fetch("https://google.serper.dev/search",{method:"POST",headers:{"content-type":"application/json","X-API-KEY":process.env.SERPER_API_KEY},body:JSON.stringify({q:query,num:maxResults}),signal:AbortSignal.timeout(Number(process.env.SEARCH_TIMEOUT_MS||30000)),cache:"no-store"});
  if(!response.ok)throw new Error(`Serper search failed (${response.status})`);
  const data:any=await response.json();
  return(data.organic||[]).map((r:any)=>({title:String(r.title||r.link||""),url:String(r.link||""),description:String(r.snippet||""),score:0,provider:"serper"}));
}


async function searchSearxng(query:string,maxResults:number):Promise<EngineSearchResult[]>{
  const base=String(process.env.SEARXNG_BASE_URL||"").replace(/\/$/,"");
  if(!base)return[];
  const url=`${base}/search?q=${encodeURIComponent(query)}&format=json&language=all&safesearch=1`;
  const response=await fetch(url,{headers:{accept:"application/json","user-agent":"RADAR/1.0"},signal:AbortSignal.timeout(Number(process.env.SEARCH_TIMEOUT_MS||30000)),cache:"no-store"});
  if(!response.ok)throw new Error(`SearXNG search failed (${response.status})`);
  const data:any=await response.json();
  return (Array.isArray(data?.results)?data.results:[]).slice(0,maxResults).map((r:any,index:number)=>({
    title:String(r.title||r.url||"").slice(0,240),
    url:String(r.url||""),
    description:String(r.content||r.description||"").replace(/\s+/g," ").trim().slice(0,2400),
    score:Number.isFinite(Number(r.score))?Number(r.score):Math.max(.35,1-index*.04),
    provider:"searxng",
  })).filter((r:EngineSearchResult)=>Boolean(r.url));
}

async function searchGdelt(query:string,maxResults:number):Promise<EngineSearchResult[]>{
  const endpoint="https://api.gdeltproject.org/api/v2/doc/doc";
  const params=new URLSearchParams({query,mode:"artlist",maxrecords:String(Math.min(250,Math.max(5,maxResults))),format:"json",sort:"hybridrel"});
  const response=await fetch(`${endpoint}?${params.toString()}`,{headers:{accept:"application/json","user-agent":"RADAR/1.0"},signal:AbortSignal.timeout(Number(process.env.SEARCH_TIMEOUT_MS||30000)),cache:"no-store"});
  if(!response.ok)return[];
  const data:any=await response.json().catch(()=>({}));
  const rows=Array.isArray(data?.articles)?data.articles:[];
  return rows.slice(0,maxResults).map((r:any,index:number)=>({
    title:String(r.title||r.url||"").slice(0,240),
    url:String(r.url||""),
    description:String([r.seendate,r.domain,r.sourcecountry,r.language].filter(Boolean).join(" · ")).slice(0,1200),
    score:Math.max(.3,.9-index*.04),
    provider:"gdelt",
  })).filter((r:EngineSearchResult)=>Boolean(r.url));
}
