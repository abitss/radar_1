"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, LoaderCircle, Plus, Search, ShieldCheck, X } from "lucide-react";
import { PageIntro } from "@/components/intelligence-ui";

type Competitor = any;

export default function CompaniesPage(){
  const [rows,setRows]=useState<Competitor[]>([]); const [query,setQuery]=useState(""); const [loading,setLoading]=useState(true); const [scanning,setScanning]=useState(false); const [message,setMessage]=useState("");
  const [adding,setAdding]=useState(false); const [showAdd,setShowAdd]=useState(false); const [name,setName]=useState(""); const [website,setWebsite]=useState(""); const [monitoring,setMonitoring]=useState(false);
  async function load(silent=false){try{const r=await fetch("/api/radar/competitors",{cache:"no-store"});const d=await r.json();if(r.ok)setRows(Array.isArray(d)?d:[])}finally{if(!silent)setLoading(false)}}
  useEffect(()=>{
    load();
    const timer=window.setInterval(()=>load(true),8000);
    const onFocus=()=>load(true);
    window.addEventListener("focus",onFocus);
    return()=>{window.clearInterval(timer);window.removeEventListener("focus",onFocus)};
  },[]);
  async function rescan(){setScanning(true);setMessage("Searching public/indexable web sources across multiple discovery paths...");try{const r=await fetch("/api/radar/discover",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({force:true})});const d=await r.json();setMessage(r.ok?`${d.inspected||0} public results inspected · ${d.promoted||0} companies added to RADAR`:d.cooldown?"A fresh discovery run is already available. Refreshing the latest results.":d.error||"Scan failed");await load()}catch{setMessage("Discovery failed. Please try again.")}finally{setScanning(false)}}
  async function addCompetitor(e:FormEvent){e.preventDefault();if(!website.trim())return;setAdding(true);setMessage("");try{const r=await fetch("/api/radar/competitors",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,website})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Could not add competitor");await load();setName("");setWebsite("");setShowAdd(false);setMessage("Competitor added. Open its dossier to run a deep scan and activate monitoring.")}catch(e){setMessage(e instanceof Error?e.message:"Could not add competitor")}finally{setAdding(false)}}
  async function monitorTop(){
    const targets=[...rows].filter(c=>!c.monitor_active&&c.website).sort((a,b)=>Number(b.threat_score||b.similarity_score||0)-Number(a.threat_score||a.similarity_score||0)).slice(0,5);
    if(!targets.length){setMessage("Your highest-priority companies are already monitored, or no websites are available yet.");return}
    setMonitoring(true);setMessage(`Activating continuous monitoring for ${targets.length} high-priority compan${targets.length===1?"y":"ies"}...`);
    let ok=0;
    await Promise.all(targets.map(async c=>{try{const r=await fetch(`/api/radar/competitors/${c.id}/monitor`,{method:"POST"});if(r.ok)ok++}catch{}}));
    await load();setMessage(`${ok} competitor monitor${ok===1?"":"s"} activated.`);setMonitoring(false);
  }
  const filtered=useMemo(()=>rows.filter(c=>`${c.name} ${c.description||""} ${c.category}`.toLowerCase().includes(query.toLowerCase())),[rows,query]);
  const core=rows.filter(c=>Number(c.similarity_score||0)>=80).length; const closer=rows.filter(c=>c.movement==="closer").length; const scanned=rows.filter(c=>c.last_scanned_at).length; const monitored=rows.filter(c=>c.monitor_active).length;
  return <div className="content">
    <PageIntro eyebrow="COMPETITIVE UNIVERSE" title="Competitors" description="RADAR automatically discovers public/indexable companies, estimates similarity and threat, then verifies the strongest matches through deeper evidence scans." action={<div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button onClick={()=>setShowAdd(v=>!v)} className="secondary-button">{showAdd?<X size={14}/>:<Plus size={14}/>} {showAdd?"Close":"Add competitor"}</button><button onClick={monitorTop} disabled={monitoring||!rows.length} className="secondary-button">{monitoring?<LoaderCircle size={14}/>:<ShieldCheck size={14}/>} {monitoring?"Activating...":"Monitor top 5"}</button><button onClick={rescan} disabled={scanning} className="primary-button">{scanning?<><LoaderCircle size={14}/>Scanning...</>:"Scan market now"}</button></div>}/>
    {showAdd?<form onSubmit={addCompetitor} className="panel" style={{padding:16,marginBottom:12,display:"grid",gridTemplateColumns:"1fr 1.5fr auto",gap:10,alignItems:"end"}}><label style={{display:"grid",gap:6,fontSize:11,color:"#666"}}><span>Company name</span><input value={name} onChange={e=>setName(e.target.value)} placeholder="Optional" style={{height:42,border:"1px solid #dce0e3",borderRadius:9,padding:"0 11px"}}/></label><label style={{display:"grid",gap:6,fontSize:11,color:"#666"}}><span>Website</span><input value={website} onChange={e=>setWebsite(e.target.value)} placeholder="competitor.com" required style={{height:42,border:"1px solid #dce0e3",borderRadius:9,padding:"0 11px"}}/></label><button className="primary-button" disabled={adding} style={{height:42}}>{adding?<LoaderCircle size={14}/>:<Plus size={14}/>} {adding?"Adding...":"Add"}</button></form>:null}
    {message?<div className="competition-live-message" style={{marginBottom:12}}>{message}</div>:null}
    <section className="metrics-grid"><div className="stat-tile"><span>Tracked</span><strong>{rows.length}</strong><small>Discovered companies</small></div><div className="stat-tile"><span>Core</span><strong>{core}</strong><small>Similarity ≥ 80%</small></div><div className="stat-tile"><span>Monitored</span><strong>{monitored}</strong><small>Continuous watches</small></div><div className="stat-tile"><span>Deep-scanned</span><strong>{scanned}</strong><small>Evidence verified</small></div></section>
    <article className="panel" style={{padding:18}}>
      <div style={{display:"flex",alignItems:"center",gap:10,border:"1px solid #dde1e4",borderRadius:10,padding:"0 12px",height:44,marginBottom:14}}><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search competitors..." style={{border:0,outline:"none",width:"100%",fontSize:13,background:"transparent"}}/></div>
      {loading?<div style={{padding:20,color:"#747b81"}}>Loading competitors...</div>:filtered.length?<div className="intel-table-wrap"><div className="intel-table-head" style={{gridTemplateColumns:"1.7fr .65fr .65fr .65fr .65fr"}}><span>Company</span><span>Similarity</span><span>Threat</span><span>Evidence</span><span>Status</span></div>{filtered.map(c=><Link href={`/companies/${c.id}`} className="intel-table-row" style={{gridTemplateColumns:"1.7fr .65fr .65fr .65fr .65fr",textDecoration:"none"}} key={c.id}><div className="signal-main"><div><span className="signal-company">{c.category}</span></div><strong>{c.name}</strong><small>{c.description||c.website}</small></div><strong>{Math.round(Number(c.similarity_score||0))}%</strong><strong>{Math.round(Number(c.threat_score||0))}%</strong><span>{Number(c.evidence_count||0)}</span><span className="age-cell">{c.monitor_active?"monitoring":c.last_scanned_at?c.movement||"scanned":"provisional"}<ArrowUpRight size={13}/></span></Link>)}</div>:<div style={{padding:30,textAlign:"center",color:"#737a80",lineHeight:1.7}}><LoaderCircle size={18} style={{margin:"0 auto 8px"}}/><strong style={{display:"block",color:"#4f565b",marginBottom:3}}>RADAR is building your competitive universe.</strong>The list refreshes automatically as companies are discovered. If it stays empty, make sure your startup website is saved in Company Brain, then run “Scan market now”.</div>}
    </article>
  </div>;
}
