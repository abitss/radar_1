"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, ExternalLink, LoaderCircle, Radar, ShieldCheck, Signal, Target, ThumbsDown, ThumbsUp } from "lucide-react";

function pct(v:any){return `${Math.round(Number(v||0))}%`}
const categories=["direct","adjacent","substitute","emerging","incumbent","watchlist","micro"];

export default function CompetitorDossierPage(){
  const params=useParams<{id:string}>();
  const [data,setData]=useState<any>(null);const [error,setError]=useState("");const [busy,setBusy]=useState("");const [message,setMessage]=useState("");
  async function load(){if(!params?.id)return;try{const r=await fetch(`/api/radar/competitors/${encodeURIComponent(params.id)}`,{cache:"no-store"});const j=await r.json();if(!r.ok)throw new Error(j.error||"Could not load competitor");setData(j)}catch(e){setError(e instanceof Error?e.message:"Could not load competitor")}}
  useEffect(()=>{load()},[params?.id]);

  async function monitor(){setBusy("monitor");setMessage("");try{const r=await fetch(`/api/radar/competitors/${encodeURIComponent(params.id)}/monitor`,{method:"POST"});const d=await r.json();if(!r.ok)throw new Error(d.error||"Could not start monitoring");setMessage(d.alreadyActive?"Continuous monitoring is already active.":"Continuous competitor monitoring activated.");await load()}catch(e){setMessage(e instanceof Error?e.message:"Could not start monitoring")}finally{setBusy("")}}
  async function reclassify(category:string){setBusy("classify");const r=await fetch(`/api/radar/competitors/${encodeURIComponent(params.id)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({category})});if(r.ok)await load();else setMessage("Could not update classification.");setBusy("")}
  async function feedback(type:"useful"|"not_competitor"){setBusy(type);const r=await fetch("/api/radar/feedback",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({target_type:"competitor",target_id:params.id,feedback_type:type})});setMessage(r.ok?(type==="useful"?"Marked useful. RADAR will learn from this.":"Marked as not a competitor. Future ranking can use this signal."):"Could not save feedback.");setBusy("")}

  if(error)return <div className="content"><Link href="/companies" className="secondary-button"><ArrowLeft size={13}/>Competitors</Link><div className="panel founder-panel" style={{marginTop:14}}>{error}</div></div>;
  if(!data)return <div className="content"><div className="panel founder-panel">Loading competitor dossier...</div></div>;
  const c=data.competitor,d=data.dimensions;
  const dims=d?[['Problem',d.problem_overlap],['Customer',d.customer_overlap],['Buyer',d.buyer_overlap],['Product',d.product_overlap],['Workflow',d.workflow_overlap],['Features',d.feature_overlap],['Technology',d.technology_overlap],['Business model',d.business_model_overlap],['Distribution',d.distribution_overlap],['Geography',d.geography_overlap]]:[];
  const activeMonitor=data.monitors.some((m:any)=>m.status==="active");
  return <div className="content">
    <div style={{marginBottom:14,display:"flex",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}><Link href="/companies" className="secondary-button"><ArrowLeft size={13}/>All competitors</Link><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className="secondary-button" onClick={()=>feedback("useful")} disabled={!!busy}><ThumbsUp size={13}/> Useful</button><button className="secondary-button" onClick={()=>feedback("not_competitor")} disabled={!!busy}><ThumbsDown size={13}/> Not a competitor</button><button className="primary-button" onClick={monitor} disabled={!!busy||activeMonitor}>{busy==="monitor"?<LoaderCircle size={13}/>:<ShieldCheck size={13}/>} {activeMonitor?"Monitoring active":"Monitor company"}</button></div></div>
    {message?<div className="competition-live-message" style={{marginBottom:12}}>{message}</div>:null}
    <div className="founder-today-head"><div><span>COMPETITOR DOSSIER · {String(c.category||"emerging").toUpperCase()}</span><h1>{c.name}</h1><p>{c.description||c.why_it_matters||c.website}</p></div><a className="secondary-button" href={c.website} target="_blank" rel="noreferrer">Visit source <ExternalLink size={13}/></a></div>
    <section className="metrics-grid"><div className="stat-tile"><span>Similarity</span><strong>{pct(c.similarity_score)}</strong><small>Competitive proximity</small></div><div className="stat-tile"><span>Threat</span><strong>{pct(c.threat_score)}</strong><small>Strategic risk</small></div><div className="stat-tile"><span>Momentum</span><strong>{pct(c.momentum_score)}</strong><small>{c.movement||"stable"}</small></div><div className="stat-tile"><span>Evidence</span><strong>{data.evidence.length}</strong><small>Source-backed observations</small></div></section>

    <section className="founder-two-col">
      <article className="panel founder-panel"><div className="founder-panel-head"><div><span>WHY IT IS ON YOUR RADAR</span><h2>Competitive interpretation</h2></div><Radar size={20}/></div><p>{c.why_it_matters||"RADAR has not collected enough evidence to explain this placement yet."}</p><div className="founder-action-block"><span>MOVEMENT</span><strong>{c.movement==="closer"?"Moving toward your competitive core":c.movement==="away"?"Moving away from your current position":"No material movement detected"}</strong></div></article>
      <article className="panel founder-panel"><div className="founder-panel-head"><div><span>CLASSIFICATION</span><h2>Founder-controlled category</h2></div><Target size={20}/></div><select value={c.category||"emerging"} disabled={busy==="classify"} onChange={e=>reclassify(e.target.value)} style={{width:"100%",height:40,border:"1px solid #d8dcdf",borderRadius:9,padding:"0 10px",background:"white",marginBottom:12}}>{categories.map(x=><option key={x} value={x}>{x}</option>)}</select><p>RADAR can suggest a class, but founder feedback remains authoritative and is stored for future ranking quality.</p></article>
    </section>

    <section className="panel founder-panel founder-wide-panel" style={{marginTop:13}}><div className="founder-panel-head"><div><span>MICRO-LEVEL OVERLAP</span><h2>Why the distance is what it is</h2></div><Target size={20}/></div>{dims.length?<div className="founder-score-row" style={{gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))"}}>{dims.map(([label,value]:any)=><div key={label}><span>{label}</span><strong>{pct(value)}</strong></div>)}</div>:<p>Run a deep scan to calculate the ten competitive dimensions.</p>}</section>

    <section className="founder-two-col" style={{marginTop:13}}>
      <article className="panel founder-panel"><div className="founder-panel-head"><div><span>RECENT SIGNALS</span><h2>What changed</h2></div><Signal size={20}/></div><div className="founder-list-rows">{data.signals.length?data.signals.slice(0,6).map((s:any)=><div key={s.id}><strong>{s.title}</strong><span>{s.summary}</span></div>):<div><strong>No signals yet</strong><span>RADAR will add meaningful changes as evidence arrives.</span></div>}</div></article>
      <article className="panel founder-panel"><div className="founder-panel-head"><div><span>FOUNDER RESPONSE</span><h2>Recommendations</h2></div><Target size={20}/></div><div className="founder-list-rows">{data.recommendations.length?data.recommendations.slice(0,6).map((r:any)=><div key={r.id}><strong>{r.title}</strong><span>{r.action}</span></div>):<div><strong>No action recommended</strong><span>RADAR has not seen enough evidence to justify one.</span></div>}</div></article>
    </section>

    <section className="panel founder-panel founder-wide-panel" style={{marginTop:13}}><div className="founder-panel-head"><div><span>EVIDENCE ROOM</span><h2>Trace every important claim</h2></div><ShieldCheck size={20}/></div><div style={{display:"grid",gap:9}}>{data.evidence.length?data.evidence.slice(0,15).map((e:any)=><a key={e.id} href={e.source_url||"#"} target="_blank" rel="noreferrer" style={{display:"grid",gridTemplateColumns:"1fr auto",gap:12,textDecoration:"none",padding:"12px 0",borderBottom:"1px solid #e3e6e8"}}><div><strong style={{display:"block",fontSize:13,color:"#202428"}}>{e.title||"Public source"}</strong><span style={{fontSize:12,color:"#6f767c",lineHeight:1.5}}>{e.fact||e.summary}</span></div><span style={{fontSize:11,color:"#7a8085"}}>{pct(e.confidence)} <ExternalLink size={11} style={{display:"inline"}}/></span></a>):<p>No evidence has been collected yet.</p>}</div></section>
  </div>;
}
