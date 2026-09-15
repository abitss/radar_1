import { createHash } from "node:crypto";
import { safePublicFetch, normalizeEngineUrl } from "@/lib/radar-engine-security";

export function decodeEntities(text:string){
  return String(text||"")
    .replaceAll("&nbsp;"," ")
    .replaceAll("&amp;","&")
    .replaceAll("&quot;",'"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;","<")
    .replaceAll("&gt;",">");
}

export function htmlToText(html:string){
  return decodeEntities(String(html||"")
    .replace(/<script[\s\S]*?<\/script>/gi," ")
    .replace(/<style[\s\S]*?<\/style>/gi," ")
    .replace(/<svg[\s\S]*?<\/svg>/gi," ")
    .replace(/<!--([\s\S]*?)-->/g," ")
    .replace(/<[^>]+>/g," "))
    .replace(/\s+/g," ")
    .trim();
}

export function extractTitle(html:string){
  const match=String(html||"").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?htmlToText(match[1]).slice(0,180):"";
}

export function extractLinks(html:string,baseUrl:string){
  const links:Array<{url:string;text:string}>=[];
  const regex=/<a\s[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match:RegExpExecArray|null;
  while((match=regex.exec(String(html||"")))){
    try{
      const url=new URL(match[1],baseUrl);
      if(["http:","https:"].includes(url.protocol))links.push({url:url.toString(),text:htmlToText(match[2]).slice(0,120)});
    }catch{}
  }
  return links;
}

export function strategicLinkScore(link:{url:string;text:string},primaryHost:string){
  try{
    const url=new URL(link.url);
    if(url.hostname!==primaryHost)return -100;
    const hay=`${url.pathname} ${link.text}`.toLowerCase();
    const weights:Array<[string,number]>=[["pricing",20],["product",18],["feature",16],["solution",14],["career",13],["jobs",13],["about",11],["news",10],["press",10],["blog",8],["changelog",16],["customer",8],["industry",7],["docs",7],["release",12]];
    let score=0;
    for(const [term,weight] of weights)if(hay.includes(term))score+=weight;
    if(url.pathname.split("/").filter(Boolean).length>3)score-=5;
    return score;
  }catch{return -100;}
}

export function extractFeeds(html:string,baseUrl:string){
  const feeds:string[]=[];
  const regex=/<link\s[^>]*rel=["']alternate["'][^>]*>/gi;
  for(const tag of String(html||"").match(regex)||[]){
    const type=tag.match(/type=["']([^"']+)["']/i)?.[1]||"";
    const href=tag.match(/href=["']([^"']+)["']/i)?.[1];
    if(!href||!/(rss|atom|xml)/i.test(type))continue;
    try{feeds.push(new URL(href,baseUrl).toString())}catch{}
  }
  return[...new Set(feeds)];
}

async function fetchPage(url:string){
  const response=await safePublicFetch(url,{timeoutMs:12000});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  const type=response.headers.get("content-type")||"";
  if(!type.includes("text")&&!type.includes("html")&&!type.includes("xml"))throw new Error(`Unsupported content type: ${type}`);
  const raw=await response.text();
  return{url:response.url||url,title:extractTitle(raw),raw,text:htmlToText(raw).slice(0,30000)};
}

export async function crawlStartupEngine(inputUrl:string,pageLimit=6){
  const base=normalizeEngineUrl(inputUrl);
  const home=await fetchPage(base.toString());
  const canonical=normalizeEngineUrl(home.url||base.toString());
  const feeds=extractFeeds(home.raw,canonical.toString());
  const links=extractLinks(home.raw,canonical.toString())
    .map(link=>({...link,score:strategicLinkScore(link,canonical.hostname)}))
    .filter(link=>link.score>0)
    .sort((a,b)=>b.score-a.score);
  const unique:string[]=[];
  const seen=new Set([base.toString().replace(/\/$/,"")]);
  for(const link of links){
    const clean=link.url.split("#")[0].replace(/\/$/,"");
    if(!seen.has(clean)){seen.add(clean);unique.push(link.url)}
    if(unique.length>=Math.max(0,pageLimit-1))break;
  }
  const pages=[home];
  const results=await Promise.allSettled(unique.map(fetchPage));
  for(const result of results)if(result.status==="fulfilled")pages.push(result.value);
  return{homepage:canonical.toString(),domain:canonical.hostname.replace(/^www\./,""),pages:pages.map(page=>({url:page.url,title:page.title,text:page.text})),feeds,combinedText:pages.map(page=>`SOURCE: ${page.url}\nTITLE: ${page.title}\n${page.text}`).join("\n\n").slice(0,110000)};
}

export async function fetchSnapshotEngine(url:string){
  const response=await safePublicFetch(url,{timeoutMs:12000});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  const type=response.headers.get("content-type")||"";
  if(!type.includes("text")&&!type.includes("html")&&!type.includes("xml")&&!type.includes("json"))throw new Error(`Unsupported content type: ${type}`);
  const raw=await response.text();
  const text=htmlToText(raw).slice(0,60000);
  return{text,hash:createHash("sha256").update(text).digest("hex"),title:extractTitle(raw),url:response.url||url};
}

export function sourceTypeForUrl(url:string){
  const p=String(url).toLowerCase();
  if(p.includes("pricing"))return"pricing";
  if(p.includes("career")||p.includes("/jobs"))return"careers";
  if(p.includes("blog")||p.includes("news")||p.includes("press"))return"news";
  if(p.includes("changelog")||p.includes("release"))return"changelog";
  if(p.includes("product")||p.includes("feature"))return"product";
  if(p.includes("docs"))return"docs";
  return"website";
}
