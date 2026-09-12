"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, LoaderCircle, RefreshCcw, X } from "lucide-react";
import { PageIntro } from "@/components/intelligence-ui";

export default function DiscoverPage(){
  const [rows,setRows]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [scanning,setScanning]=useState(false);
  const [message,setMessage]=useState("");

  async function load(){
    setLoading(true);
    try{
      const res=await fetch("/api/radar/discover",{cache:"no-store"});
      const data=await res.json();
      setRows(Array.isArray(data?.candidates)?data.candidates:[]);
    }finally{setLoading(false)}
  }
  useEffect(()=>{load()},[]);

  async function scan(){
    setScanning(true);setMessage("");
    try{
      const res=await fetch("/api/radar/discover",{method:"POST"});
      const data=await res.json();
      if(!res.ok && !data?.cooldown) throw new Error(data?.error||"Discovery failed");
      setMessage(data?.cooldown?data.error:`${data.inspected||0} results inspected · ${data.promoted||0} competitors promoted`);
      await load();
    }catch(e){setMessage(e instanceof Error?e.message:"Discovery failed")}finally{setScanning(false)}
  }

  async function act(id:string,action:"approve"|"reject"|"ignore"){
    const res=await fetch(`/api/radar/candidates/${encodeURIComponent(id)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action})});
    const data=await res.json();
    if(!res.ok){setMessage(data?.error||"Action failed");return;}
    setRows(prev=>prev.map(r=>r.id===id?{...r,status:action==="approve"?"promoted":action==="reject"?"rejected":"ignored"}:r));
  }

  const stats=useMemo(()=>({
    candidates:rows.filter(r=>["new","candidate"].includes(r.status)).length,
    promoted:rows.filter(r=>r.status==="promoted").length,
    rejected:rows.filter(r=>r.status==="rejected").length,
    high:rows.filter(r=>Number(r.provisional_score||0)>=55 && ["new","candidate"].includes(r.status)).length,
  }),[rows]);

  return <div className="content">
    <PageIntro eyebrow="DISCOVERY ENGINE" title="Discover" description="RADAR finds companies you may not already know, scores their relevance, and lets you approve, reject or ignore them before they become part of your monitored universe." action={<button onClick={scan} disabled={scanning} className="primary-button">{scanning?<LoaderCircle size={14}/>:<RefreshCcw size={14}/>} {scanning?"Scanning...":"Discover competitors"}</button>}/>
    {message?<div className="competition-live-message" style={{marginBottom:12}}>{message}</div>:null}
    <section className="metrics-grid"><div className="stat-tile"><span>Needs review</span><strong>{stats.candidates}</strong><small>Candidate companies</small></div><div className="stat-tile"><span>High relevance</span><strong>{stats.high}</strong><small>Score ≥ 55%</small></div><div className="stat-tile"><span>Promoted</span><strong>{stats.promoted}</strong><small>In competitive universe</small></div><div className="stat-tile"><span>Rejected</span><strong>{stats.rejected}</strong><small>Founder feedback learned</small></div></section>

    <section className="panel founder-panel">
      <div className="founder-panel-head"><div><span>CANDIDATE QUEUE</span><h2>Review what RADAR found</h2></div><small>Evidence before automation</small></div>
      {loading?<div style={{padding:"22px 0",color:"#747b81"}}>Loading discovery candidates...</div>:rows.length?<div style={{display:"grid",gap:0}}>{rows.map((c:any)=><div key={c.id} style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto",gap:16,padding:"14px 0",borderBottom:"1px solid #e3e6e8",alignItems:"center"}}><div><div style={{display:"flex",gap:8,alignItems:"center",marginBottom:5}}><strong style={{fontSize:13}}>{c.title||c.domain}</strong><span style={{fontSize:10,color:"#737a80"}}>{Math.round(Number(c.provisional_score||0))}% relevance</span></div><div style={{fontSize:12,color:"#6f767c",lineHeight:1.5}}>{c.description||c.url}</div><div style={{fontSize:10,color:"#91969a",marginTop:5}}>Status: {c.status}</div></div><div style={{display:"flex",gap:7}}>{["new","candidate"].includes(c.status)?<><button className="secondary-button" onClick={()=>act(c.id,"reject")}><X size={13}/> Reject</button><button className="primary-button" onClick={()=>act(c.id,"approve")}><Check size={13}/> Monitor</button></>:c.status==="promoted"?<span style={{fontSize:11,color:"#555"}}>Monitoring candidate approved</span>:<button className="secondary-button" onClick={()=>act(c.id,"approve")}><Check size={13}/> Restore</button>}</div></div>)}</div>:<div style={{padding:"24px 0",color:"#737a80"}}>No discovery candidates yet. Run discovery and RADAR will search the public web automatically.</div>}
    </section>
  </div>;
}
