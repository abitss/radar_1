import dns from "node:dns/promises";
import net from "node:net";

export function normalizeEngineUrl(input:string){
  const raw=String(input||"").trim();
  if(!raw)throw new Error("Website URL is required");
  const withProtocol=/^https?:\/\//i.test(raw)?raw:`https://${raw}`;
  const url=new URL(withProtocol);
  if(!["http:","https:"].includes(url.protocol))throw new Error("Only HTTP(S) URLs are allowed");
  url.hash="";
  return url;
}

function ipv4Private(ip:string){
  const p=ip.split(".").map(Number);
  if(p.length!==4)return false;
  return p[0]===10||p[0]===127||(p[0]===169&&p[1]===254)||(p[0]===172&&p[1]>=16&&p[1]<=31)||(p[0]===192&&p[1]===168)||p[0]===0||p[0]>=224;
}

function ipBlocked(ip:string){
  if(net.isIPv4(ip))return ipv4Private(ip);
  if(net.isIPv6(ip)){
    const v=ip.toLowerCase();
    if(v==="::1"||v==="::"||v.startsWith("fc")||v.startsWith("fd")||v.startsWith("fe80:"))return true;
    if(v.startsWith("::ffff:")){
      const mapped=v.slice("::ffff:".length);
      if(net.isIPv4(mapped))return ipv4Private(mapped);
    }
    return false;
  }
  return true;
}

export async function assertSafePublicUrl(input:string){
  const url=normalizeEngineUrl(input);
  const host=url.hostname.toLowerCase();
  if(host==="localhost"||host.endsWith(".localhost")||host.endsWith(".local")||host==="metadata.google.internal")throw new Error("Private or local network targets are not allowed");
  const records=await dns.lookup(host,{all:true});
  if(!records.length||records.some(record=>ipBlocked(record.address)))throw new Error("URL resolves to a private or unsafe network address");
  return url;
}

type RobotsCacheEntry={text:string;expires:number};
const globalCache=globalThis as typeof globalThis & {__radarEngineRobots?:Map<string,RobotsCacheEntry>};
const robotsCache=globalCache.__radarEngineRobots||(globalCache.__radarEngineRobots=new Map<string,RobotsCacheEntry>());

function checkRobotsRules(text:string,pathname:string){
  if(!text)return true;
  const lines=String(text).split(/\r?\n/).map(line=>line.split("#")[0].trim()).filter(Boolean);
  let applies=false;
  const disallow:string[]=[];
  for(const line of lines){
    const idx=line.indexOf(":");if(idx<0)continue;
    const key=line.slice(0,idx).trim().toLowerCase();
    const value=line.slice(idx+1).trim();
    if(key==="user-agent")applies=value==="*"||/radar/i.test(value);
    else if(applies&&key==="disallow"&&value)disallow.push(value);
  }
  return !disallow.some(rule=>pathname.startsWith(rule));
}

async function robotsAllows(url:URL){
  const cached=robotsCache.get(url.origin);
  if(cached&&cached.expires>Date.now())return checkRobotsRules(cached.text,url.pathname);
  try{
    const robotsUrl=new URL("/robots.txt",url.origin);
    await assertSafePublicUrl(robotsUrl.toString());
    const response=await fetch(robotsUrl,{headers:{"user-agent":"RADAR-Competitive-Intelligence/1.0 (+public-market-research)"},redirect:"error",signal:AbortSignal.timeout(5000),cache:"no-store"});
    const text=response.ok?await response.text():"";
    robotsCache.set(url.origin,{text,expires:Date.now()+30*60*1000});
    return checkRobotsRules(text,url.pathname);
  }catch{
    robotsCache.set(url.origin,{text:"",expires:Date.now()+10*60*1000});
    return true;
  }
}

export async function safePublicFetch(input:string,options:{timeoutMs?:number;skipRobots?:boolean;headers?:Record<string,string>}={}){
  let current=await assertSafePublicUrl(input);
  if(!options.skipRobots&&!(await robotsAllows(current)))throw new Error("Blocked by robots.txt");
  for(let hop=0;hop<4;hop++){
    const response=await fetch(current,{
      method:"GET",
      headers:{"user-agent":"RADAR-Competitive-Intelligence/1.0 (+public-market-research)",accept:"text/html,application/xhtml+xml,application/rss+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",...(options.headers||{})},
      redirect:"manual",
      signal:AbortSignal.timeout(options.timeoutMs||12000),
      cache:"no-store",
    });
    if([301,302,303,307,308].includes(response.status)){
      const location=response.headers.get("location");
      if(!location)throw new Error("Redirect without location");
      current=await assertSafePublicUrl(new URL(location,current).toString());
      if(!options.skipRobots&&!(await robotsAllows(current)))throw new Error("Redirect target blocked by robots.txt");
      continue;
    }
    return response;
  }
  throw new Error("Too many redirects");
}
