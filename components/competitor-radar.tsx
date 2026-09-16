"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Activity, ExternalLink, GitBranch, Layers3, LoaderCircle, Plus, Radar, Radio, Search, ShieldCheck, Sparkles } from "lucide-react";

type CanonicalCategory = "direct" | "adjacent" | "substitute" | "emerging" | "incumbent" | "watchlist";
type Competitor = {
  id: string;
  name: string;
  website: string;
  similarity_score: number;
  product_overlap_score?: number;
  relation_confidence?: number;
  threat_score: number;
  category: CanonicalCategory | "micro" | string;
  category_locked?: boolean;
  monitoring_preference?: "auto"|"monitor"|"ignore"|string;
  movement: "closer" | "stable" | "away";
  why_it_matters?: string;
  related_product?: string;
  last_scanned_at?: string;
  monitor_active?: boolean;
  monitor_last_event_at?: string | null;
  monitor_error?: string | null;
  evidence_count?: number;
  high_confidence_evidence?: number;
  verification_status?: "verified" | "evidence-backed" | "provisional";
};

type Workspace = { id:string; name:string };

const CATEGORY_ORDER:CanonicalCategory[]=["direct","adjacent","substitute","emerging","incumbent","watchlist"];
function canonicalCategory(value:any):CanonicalCategory{const v=String(value||"").toLowerCase();if(v==="micro")return"substitute";return CATEGORY_ORDER.includes(v as CanonicalCategory)?v as CanonicalCategory:"watchlist"}
function categoryLabel(value:any){const v=canonicalCategory(value);return v.charAt(0).toUpperCase()+v.slice(1)}
function clamp(value:any){const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(100,n)):0}
function hashUnit(input:string){let h=2166136261;for(let i=0;i<input.length;i++){h^=input.charCodeAt(i);h=Math.imul(h,16777619)}return((h>>>0)%10000)/10000}
function positionFor(c:Competitor){
  const score=clamp(c.similarity_score);
  const jitter=(hashUnit(`${c.id}:radius`)-.5)*3.5;
  const radius=Math.max(12,Math.min(46,12+(100-score)*.34+jitter));
  const angle=hashUnit(c.id)*Math.PI*2;
  return{x:50+Math.cos(angle)*radius,y:50+Math.sin(angle)*radius};
}
function movementText(movement:Competitor["movement"]){if(movement==="closer")return"Moving closer";if(movement==="away")return"Moving away";return"Stable"}
function verification(c:Competitor){if(c.verification_status)return c.verification_status;if(c.last_scanned_at)return"verified";if(Number(c.evidence_count||0)>0)return"evidence-backed";return"provisional"}
function when(raw?:string|null){if(!raw)return"waiting";const ms=Date.now()-new Date(raw).getTime();const min=Math.max(0,Math.floor(ms/60000));if(min<1)return"just now";if(min<60)return`${min}m ago`;const h=Math.floor(min/60);if(h<24)return`${h}h ago`;return`${Math.floor(h/24)}d ago`}

export function CompetitorRadar(){
  const [workspace,setWorkspace]=useState<Workspace|null>(null);
  const [competitors,setCompetitors]=useState<Competitor[]>([]);
  const [selectedId,setSelectedId]=useState("");
  const [filter,setFilter]=useState<"all"|CanonicalCategory>("all");
  const [name,setName]=useState(""); const [website,setWebsite]=useState("");
  const [adding,setAdding]=useState(false); const [scanningId,setScanningId]=useState(""); const [monitoringId,setMonitoringId]=useState("");
  const [message,setMessage]=useState(""); const [loadError,setLoadError]=useState("");

  async function load(silent=false){
    try{
      const [wr,cr]=await Promise.all([fetch("/api/radar/workspace",{cache:"no-store"}),fetch("/api/radar/competitors",{cache:"no-store"})]);
      const [w,c]=await Promise.all([wr.json(),cr.json()]);
      if(!wr.ok)throw new Error(w?.error||"Could not load workspace");
      if(!cr.ok)throw new Error(c?.error||"Could not load competitors");
      const rows=Array.isArray(c)?c:[];
      setWorkspace(w);setCompetitors(rows);setLoadError("");
      const activeRows=rows.filter((row:any)=>row.monitoring_preference!=="ignore");
      setSelectedId(current=>current&&activeRows.some((row:any)=>row.id===current)?current:(activeRows[0]?.id||""));
    }catch(error){if(!silent)setLoadError(error instanceof Error?error.message:"Could not load RADAR")}
  }

  useEffect(()=>{load();const timer=window.setInterval(()=>load(true),10000);const onFocus=()=>load(true);window.addEventListener("focus",onFocus);return()=>{window.clearInterval(timer);window.removeEventListener("focus",onFocus)}},[]);

  const normalized=useMemo(()=>competitors.filter(c=>c.monitoring_preference!=="ignore").map(c=>({...c,category:canonicalCategory(c.category)})),[competitors]);
  const ignoredCount=useMemo(()=>competitors.filter(c=>c.monitoring_preference==="ignore").length,[competitors]);
  const filterOptions=useMemo(()=>(["all",...CATEGORY_ORDER.filter(cat=>normalized.some(c=>c.category===cat))] as Array<"all"|CanonicalCategory>),[normalized]);
  const visible=useMemo(()=>normalized.filter(c=>filter==="all"||c.category===filter).sort((a,b)=>Number(b.similarity_score||0)-Number(a.similarity_score||0)),[normalized,filter]);
  const plotted=visible.slice(0,40);
  const selected=visible.find(c=>c.id===selectedId)||visible[0]||null;

  function chooseFilter(next:"all"|CanonicalCategory){setFilter(next);const rows=normalized.filter(c=>next==="all"||c.category===next);if(!rows.some(c=>c.id===selectedId))setSelectedId(rows[0]?.id||"")}

  async function addCompetitor(e:FormEvent){
    e.preventDefault();if(!website.trim()||adding)return;setAdding(true);setMessage("");
    try{
      const res=await fetch("/api/radar/competitors",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,website})});const data=await res.json();
      if(!res.ok)throw new Error(data.error||"Could not add competitor");
      setName("");setWebsite("");setSelectedId(data.id||"");await load(true);setMessage("Company added to the watchlist as provisional. Run a deep scan to verify its position.");
    }catch(error){setMessage(error instanceof Error?error.message:"Could not add competitor")}finally{setAdding(false)}
  }

  async function deepScan(){
    if(!selected||scanningId)return;setScanningId(selected.id);setMessage(`Verifying ${selected.name} from first-party evidence...`);
    try{
      const res=await fetch("/api/radar/scan",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({competitorId:selected.id})});const data=await res.json();
      if(!res.ok&&!data?.cooldown)throw new Error(data.error||"Scan failed");
      if(data?.cooldown)setMessage(data.error||"A scan is already running.");
      else if(data?.degraded)setMessage(data.why||"No first-party evidence was available, so existing scores were preserved.");
      else setMessage(`Verified ${selected.name}: ${Math.round(Number(data.similarity||0))}% strategic similarity · ${Math.round(Number(data.product_overlap||0))}% product overlap · ${Math.round(Number(data.threat||0))}% threat.${data.category_locked?` Founder category remains locked as ${data.category}.`:""}`);
      await load(true);
    }catch(error){setMessage(error instanceof Error?error.message:"Scan failed")}finally{setScanningId("")}
  }

  async function startMonitor(){
    if(!selected||selected.monitor_active||monitoringId)return;setMonitoringId(selected.id);setMessage(`Activating continuous watch for ${selected.name}...`);
    try{const res=await fetch(`/api/radar/competitors/${selected.id}/monitor`,{method:"POST"});const data=await res.json();if(!res.ok)throw new Error(data.error||"Could not activate monitoring");await load(true);setMessage(data.alreadyPending?`${selected.name} monitoring activation is already pending.`:`${selected.name} is now under continuous entity surveillance.`)}catch(error){setMessage(error instanceof Error?error.message:"Could not activate monitoring")}finally{setMonitoringId("")}
  }

  return <section className="competition-command">
    <div className="competition-toolbar">
      <div><span className="competition-kicker">LIVE COMPETITION RADAR</span><h2>{workspace?.name||"Your company"} at the center.</h2><p>Distance represents strategic similarity. Category describes the competitive relationship. Provisional nodes remain visibly provisional until first-party evidence verifies them.</p></div>
      <div className="competition-filters" aria-label="Competition filters">{filterOptions.map(item=><button key={item} onClick={()=>chooseFilter(item)} className={filter===item?"active":""}>{item==="all"?"All":categoryLabel(item)}</button>)}</div>
    </div>

    <form className="competition-add" onSubmit={addCompetitor}>
      <div><Plus size={15}/><strong>Add a company you want RADAR to investigate</strong></div>
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="Company name (optional)"/>
      <input value={website} onChange={e=>setWebsite(e.target.value)} placeholder="company.com" required/>
      <button disabled={adding} type="submit">{adding?<LoaderCircle size={13}/>:<Plus size={13}/>} {adding?"Adding...":"Add to watchlist"}</button>
    </form>
    {loadError?<div className="competition-live-message radar-error-message">{loadError}</div>:null}
    {message?<div className="competition-live-message">{message}</div>:null}

    <div className="competition-grid">
      <article className="competition-radar-card">
        <div className="radar-stage">
          <div className="radar-crosshair horizontal"/><div className="radar-crosshair vertical"/>
          {[1,2,3,4].map(ring=><div key={ring} className={`competition-ring ring-${ring}`}/>)}
          <div className="radar-sweep"/>
          <button className="company-core" aria-label="Your company"><span>YOU</span><strong>{(workspace?.name||"YOUR COMPANY").slice(0,18)}</strong></button>
          {plotted.map(company=>{const p=positionFor(company);const state=verification(company);return <button key={company.id} className={`competitor-node ${company.category} ${state} ${selected?.id===company.id?"selected":""}`} style={{left:`${p.x}%`,top:`${p.y}%`}} onClick={()=>setSelectedId(company.id)} title={`${company.name} · ${Math.round(clamp(company.similarity_score))}% similarity · ${state}`} aria-label={`${company.name}, ${Math.round(clamp(company.similarity_score))}% similarity, ${state}`}><span className="node-dot"/><strong>{company.name}</strong><small>{Math.round(clamp(company.similarity_score))}%</small></button>})}
          {!normalized.length?<div className="radar-empty-state"><Radar size={30}/><strong>Your competitive universe is empty.</strong><span>Run discovery or add a company to begin mapping.{ignoredCount?` ${ignoredCount} founder-ignored entit${ignoredCount===1?"y is":"ies are"} hidden.`:""}</span></div>:!visible.length?<div className="radar-empty-state"><Layers3 size={30}/><strong>No companies in this filter.</strong><span>Choose another competitive category.</span></div>:null}
        </div>
        <footer className="competition-legend"><span>CORE 80–100% similarity</span><span>NEAR 60–79%</span><span>WATCH 35–59%</span><span>OUTER &lt;35%</span>{visible.length>40?<span>Top 40 plotted</span>:null}{ignoredCount?<span>{ignoredCount} ignored hidden</span>:null}</footer>
      </article>

      <aside className="competition-detail panel">
        {selected?<>
          <div className="competition-detail-head"><div><span>SELECTED ENTITY · {verification(selected).toUpperCase()}</span><h3>{selected.name}</h3></div><span className={`movement-chip ${selected.movement}`}>{movementText(selected.movement)}</span></div>
          <div className="competition-product-line"><span>COMPETING PRODUCT / OFFER</span><strong>{selected.related_product||"Specific product relationship still being resolved"}</strong></div>
          <div className="competition-score-row radar-three-scores"><div><span>Similarity</span><strong>{Math.round(clamp(selected.similarity_score))}%</strong><i><b style={{width:`${clamp(selected.similarity_score)}%`}}/></i></div><div><span>Product overlap</span><strong>{Math.round(clamp(selected.product_overlap_score))}%</strong><i><b style={{width:`${clamp(selected.product_overlap_score)}%`}}/></i></div><div><span>Threat</span><strong>{Math.round(clamp(selected.threat_score))}%</strong><i><b style={{width:`${clamp(selected.threat_score)}%`}}/></i></div></div>
          <div className="competition-why"><span>WHY RADAR PLACED IT HERE</span><p>{selected.why_it_matters||"Run a deep scan to calculate evidence-backed strategic overlap."}</p></div>
          <div className="overlap-stack"><span>INTELLIGENCE STATE</span><div><ShieldCheck size={13}/><strong>{categoryLabel(selected.category)} relationship · {verification(selected)}{selected.category_locked?" · founder locked":""}</strong></div><div><Activity size={13}/><strong>{Math.round(clamp(selected.relation_confidence))}% relationship confidence · {Number(selected.evidence_count||0)} evidence item{Number(selected.evidence_count||0)===1?"":"s"} · {Number(selected.high_confidence_evidence||0)} high-confidence</strong></div><div><Radio size={13}/><strong>{selected.monitor_active?`Monitoring active · last event ${when(selected.monitor_last_event_at)}`:selected.monitor_error?`Monitor error · ${selected.monitor_error}`:"Continuous watch not active"}</strong></div></div>
          <div className="competition-actions radar-action-grid"><button onClick={deepScan} disabled={Boolean(scanningId)}><Search size={14}/>{scanningId===selected.id?"Scanning...":"Deep scan"}</button><button onClick={startMonitor} disabled={selected.monitor_active||Boolean(monitoringId)}><Radio size={14}/>{selected.monitor_active?"Monitoring":monitoringId===selected.id?"Activating...":"Monitor"}</button><Link href={`/companies/${selected.id}`}><GitBranch size={14}/>Open dossier</Link>{selected.website?<a href={selected.website} target="_blank" rel="noreferrer"><ExternalLink size={14}/>Website</a>:<span/>}</div>
        </>:<div className="competition-empty-detail"><Layers3 size={24}/><strong>Select a company</strong><p>RADAR will show evidence-backed similarity, product overlap and threat here.</p></div>}
      </aside>
    </div>

    <div className="surveillance-strip"><div className="surveillance-copy"><Radar size={17}/><div><span>PUBLIC-SIGNAL SURVEILLANCE</span><strong>Evidence first, then movement</strong></div></div><div className="surveillance-sources">{["Discovery","First-party evidence","Similarity","Product overlap","Threat","Monitoring","Signals","Decisions"].map(source=><span key={source}>{source}</span>)}</div></div>

    <div className="micro-intelligence-grid">
      <article className="panel micro-intel-card"><div className="micro-intel-icon"><Layers3 size={18}/></div><span>RELATIONSHIP TYPE</span><h3>Category and distance are different things.</h3><p>Direct, adjacent, substitute, emerging, incumbent and watchlist describe how a company competes. Distance is calculated from strategic similarity.</p></article>
      <article className="panel micro-intel-card"><div className="micro-intel-icon"><Activity size={18}/></div><span>CONVERGENCE</span><h3>Movement requires comparable evidence.</h3><p>Deep scans preserve previous similarity, compare the latest verified state, and mark meaningful movement as closer, stable or away.</p></article>
      <article className="panel micro-intel-card"><div className="micro-intel-icon"><Sparkles size={18}/></div><span>DECISION MEMORY</span><h3>Strong evidence becomes founder action.</h3><p>Relevant scans create signals and recommendations so competitive changes do not disappear into a passive feed.</p></article>
    </div>
  </section>;
}
