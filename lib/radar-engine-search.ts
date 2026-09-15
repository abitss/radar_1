export type EngineSearchResult={title:string;url:string;description:string;score:number;provider:string};

function hasKey(provider:string){
  if(provider==="tavily")return Boolean(process.env.TAVILY_API_KEY);
  if(provider==="brave")return Boolean(process.env.BRAVE_SEARCH_API_KEY);
  if(provider==="serper")return Boolean(process.env.SERPER_API_KEY);
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

function dedupe(items:EngineSearchResult[]){const seen=new Set<string>();return items.filter(item=>item?.url&&!seen.has(item.url)&&Boolean(seen.add(item.url)))}

export function configuredEngineSearchProvider(){
  const requested=String(process.env.SEARCH_PROVIDER||"auto").toLowerCase();
  if(requested&&requested!=="auto")return hasKey(requested)?requested:null;
  for(const provider of ["tavily","brave","serper"])if(hasKey(provider))return provider;
  return null;
}

export function engineSearchConfigured(){return Boolean(configuredEngineSearchProvider())}

export async function engineSearchWeb(query:string,maxResults=8):Promise<EngineSearchResult[]>{
  const provider=configuredEngineSearchProvider();
  if(!provider)return[];
  if(provider==="tavily")return searchTavily(query,maxResults);
  if(provider==="brave")return searchBrave(query,maxResults);
  if(provider==="serper")return searchSerper(query,maxResults);
  return[];
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
