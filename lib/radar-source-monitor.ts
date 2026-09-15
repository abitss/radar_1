import { createHash } from "node:crypto";
import { scrapeUrl } from "@/lib/firecrawl";
import { fetchSnapshotEngine } from "@/lib/radar-engine-crawl";
import { sbInsert, sbSelect, sbUpdate } from "@/lib/radar-db";
import { analyzeSemanticChange, normalizeSnapshotText } from "@/lib/radar-semantic";
import { detectMovesForWorkspace } from "@/lib/radar-moves";

function hash(text:string){return createHash("sha256").update(text).digest("hex")}
function clamp(v:any,f=0){const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(100,Math.round(n))):f}
function severityFor(impact:number){return impact>=90?"critical":impact>=75?"high":impact>=55?"watch":"info"}
function tokens(text:any){return new Set(String(text||"").toLowerCase().replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(w=>w.length>3))}
function overlap(a:any,b:any){const A=tokens(a),B=tokens(b);if(!A.size||!B.size)return 0;let both=0;for(const x of A)if(B.has(x))both++;return both/Math.max(1,Math.min(A.size,B.size))}

export async function ensureWorkspaceSources(workspaceId:string){
  const [competitors,evidence,existing]=await Promise.all([
    sbSelect(`radar_competitors?workspace_id=eq.${workspaceId}&select=id,name,website,threat_score,related_product,monitoring_preference&order=threat_score.desc&limit=80`),
    sbSelect(`radar_evidence?workspace_id=eq.${workspaceId}&select=competitor_id,source_url,source_type,title,confidence&order=observed_at.desc&limit=500`),
    sbSelect(`radar_sources?workspace_id=eq.${workspaceId}&select=id,url&limit=1000`),
  ]);
  const known=new Set(existing.map((x:any)=>String(x.url)));
  const rows:any[]=[];
  for(const c of competitors){
    if(c.monitoring_preference==="ignore")continue;
    const candidates=[{url:c.website,title:`${c.name} official website`,type:"company_home",reliability:95,priority:Math.max(60,Number(c.threat_score||0)),freq:Number(c.threat_score||0)>=75?60:240}];
    for(const e of evidence.filter((x:any)=>x.competitor_id===c.id).slice(0,10)){
      if(!e.source_url)continue;
      candidates.push({url:e.source_url,title:e.title||`${c.name} source`,type:e.source_type||"website",reliability:clamp(e.confidence,80),priority:Math.max(50,Number(c.threat_score||0)-5),freq:Number(c.threat_score||0)>=75?60:360});
    }
    for(const s of candidates){
      if(!s.url||known.has(s.url))continue;
      known.add(s.url);
      rows.push({workspace_id:workspaceId,competitor_id:c.id,url:s.url,title:s.title,source_type:s.type,reliability:s.reliability,priority:s.priority,check_frequency_minutes:s.freq,status:"active",health:"unknown",next_check_at:new Date().toISOString()});
    }
  }
  if(rows.length)await sbInsert("radar_sources",rows);
  return{added:rows.length};
}

async function fetchCurrentSnapshot(url:string){
  try{
    const direct=await fetchSnapshotEngine(url);
    const text=normalizeSnapshotText(direct.text||"");
    if(text.length>=80)return{text,contentHash:direct.hash||hash(text),title:direct.title||"",url:direct.url||url,provider:"direct"};
  }catch{}
  const page=await scrapeUrl(url);
  const text=normalizeSnapshotText(page.markdown||"");
  if(!text||text.length<80)throw new Error("Source returned too little meaningful text");
  return{text,contentHash:hash(text),title:page.title||"",url:page.url||url,provider:"firecrawl"};
}

async function findDuplicateSignal(workspaceId:string,competitorId:string,change:any){
  const recent=await sbSelect(`radar_signals?workspace_id=eq.${workspaceId}&competitor_id=eq.${competitorId}&select=id,title,summary,signal_type&order=observed_at.desc&limit=30`);
  return recent.find((s:any)=>String(s.signal_type||"")===String(change.category||"")&&Math.max(overlap(s.title,change.title),overlap(s.summary,change.summary))>=.58)||null;
}

export async function runWorkspaceSourceMonitor(workspaceId:string,limit=16){
  await ensureWorkspaceSources(workspaceId);
  const workspace=(await sbSelect(`radar_workspaces?id=eq.${workspaceId}&select=*&limit=1`))[0];
  const competitors=await sbSelect(`radar_competitors?workspace_id=eq.${workspaceId}&select=id,name,website,threat_score,related_product&limit=200`);
  const byId=new Map(competitors.map((c:any)=>[c.id,c]));
  const sources=await sbSelect(`radar_sources?workspace_id=eq.${workspaceId}&status=eq.active&or=(next_check_at.is.null,next_check_at.lte.${encodeURIComponent(new Date().toISOString())})&select=*&order=priority.desc,next_check_at.asc&limit=${limit}`);
  const result={checked:0,changed:0,signals:0,failed:0,unchanged:0,direct:0,firecrawl:0};

  for(const source of sources){
    result.checked++;
    const competitor:any=byId.get(source.competitor_id);
    try{
      const page=await fetchCurrentSnapshot(source.url);
      if(page.provider==="direct")result.direct++;else result.firecrawl++;
      const text=page.text;
      const contentHash=page.contentHash;
      const previous=(await sbSelect(`radar_snapshots?source_id=eq.${source.id}&select=*&order=fetched_at.desc&limit=1`))[0]||null;
      await sbInsert("radar_snapshots",{source_id:source.id,content_hash:contentHash,content_text:text,metadata:{title:page.title,url:page.url,provider:page.provider}});
      const minutes=Math.max(30,Number(source.check_frequency_minutes||360));
      await sbUpdate("radar_sources",`id=eq.${source.id}`,{health:"healthy",last_checked_at:new Date().toISOString(),last_success_at:new Date().toISOString(),last_error:null,next_check_at:new Date(Date.now()+minutes*60000).toISOString(),updated_at:new Date().toISOString()});
      if(!previous){result.unchanged++;continue}
      if(previous.content_hash===contentHash){result.unchanged++;continue}
      result.changed++;
      await sbUpdate("radar_sources",`id=eq.${source.id}`,{last_changed_at:new Date().toISOString(),updated_at:new Date().toISOString()});
      if(!competitor)continue;
      const change=await analyzeSemanticChange({company:competitor.name,source:source.url,previous:previous.content_text,current:text,context:{startup:workspace?.name,industry:workspace?.industry,products:workspace?.product_keywords,features:workspace?.major_features,target_customers:workspace?.target_customers,positioning:workspace?.positioning,competitor_product:competitor.related_product,competitor_threat:competitor.threat_score}});
      if(!change?.meaningful)continue;
      const duplicate=await findDuplicateSignal(workspaceId,competitor.id,change);
      const importance=clamp(change.importance,60),relevance=clamp(change.relevance,importance),urgency=clamp(change.urgency,50),novelty=clamp(change.novelty,50),confidence=clamp(change.confidence,70);
      const impactScore=clamp(importance*.34+relevance*.28+urgency*.14+novelty*.10+confidence*.14,60);
      if(duplicate){
        await sbInsert("radar_evidence",{workspace_id:workspaceId,competitor_id:competitor.id,source_url:source.url,source_type:"semantic_change_support",title:change.title||source.title,fact:change.new_state||change.summary,summary:change.explanation||change.summary,confidence,claim_type:"supporting"});
        continue;
      }
      const signals=await sbInsert("radar_signals",{workspace_id:workspaceId,competitor_id:competitor.id,signal_type:change.category,title:change.title||`${competitor.name} changed`,summary:change.summary,previous_state:change.previous_state||null,new_state:change.new_state||null,impact_score:impactScore,confidence,relevance,urgency,novelty,credibility:confidence,impact:change.impact||null,explanation:change.explanation||null,suggested_action:change.suggested_action||null,fact_or_inference:change.fact_or_inference,status:"new"});
      await sbInsert("radar_evidence",{workspace_id:workspaceId,competitor_id:competitor.id,source_url:source.url,source_type:"semantic_change",title:change.title||source.title,fact:change.new_state||change.summary,summary:change.explanation||change.summary,confidence,claim_type:"fact"});
      try{await sbInsert("radar_intelligence_events",{workspace_id:workspaceId,competitor_id:competitor.id,event_type:change.category,severity:severityFor(impactScore),title:change.title||`${competitor.name} changed`,summary:change.summary,source_url:source.url,confidence,impact_score:impactScore,dedupe_key:`semantic:${source.id}:${contentHash}`})}catch{}
      if(change.suggested_action&&impactScore>=55)await sbInsert("radar_recommendations",{workspace_id:workspaceId,competitor_id:competitor.id,priority:impactScore>=82?"high":impactScore>=65?"medium":"low",title:`Respond to: ${change.title||competitor.name}`.slice(0,240),rationale:change.impact||change.explanation||change.summary,action:change.suggested_action,status:"open"});
      if(signals[0]?.id)result.signals++;
    }catch(error){
      result.failed++;
      await sbUpdate("radar_sources",`id=eq.${source.id}`,{health:"error",last_checked_at:new Date().toISOString(),last_error:error instanceof Error?error.message.slice(0,500):"Source check failed",next_check_at:new Date(Date.now()+60*60000).toISOString(),updated_at:new Date().toISOString()}).catch(()=>{});
    }
  }
  if(result.signals)await detectMovesForWorkspace(workspaceId).catch(()=>{});
  return result;
}

export async function scheduleWorkspaceRecurringTasks(workspaceId:string){
  const specs=[
    {task_key:"source.monitor",interval_minutes:60},
    {task_key:"discovery.refresh",interval_minutes:720},
    {task_key:"market.refresh",interval_minutes:240},
    {task_key:"briefing.daily",interval_minutes:1440},
    {task_key:"briefing.weekly",interval_minutes:10080},
  ];
  const existing=await sbSelect(`radar_recurring_tasks?workspace_id=eq.${workspaceId}&select=task_key,interval_minutes,next_run_at`);
  const keys=new Set(existing.map((x:any)=>x.task_key));
  const rows=specs.filter(x=>!keys.has(x.task_key)).map(x=>({workspace_id:workspaceId,task_key:x.task_key,interval_minutes:x.interval_minutes,next_run_at:new Date(Date.now()+x.interval_minutes*60000).toISOString()}));
  if(rows.length)await sbInsert("radar_recurring_tasks",rows);
  return{added:rows.length};
}
