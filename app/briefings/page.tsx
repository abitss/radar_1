"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, LoaderCircle, RefreshCcw } from "lucide-react";
import { PageIntro } from "@/components/intelligence-ui";

export default function BriefingsPage(){
  const [rows,setRows]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [generating,setGenerating]=useState(false);
  const [period,setPeriod]=useState("weekly");
  const [message,setMessage]=useState("");

  async function load(){
    setLoading(true);
    try{const r=await fetch("/api/radar/briefings",{cache:"no-store"});const d=await r.json();setRows(Array.isArray(d)?d:[])}finally{setLoading(false)}
  }
  useEffect(()=>{load()},[]);

  async function generate(){
    setGenerating(true);setMessage("");
    try{
      const r=await fetch("/api/radar/briefings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({period})});
      const d=await r.json();
      if(!r.ok)throw new Error(d?.error||"Could not generate briefing");
      setRows(prev=>[d,...prev]);setMessage(`${period} briefing generated from current RADAR evidence.`);
    }catch(e){setMessage(e instanceof Error?e.message:"Could not generate briefing")}finally{setGenerating(false)}
  }

  const stats=useMemo(()=>({daily:rows.filter(r=>r.period==="daily").length,weekly:rows.filter(r=>r.period==="weekly").length,monthly:rows.filter(r=>r.period==="monthly").length,evidence:rows[0]?.evidence_count||0}),[rows]);

  return <div className="content">
    <PageIntro eyebrow="EXECUTIVE INTELLIGENCE" title="Briefings" description="Decision-ready summaries generated from your stored competitors, signals, recommendations and source evidence." action={<div style={{display:"flex",gap:8}}><select value={period} onChange={e=>setPeriod(e.target.value)} style={{height:38,border:"1px solid #d8dcdf",borderRadius:10,padding:"0 10px",background:"white"}}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select><button onClick={generate} disabled={generating} className="primary-button">{generating?<LoaderCircle size={14}/>:<RefreshCcw size={14}/>} {generating?"Generating...":"Generate briefing"}</button></div>}/>
    {message?<div className="competition-live-message" style={{marginBottom:12}}>{message}</div>:null}
    <section className="metrics-grid"><div className="stat-tile"><span>Daily</span><strong>{stats.daily}</strong><small>Saved briefings</small></div><div className="stat-tile"><span>Weekly</span><strong>{stats.weekly}</strong><small>Saved briefings</small></div><div className="stat-tile"><span>Monthly</span><strong>{stats.monthly}</strong><small>Saved briefings</small></div><div className="stat-tile"><span>Latest evidence</span><strong>{stats.evidence}</strong><small>Sources considered</small></div></section>
    <section className="panel founder-panel">
      <div className="founder-panel-head"><div><span>BRIEFING ARCHIVE</span><h2>Founder intelligence history</h2></div><FileText size={20}/></div>
      {loading?<div style={{padding:"22px 0",color:"#747b81"}}>Loading briefings...</div>:rows.length?<div style={{display:"grid",gap:12}}>{rows.map((b:any)=><article key={b.id} style={{padding:"16px",border:"1px solid #e1e4e6",borderRadius:12,background:"#fff"}}><div style={{display:"flex",justifyContent:"space-between",gap:12,marginBottom:10}}><div><span style={{fontSize:10,color:"#7b8186",textTransform:"uppercase",letterSpacing:".08em"}}>{b.period} · {b.generated_by}</span><h3 style={{margin:"4px 0 0",fontSize:15}}>{b.title}</h3></div><small style={{color:"#8a9095"}}>{new Date(b.created_at).toLocaleString()}</small></div><p style={{whiteSpace:"pre-line",lineHeight:1.65,fontSize:13,color:"#51575c",margin:0}}>{b.content}</p></article>)}</div>:<div style={{padding:"24px 0",color:"#737a80"}}>No briefings yet. Generate the first one when RADAR has collected some evidence.</div>}
    </section>
  </div>;
}
