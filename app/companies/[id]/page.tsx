"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, ExternalLink, Radar, ShieldCheck, Signal, Target } from "lucide-react";

function pct(v:any){return `${Math.round(Number(v||0))}%`}

export default function CompetitorDossierPage(){
  const params=useParams<{id:string}>();
  const [data,setData]=useState<any>(null);const [error,setError]=useState("");
  useEffect(()=>{if(!params?.id)return;fetch(`/api/radar/competitors/${encodeURIComponent(params.id)}`,{cache:"no-store"}).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error||"Could not load competitor");return j}).then(setData).catch(e=>setError(e.message))},[params?.id]);
  if(error)return <div className="content"><Link href="/companies" className="secondary-button"><ArrowLeft size={13}/>Competitors</Link><div className="panel founder-panel" style={{marginTop:14}}>{error}</div></div>;
  if(!data)return <div className="content"><div className="panel founder-panel">Loading competitor dossier...</div></div>;
  const c=data.competitor,d=data.dimensions;
  const dims=d?[['Problem',d.problem_overlap],['Customer',d.customer_overlap],['Buyer',d.buyer_overlap],['Product',d.product_overlap],['Workflow',d.workflow_overlap],['Features',d.feature_overlap],['Technology',d.technology_overlap],['Business model',d.business_model_overlap],['Distribution',d.distribution_overlap],['Geography',d.geography_overlap]]:[];
  return <div className="content">
    <div style={{marginBottom:14}}><Link href="/companies" className="secondary-button"><ArrowLeft size={13}/>All competitors</Link></div>
    <div className="founder-today-head"><div><span>COMPETITOR DOSSIER · {String(c.category||"emerging").toUpperCase()}</span><h1>{c.name}</h1><p>{c.description||c.why_it_matters||c.website}</p></div><a className="secondary-button" href={c.website} target="_blank" rel="noreferrer">Visit source <ExternalLink size={13}/></a></div>
    <section className="metrics-grid"><div className="stat-tile"><span>Similarity</span><strong>{pct(c.similarity_score)}</strong><small>Competitive proximity</small></div><div className="stat-tile"><span>Threat</span><strong>{pct(c.threat_score)}</strong><small>Strategic risk</small></div><div className="stat-tile"><span>Momentum</span><strong>{pct(c.momentum_score)}</strong><small>{c.movement||"stable"}</small></div><div className="stat-tile"><span>Evidence</span><strong>{data.evidence.length}</strong><small>Source-backed observations</small></div></section>

    <section className="founder-two-col">
      <article className="panel founder-panel"><div className="founder-panel-head"><div><span>WHY IT IS ON YOUR RADAR</span><h2>Competitive interpretation</h2></div><Radar size={20}/></div><p>{c.why_it_matters||"RADAR has not collected enough evidence to explain this placement yet."}</p><div className="founder-action-block"><span>MOVEMENT</span><strong>{c.movement==="closer"?"Moving toward your competitive core":c.movement==="away"?"Moving away from your current position":"No material movement detected"}</strong></div></article>
      <article className="panel founder-panel"><div className="founder-panel-head"><div><span>SURVEILLANCE</span><h2>{data.monitors.some((m:any)=>m.status==="active")?"Continuous watch active":"Not yet under continuous watch"}</h2></div><ShieldCheck size={20}/></div><p>{data.monitors[0]?.last_event_at?`Last monitor event: ${new Date(data.monitors[0].last_event_at).toLocaleString()}`:"RADAR will attach a monitor after a qualifying deep scan."}</p><div className="founder-action-block"><span>LAST DEEP SCAN</span><strong>{c.last_scanned_at?new Date(c.last_scanned_at).toLocaleString():"Not yet"}</strong></div></article>
    </section>

    <section className="panel founder-panel founder-wide-panel" style={{marginTop:13}}><div className="founder-panel-head"><div><span>MICRO-LEVEL OVERLAP</span><h2>Why the distance is what it is</h2></div><Target size={20}/></div>{dims.length?<div className="founder-score-row" style={{gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))"}}>{dims.map(([label,value]:any)=><div key={label}><span>{label}</span><strong>{pct(value)}</strong></div>)}</div>:<p>Run a deep scan to calculate the ten competitive dimensions.</p>}</section>

    <section className="founder-two-col" style={{marginTop:13}}>
      <article className="panel founder-panel"><div className="founder-panel-head"><div><span>RECENT SIGNALS</span><h2>What changed</h2></div><Signal size={20}/></div><div className="founder-list-rows">{data.signals.length?data.signals.slice(0,6).map((s:any)=><div key={s.id}><strong>{s.title}</strong><span>{s.summary}</span></div>):<div><strong>No signals yet</strong><span>RADAR will add meaningful changes as evidence arrives.</span></div>}</div></article>
      <article className="panel founder-panel"><div className="founder-panel-head"><div><span>FOUNDER RESPONSE</span><h2>Recommendations</h2></div><Target size={20}/></div><div className="founder-list-rows">{data.recommendations.length?data.recommendations.slice(0,6).map((r:any)=><div key={r.id}><strong>{r.title}</strong><span>{r.action}</span></div>):<div><strong>No action recommended</strong><span>RADAR has not seen enough evidence to justify one.</span></div>}</div></article>
    </section>

    <section className="panel founder-panel founder-wide-panel" style={{marginTop:13}}><div className="founder-panel-head"><div><span>EVIDENCE ROOM</span><h2>Trace every important claim</h2></div><ShieldCheck size={20}/></div><div style={{display:"grid",gap:9}}>{data.evidence.length?data.evidence.slice(0,15).map((e:any)=><a key={e.id} href={e.source_url||"#"} target="_blank" rel="noreferrer" style={{display:"grid",gridTemplateColumns:"1fr auto",gap:12,textDecoration:"none",padding:"12px 0",borderBottom:"1px solid #e3e6e8"}}><div><strong style={{display:"block",fontSize:13,color:"#202428"}}>{e.title||"Public source"}</strong><span style={{fontSize:12,color:"#6f767c",lineHeight:1.5}}>{e.fact||e.summary}</span></div><span style={{fontSize:11,color:"#7a8085"}}>{pct(e.confidence)} <ExternalLink size={11} style={{display:"inline"}}/></span></a>):<p>No evidence has been collected yet.</p>}</div></section>
  </div>;
}
