"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, LoaderCircle, PauseCircle, Radar, RotateCcw, ScanSearch, ShieldCheck, Signal, Target, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";

function pct(v:any){return `${Math.round(Number(v||0))}%`}
function ago(raw?:string|null){if(!raw)return"never";const ms=Date.now()-new Date(raw).getTime();const m=Math.max(0,Math.floor(ms/60000));if(m<1)return"just now";if(m<60)return`${m}m ago`;const h=Math.floor(m/60);if(h<24)return`${h}h ago`;return`${Math.floor(h/24)}d ago`}
const categories=["direct","adjacent","substitute","emerging","incumbent","watchlist"];

export default function CompetitorDossierPage(){
  const params=useParams<{id:string}>();
  const router=useRouter();
  const [data,setData]=useState<any>(null);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState("");
  const [message,setMessage]=useState("");

  async function load(silent=false){
    if(!params?.id)return;
    try{
      const r=await fetch(`/api/radar/competitors/${encodeURIComponent(params.id)}`,{cache:"no-store"});
      const j=await r.json();
      if(!r.ok)throw new Error(j.error||"Could not load competitor");
      setData(j);setError("");
    }catch(e){if(!silent)setError(e instanceof Error?e.message:"Could not load competitor")}
  }
  useEffect(()=>{load();const timer=window.setInterval(()=>load(true),10000);const onFocus=()=>load(true);window.addEventListener("focus",onFocus);return()=>{window.clearInterval(timer);window.removeEventListener("focus",onFocus)}},[params?.id]);

  async function monitor(){
    setBusy("monitor");setMessage("");
    try{const r=await fetch(`/api/radar/competitors/${encodeURIComponent(params.id)}/monitor`,{method:"POST"});const d=await r.json();if(!r.ok)throw new Error(d.error||"Could not start monitoring");setMessage(d.alreadyActive?"Continuous monitoring is already active.":d.alreadyPending?"Monitoring activation is already pending.":"Continuous competitor monitoring activated.");await load(true)}catch(e){setMessage(e instanceof Error?e.message:"Could not start monitoring")}finally{setBusy("")}
  }

  async function stopMonitor(){
    setBusy("stop-monitor");setMessage("Stopping provider monitoring...");
    try{const r=await fetch(`/api/radar/competitors/${encodeURIComponent(params.id)}/monitor`,{method:"DELETE"});const d=await r.json();if(!r.ok)throw new Error(d.error||"Could not stop monitoring");setMessage(`Continuous monitoring stopped${d.stopped?` · ${d.stopped} provider watch${d.stopped===1?"":"es"} closed`:""}.`);await load(true)}catch(e){setMessage(e instanceof Error?e.message:"Could not stop monitoring")}finally{setBusy("")}
  }

  async function deepScan(){
    setBusy("scan");setMessage("Collecting current first-party evidence and recalculating competitive distance...");
    try{const r=await fetch("/api/radar/scan",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({competitorId:params.id})});const d=await r.json();if(!r.ok&&!d.cooldown)throw new Error(d.error||"Deep scan failed");if(d.cooldown)setMessage(d.error);else if(d.degraded)setMessage(d.why||"No verifiable first-party evidence was available; existing scores were preserved.");else setMessage(`Deep scan complete. Similarity ${Math.round(Number(d.similarity||0))}% · product overlap ${Math.round(Number(d.product_overlap||0))}% · threat ${Math.round(Number(d.threat||0))}% · ${d.pages_scanned||0} first-party pages analyzed.${d.category_locked?` Founder category remains locked as ${d.category}.`:""}`);await load(true)}catch(e){setMessage(e instanceof Error?e.message:"Deep scan failed")}finally{setBusy("")}
  }

  async function reclassify(category:string){
    setBusy("classify");setMessage("");
    try{const r=await fetch(`/api/radar/competitors/${encodeURIComponent(params.id)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({category})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Could not update classification.");setMessage(`Category locked to ${category}. Automated scans will preserve this founder override.`);await load(true)}catch(e){setMessage(e instanceof Error?e.message:"Could not update classification.")}finally{setBusy("")}
  }

  async function unlockCategory(){
    setBusy("classify");setMessage("");
    try{const r=await fetch(`/api/radar/competitors/${encodeURIComponent(params.id)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({unlock_category:true})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Could not restore automatic classification.");setMessage("Automatic category classification restored. The next evidence refresh may update this relationship type.");await load(true)}catch(e){setMessage(e instanceof Error?e.message:"Could not restore automatic classification.")}finally{setBusy("")}
  }

  async function feedback(type:"useful"|"not_competitor"){
    setBusy(type);setMessage("");
    try{const r=await fetch("/api/radar/feedback",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({target_type:"competitor",target_id:params.id,feedback_type:type})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Could not save feedback.");setMessage(type==="useful"?"Marked useful. RADAR will retain this founder signal.":"Marked as not a competitor. Provider monitoring is stopped and this entity is removed from the active competitive universe.");await load(true)}catch(e){setMessage(e instanceof Error?e.message:"Could not save feedback.")}finally{setBusy("")}
  }

  async function restore(){
    setBusy("restore");setMessage("");
    try{const r=await fetch(`/api/radar/competitors/${encodeURIComponent(params.id)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({monitoring_preference:"auto",user_feedback:"restored"})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Could not restore competitor.");setMessage("Competitor restored to the active universe. Run a deep scan to refresh its current position.");await load(true)}catch(e){setMessage(e instanceof Error?e.message:"Could not restore competitor.")}finally{setBusy("")}
  }

  async function removeCompetitor(){
    if(!data?.competitor)return;
    if(!window.confirm(`Remove ${data.competitor.name} and its RADAR evidence, sources, signals, moves and decisions? This cannot be undone.`))return;
    setBusy("delete");setMessage("Stopping provider watches and removing competitor intelligence...");
    try{const r=await fetch(`/api/radar/competitors/${encodeURIComponent(params.id)}`,{method:"DELETE"});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Could not remove competitor.");router.push("/companies");router.refresh()}catch(e){setMessage(e instanceof Error?e.message:"Could not remove competitor.");setBusy("")}
  }

  if(error)return <div className="content"><Link href="/companies" className="secondary-button"><ArrowLeft size={13}/>Competitors</Link><div className="panel founder-panel" style={{marginTop:14}}>{error}<button className="secondary-button" style={{marginTop:12}} onClick={()=>load()}>Retry</button></div></div>;
  if(!data)return <div className="content"><div className="panel founder-panel">Loading competitor dossier...</div></div>;

  const c=data.competitor,d=data.dimensions,state=data.state||{};
  const dims=d?[['Problem',d.problem_overlap],['Customer',d.customer_overlap],['Buyer',d.buyer_overlap],['Product',d.product_overlap],['Workflow',d.workflow_overlap],['Features',d.feature_overlap],['Technology',d.technology_overlap],['Business model',d.business_model_overlap],['Distribution',d.distribution_overlap],['Geography',d.geography_overlap]]:[];
  const activeMonitor=Boolean(state.active_monitor||data.monitors.some((m:any)=>m.status==="active"));
  const ignored=c.monitoring_preference==="ignore";

  return <div className="content">
    <div className="competitor-dossier-actions"><Link href="/companies" className="secondary-button"><ArrowLeft size={13}/>All competitors</Link><div>{ignored?<button className="secondary-button" onClick={restore} disabled={!!busy}><RotateCcw size={13}/> Restore</button>:<><button className="secondary-button" onClick={()=>feedback("useful")} disabled={!!busy}><ThumbsUp size={13}/> Useful</button><button className="secondary-button" onClick={()=>feedback("not_competitor")} disabled={!!busy}><ThumbsDown size={13}/> Not a competitor</button></>}<button className="secondary-button" onClick={deepScan} disabled={!!busy}>{busy==="scan"?<LoaderCircle size={13}/>:<ScanSearch size={13}/>} {busy==="scan"?"Scanning...":"Deep scan"}</button>{activeMonitor?<button className="secondary-button" onClick={stopMonitor} disabled={!!busy}>{busy==="stop-monitor"?<LoaderCircle size={13}/>:<PauseCircle size={13}/>} Stop monitoring</button>:<button className="primary-button" onClick={monitor} disabled={!!busy||ignored}>{busy==="monitor"?<LoaderCircle size={13}/>:<ShieldCheck size={13}/>} Monitor company</button>}<button className="secondary-button competitor-delete-button" onClick={removeCompetitor} disabled={!!busy}><Trash2 size={13}/> Remove</button></div></div>

    {message?<div className="competition-live-message" style={{marginBottom:12}}>{message}</div>:null}
    {state.monitor_error?<div className="competition-live-message radar-error-message" style={{marginBottom:12}}>Monitoring provider: {state.monitor_error}</div>:null}

    <div className="founder-today-head"><div><span>COMPETITOR DOSSIER · {String(c.category||"emerging").toUpperCase()} · {String(state.verification_status||"provisional").toUpperCase()}</span><h1>{c.name}</h1><p>{c.description||c.why_it_matters||c.website}</p></div><a className="secondary-button" href={c.website} target="_blank" rel="noreferrer">Visit official site <ExternalLink size={13}/></a></div>

    <section className="metrics-grid"><div className="stat-tile"><span>Similarity</span><strong>{pct(c.similarity_score)}</strong><small>Strategic proximity</small></div><div className="stat-tile"><span>Product overlap</span><strong>{pct(c.product_overlap_score)}</strong><small>{pct(c.relation_confidence)} relation confidence</small></div><div className="stat-tile"><span>Threat</span><strong>{pct(c.threat_score)}</strong><small>{c.movement||"stable"} movement</small></div><div className="stat-tile"><span>Evidence</span><strong>{state.evidence_count??data.evidence.length}</strong><small>{state.high_confidence_evidence||0} high-confidence · {state.healthy_sources||0}/{state.source_count||0} healthy sources</small></div></section>

    <section className="competitor-state-grid panel"><div><span>Verification</span><strong>{state.verification_status||"provisional"}</strong><small>{c.last_scanned_at?`Deep scan ${ago(c.last_scanned_at)}`:"No first-party deep scan yet"}</small></div><div><span>Monitoring</span><strong>{activeMonitor?"Active":ignored?"Ignored":"Inactive"}</strong><small>{state.monitor_last_event_at?`Last event ${ago(state.monitor_last_event_at)}`:"No provider event yet"}</small></div><div><span>Moves</span><strong>{state.active_moves||0}</strong><small>Watching or confirmed strategic moves</small></div><div><span>Founder decisions</span><strong>{state.open_decisions||0}</strong><small>Open decisions linked to this competitor</small></div></section>

    <section className="founder-two-col">
      <article className="panel founder-panel"><div className="founder-panel-head"><div><span>WHY IT IS ON YOUR RADAR</span><h2>Competitive interpretation</h2></div><Radar size={20}/></div><p>{c.why_it_matters||"RADAR has not collected enough evidence to explain this placement yet."}</p><div className="founder-action-block"><span>MOVEMENT</span><strong>{c.movement==="closer"?"Moving toward your competitive core":c.movement==="away"?"Moving away from your current position":"No material movement detected"}</strong></div></article>
      <article className="panel founder-panel"><div className="founder-panel-head"><div><span>CLASSIFICATION</span><h2>Founder-controlled relationship type</h2></div><Target size={20}/></div><select value={c.category||"emerging"} disabled={busy==="classify"||ignored} onChange={e=>reclassify(e.target.value)}>{categories.map(x=><option key={x} value={x}>{x}</option>)}</select><p>{c.category_locked?"Founder override is locked. Deep scans and landscape refreshes will update scores without changing this category.":"Category is automatic and may change when stronger evidence changes the relationship."}</p>{c.category_locked&&!ignored?<button className="secondary-button" onClick={unlockCategory} disabled={busy==="classify"}><RotateCcw size={13}/> Return category to RADAR</button>:null}</article>
    </section>

    <section className="panel founder-panel founder-wide-panel" style={{marginTop:13}}><div className="founder-panel-head"><div><span>COMPETITIVE DIMENSIONS</span><h2>Why the distance is what it is</h2></div><Target size={20}/></div>{dims.length?<div className="founder-score-row" style={{gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))"}}>{dims.map(([label,value]:any)=><div key={label}><span>{label}</span><strong>{pct(value)}</strong></div>)}</div>:<div><p>Run a deep scan to calculate the ten competitive dimensions from first-party public evidence.</p><button className="secondary-button" onClick={deepScan} disabled={!!busy}>{busy==="scan"?<LoaderCircle size={13}/>:<ScanSearch size={13}/>} Calculate competitive distance</button></div>}</section>

    <section className="founder-two-col" style={{marginTop:13}}><article className="panel founder-panel"><div className="founder-panel-head"><div><span>RECENT SIGNALS</span><h2>What changed</h2></div><Signal size={20}/></div><div className="founder-list-rows">{data.signals.length?data.signals.slice(0,8).map((s:any)=><div key={s.id}><strong>{s.title}</strong><span>{s.summary}</span></div>):<div><strong>No signals yet</strong><span>RADAR will add meaningful changes as evidence arrives.</span></div>}</div></article><article className="panel founder-panel"><div className="founder-panel-head"><div><span>FOUNDER RESPONSE</span><h2>Recommendations</h2></div><Target size={20}/></div><div className="founder-list-rows">{data.recommendations.length?data.recommendations.slice(0,8).map((r:any)=><div key={r.id}><strong>{r.title}</strong><span>{r.action}</span></div>):<div><strong>No action recommended</strong><span>RADAR has not seen enough evidence to justify one.</span></div>}</div></article></section>

    {(data.moves?.length||data.decisions?.length)?<section className="founder-two-col" style={{marginTop:13}}><article className="panel founder-panel"><div className="founder-panel-head"><div><span>STRATEGIC MOVES</span><h2>Correlated competitive movement</h2></div><Radar size={20}/></div><div className="founder-list-rows">{data.moves?.length?data.moves.slice(0,8).map((m:any)=><div key={m.id}><strong>{m.title}</strong><span>{m.summary||m.rationale}</span></div>):<div><strong>No correlated moves yet</strong><span>Signals need enough evidence before RADAR turns them into a move.</span></div>}</div></article><article className="panel founder-panel"><div className="founder-panel-head"><div><span>DECISIONS</span><h2>Founder choices generated from moves</h2></div><Target size={20}/></div><div className="founder-list-rows">{data.decisions?.length?data.decisions.slice(0,8).map((d:any)=><div key={d.id}><strong>{d.title}</strong><span>{d.question||d.context}</span></div>):<div><strong>No decisions yet</strong><span>RADAR only creates decision objects when the evidence justifies one.</span></div>}</div></article></section>:null}

    <section className="panel founder-panel founder-wide-panel" style={{marginTop:13}}><div className="founder-panel-head"><div><span>EVIDENCE ROOM</span><h2>Trace every important claim</h2></div><ShieldCheck size={20}/></div><div className="competitor-evidence-list">{data.evidence.length?data.evidence.slice(0,30).map((e:any)=><a key={e.id} href={e.source_url||"#"} target="_blank" rel="noreferrer"><div><strong>{e.title||"Public source"}</strong><span>{e.fact||e.summary}</span><small>{e.source_type||"public evidence"} · observed {ago(e.observed_at)}</small></div><span>{pct(e.confidence)} <ExternalLink size={11}/></span></a>):<p>No evidence has been collected yet.</p>}</div></section>
  </div>;
}
