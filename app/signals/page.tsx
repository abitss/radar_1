"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, ThumbsDown, ThumbsUp } from "lucide-react";
import { PageIntro } from "@/components/intelligence-ui";

export default function SignalsPage(){
  const [rows,setRows]=useState<any[]>([]); const [loading,setLoading]=useState(true); const [message,setMessage]=useState("");
  useEffect(()=>{fetch("/api/radar/signals",{cache:"no-store"}).then(r=>r.json()).then(d=>{setRows(Array.isArray(d)?d:[]);setLoading(false)})},[]);
  async function feedback(id:string,type:"useful"|"not_useful"){
    const r=await fetch("/api/radar/feedback",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({target_type:"signal",target_id:id,feedback_type:type})});
    const d=await r.json(); if(!r.ok){setMessage(d?.error||"Feedback failed");return;} setRows(prev=>prev.map(x=>x.id===id?{...x,user_feedback:type}:x)); setMessage("Feedback saved. RADAR will use it to improve signal quality.");
  }
  const high=rows.filter(r=>Number(r.impact_score||0)>=80).length; const verified=rows.filter(r=>Number(r.confidence||0)>=80).length; const day=rows.filter(r=>Date.now()-new Date(r.observed_at||r.created_at).getTime()<=86400000).length;
  return <div className="content">
    <PageIntro eyebrow="EVIDENCE LAYER" title="Signals" description="Meaningful public changes detected by RADAR, with impact, confidence and competitor context attached." />
    {message?<div className="competition-live-message" style={{marginBottom:12}}>{message}</div>:null}
    <section className="metrics-grid"><div className="stat-tile"><span>Total signals</span><strong>{rows.length}</strong><small>Stored intelligence</small></div><div className="stat-tile"><span>New today</span><strong>{day}</strong><small>Last 24 hours</small></div><div className="stat-tile"><span>High impact</span><strong>{high}</strong><small>Impact ≥ 80</small></div><div className="stat-tile"><span>High confidence</span><strong>{verified}</strong><small>Confidence ≥ 80</small></div></section>
    <article className="panel table-panel">
      {loading?<div style={{padding:24,color:"#737a80"}}>Loading live signals...</div>:rows.length?<div className="intel-table-wrap"><div className="intel-table-head" style={{gridTemplateColumns:"2fr .55fr .7fr .5fr .75fr"}}><span>Signal</span><span>Impact</span><span>Confidence</span><span>Age</span><span>Feedback</span></div>{rows.map(row=>{const ageMs=Date.now()-new Date(row.observed_at||row.created_at).getTime();const age=ageMs<3600000?`${Math.max(1,Math.round(ageMs/60000))}m`:ageMs<86400000?`${Math.round(ageMs/3600000)}h`:`${Math.round(ageMs/86400000)}d`;return <div className="intel-table-row" style={{gridTemplateColumns:"2fr .55fr .7fr .5fr .75fr"}} key={row.id}><div className="signal-main"><div><span className="signal-company">{row.competitor?.name||"Market"}</span><span className="signal-type">{String(row.signal_type||"change").replaceAll("_"," ")}</span></div><strong>{row.title}</strong><small>{row.summary}</small></div><strong className="impact-score">{Math.round(Number(row.impact_score||0))}</strong><span className="confidence-pill"><span style={{width:`${Number(row.confidence||0)}%`}}/>{Math.round(Number(row.confidence||0))}%</span><span className="age-cell">{age}<ArrowUpRight size={13}/></span><div style={{display:"flex",gap:6}}><button title="Useful" onClick={()=>feedback(row.id,"useful")} className="secondary-button" style={{padding:"0 8px",height:30,opacity:row.user_feedback==="useful"?1:.75}}><ThumbsUp size={12}/></button><button title="Not useful" onClick={()=>feedback(row.id,"not_useful")} className="secondary-button" style={{padding:"0 8px",height:30,opacity:row.user_feedback==="not_useful"?1:.75}}><ThumbsDown size={12}/></button></div></div>})}</div>:<div style={{padding:30,textAlign:"center",color:"#737a80"}}>No meaningful signals yet. That is valid intelligence too. RADAR will populate this feed when continuous monitoring or deep scans find something relevant.</div>}
    </article>
  </div>;
}
