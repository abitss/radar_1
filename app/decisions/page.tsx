"use client";

import Link from "next/link";
import { useEffect,useMemo,useState } from "react";
import { Check,CircleAlert,LoaderCircle,X } from "lucide-react";
import { PageIntro } from "@/components/intelligence-ui";

export default function DecisionsPage(){
  const[rows,setRows]=useState<any[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState("");
  async function load(){const r=await fetch("/api/radar/decisions",{cache:"no-store"});const d=await r.json();if(r.ok)setRows(Array.isArray(d)?d:[]);setLoading(false)}
  useEffect(()=>{load()},[]);
  async function update(id:string,status:string,decision?:string){setBusy(id);await fetch("/api/radar/decisions",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,status,decision})});await load();setBusy("")}
  const stats=useMemo(()=>({open:rows.filter(r=>r.status==="open").length,high:rows.filter(r=>Number(r.move?.impact_score||0)>=75&&r.status==="open").length,decided:rows.filter(r=>r.status==="decided").length,outcomes:rows.reduce((a,r)=>a+Number(r.outcome_count||0),0)}),[rows]);
  return <div className="content">
    <PageIntro eyebrow="DECISION INTELLIGENCE" title="Decisions" description="RADAR converts evidence-backed strategic Moves into practical choices. Pick a response, create an Action, then record the outcome." action={<Link className="secondary-button" href="/moves">View RADAR Moves</Link>}/>
    <section className="metrics-grid"><div className="stat-tile"><span>Open</span><strong>{stats.open}</strong><small>Needs founder review</small></div><div className="stat-tile"><span>High impact</span><strong>{stats.high}</strong><small>Move impact ≥75</small></div><div className="stat-tile"><span>Decided</span><strong>{stats.decided}</strong><small>Response selected</small></div><div className="stat-tile"><span>Outcomes</span><strong>{stats.outcomes}</strong><small>Learning loop closed</small></div></section>
    <div className="decision-stack">{loading?<div className="panel" style={{padding:24}}>Loading decisions...</div>:rows.length?rows.map(r=>{
      const opts=Array.isArray(r.options)?r.options:[];const rec=r.recommendation||{};return <article className="panel decision-card" key={r.id} style={{gridTemplateColumns:"auto 1fr"}}><div className="decision-icon"><CircleAlert size={18}/></div><div><div style={{display:"flex",justifyContent:"space-between",gap:14,alignItems:"start"}}><div><span className={`decision-urgency ${Number(r.move?.impact_score||0)>=75?"high":"medium"}`}>{r.status}</span><h3>{r.title}</h3><p>{r.context}</p></div><div style={{fontSize:11,color:"#72797f",textAlign:"right",minWidth:120}}>{r.competitor?.name?<><strong style={{display:"block",color:"#363c40"}}>{r.competitor.name}</strong>{Math.round(Number(r.confidence||0))}% confidence</>:null}</div></div>
      <div className="founder-action-block" style={{marginTop:12}}><span>RADAR RECOMMENDATION</span><strong style={{whiteSpace:"pre-wrap"}}>{rec.summary||"Review the evidence before acting."}</strong></div>
      {opts.length?<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:9,marginTop:12}}>{opts.map((o:any)=><div key={o.label} style={{border:"1px solid #e0e4e6",borderRadius:10,padding:12,background:"#fbfbfb"}}><strong style={{display:"block",fontSize:13,marginBottom:5}}>{o.label}</strong><span style={{display:"block",fontSize:11,color:"#666d72",lineHeight:1.55}}>{o.action}</span>{r.status==="open"?<button style={{marginTop:10}} className="secondary-button" disabled={busy===r.id} onClick={()=>update(r.id,"decided",o.label)}><Check size={13}/>Choose {o.label}</button>:null}</div>)}</div>:null}
      <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:12}}>{r.status==="open"?<button className="secondary-button" disabled={busy===r.id} onClick={()=>update(r.id,"dismissed")}><X size={13}/>Dismiss</button>:null}{busy===r.id?<LoaderCircle size={15}/>:null}{r.status==="decided"?<Link className="primary-button" href="/actions">Open Actions</Link>:null}</div></div></article>})
      :<div className="panel" style={{padding:30,textAlign:"center",color:"#737a80"}}>No Decisions yet. Open RADAR Moves and create a decision from a multi-signal strategic pattern.</div>}</div>
  </div>
}
