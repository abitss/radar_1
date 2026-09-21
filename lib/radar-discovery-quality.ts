const UNIVERSAL_SOURCE_HOSTS=[
  "wikipedia.org","linkedin.com","youtube.com","reddit.com","medium.com",
  "crunchbase.com","tracxn.com","wellfound.com","g2.com","capterra.com","producthunt.com","cbinsights.com",
  "reuters.com","bloomberg.com","forbes.com","techcrunch.com",
  "ncbi.nlm.nih.gov","pmc.ncbi.nlm.nih.gov","dl.acm.org","researchgate.net","arxiv.org","springer.com","nature.com","sciencedirect.com","frontiersin.org",
];

const SOURCE_PATH_RE=/(^|\/)(news|blog|blogs|article|articles|research|resources|resource|reports|report|reviews|review|directory|directories|marketplace|marketplaces|journal|journals|paper|papers|press|media|insights|guides|guide|learn|library)(\/|$)/i;
const SOURCE_TITLE_RE=/(top\s+\d+|best\s+.*companies|startups funded|news|review|list of|companies to watch|researchers?|study|report|journal|paper|guide|introduction to|trends|doi|research|whitepaper|roundup|directory|marketplace)/i;
const GENERIC_NAMES=new Set(["skills","age groups","learning conditions","conditions","features","capabilities","technology","technologies","customers","users","buyers","market","home","official website"]);

export function radarDomain(raw:string){try{return new URL(raw).hostname.replace(/^www\./,"").toLowerCase()}catch{return""}}
export function radarOrigin(raw:string){try{return new URL(raw).origin}catch{return raw}}
export function cleanRadarCompanyName(value:string){return String(value||"").replace(/\s+/g," ").trim().replace(/[|–—].*$/,"").trim().slice(0,100)}
export function validRadarCompanyName(value:string){const name=cleanRadarCompanyName(value);return name.length>=3&&/[a-z]{2,}/i.test(name)&&!/^https?:/i.test(name)&&!GENERIC_NAMES.has(name.toLowerCase())}
export function isUniversalSourceDomain(domain:string){return UNIVERSAL_SOURCE_HOSTS.some(host=>domain===host||domain.endsWith(`.${host}`))}
export function looksLikeSourceUrl(raw:string,title="",description=""){
  const domain=radarDomain(raw);if(!domain)return true;
  if(isUniversalSourceDomain(domain))return true;
  try{const url=new URL(raw);if(SOURCE_PATH_RE.test(url.pathname))return true}catch{}
  return SOURCE_TITLE_RE.test(`${title} ${description}`.toLowerCase());
}
export function isOfficialCompanyWebsite(candidateUrl:string,sourceUrl?:string,sourceType?:string){
  const candidateDomain=radarDomain(candidateUrl);if(!candidateDomain||isUniversalSourceDomain(candidateDomain))return false;
  if(sourceUrl&&sourceType&&sourceType!=="company"&&candidateDomain===radarDomain(sourceUrl))return false;
  return true;
}

export function splitDiscoveryTerms(value:unknown):string[]{
  const input=Array.isArray(value)?value.map(String):[String(value||"")];
  return input.flatMap(row=>String(row).replace(/\r/g,"\n").split(/\n|[,;|•·]+|\s{2,}/g)).map(x=>x.replace(/^[\-–—•·\s]+/,"").replace(/[\s.]+$/," ").trim()).filter(Boolean);
}
export function conciseDiscoveryTerms(value:unknown,limit=30):string[]{
  const out:string[]=[];
  for(const part of splitDiscoveryTerms(value)){
    const clean=part.replace(/\s+/g," ").trim();const words=clean.split(/\s+/).filter(Boolean);const normalized=clean.toLowerCase().replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
    if(clean.length<3||clean.length>96||words.length>12||GENERIC_NAMES.has(normalized))continue;
    if(!out.some(x=>x.toLowerCase()===clean.toLowerCase()))out.push(clean);
    if(out.length>=limit)break;
  }
  return out;
}
export function cleanDiscoveryQuery(value:string,max=180){const q=String(value||"").replace(/\s+/g," ").trim();return q.length>=8&&q.length<=max?q:""}
