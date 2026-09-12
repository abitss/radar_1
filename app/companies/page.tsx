"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, LoaderCircle, Plus, Search, X } from "lucide-react";
import { PageIntro } from "@/components/intelligence-ui";

type Competitor = any;

export default function CompaniesPage(){
  const [rows,setRows]=useState<Competitor[]>([]); const [query,setQuery]=useState(""); const [loading,setLoading]=useState(true); const [scanning,setScanning]=useState(false); const [message,setMessage]=useState("");
  const [adding,setAdding]=useState(false); const [showAdd,setShowAdd]=useState(false); const [name,setName]=useState(""); const [website,setWebsite]=useState("");
  async function load(){const d=await fetch("/api/radar/competitors",{cache:"no-store"}).then(r=>r.json());setRows(Array.isArray(d)?d:[]);setLoading(false)}
  useEffect(()=>{load()},[]);
  async function rescan(){setScanning(true);setMessage("Scanning the market...");try{const r=await fetch("/api/radar/discover",{method:"POST"});const d=await r.json();setMessage(r.ok?`${d.inspected||0} results inspected · ${d.promoted||0} competitors added`:d.cooldown?"A fresh scan already ran recently. Showing the latest results.":d.error||"Scan failed");await load()}catch{setMessage("Scan failed. Please try again.")}finally{setScanning(false)}}
  async function addCompetitor(e:FormEvent){e.preventDefault();if(!website.trim())return;setAdding(true);setMessage("");try{const r=await fetch("/api/radar/competitors",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,website})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Could not add competitor");setRows(prev=>[d,...prev]);setName("");setWebsite("");setShowAdd(false);setMessage("Competitor added. Open the dossier and run a deep scan to calculate overlap.")}catch(e){setMessage(e instanceof Error?e.message:"Could not add competitor")}finally{setAdding(false)}}
  const filtered=useMemo(()=>rows.filter(c=>`${c.name} ${c.description||""} ${c.category}`.toLowerCase().includes(query.toLowerCase())),[rows,query]);
  const core=rows.filter(c=>Number(c.similarity_score||0)>=80).length; const closer=rows.filter(c=>c.movement==="closer").length; const scanned=rows.filter(c=>c.last_scanned_at).length;
  return <div className="content">
    <PageIntro eyebrow="COMPETITIVE UNIVERSE" title="Competitors" description="Every company RADAR has discovered or you have added, ranked by strategic proximity to your startup." action={<div style={{display:"flex",gap:8}}><button onClick={()=>setShowAdd(v=>!v)} className="secondary-button">{showAdd?<X size={14}/>:<Plus size={14}/>} {showAdd?"Close":"Add competitor"}</button><button onClick={rescan} disabled={scanning} className="secondary-button">{scanning?<><LoaderCircle size={14}/>Scanning...</>:"Rescan market"}</button></div>}/>
    {showAdd?<form onSubmit={addCompetitor} className="panel" style={{padding:16,marginBottom:12,display:"grid",gridTemplateColumns:"1fr 1.5fr auto",gap:10,alignItems:"end"}}><label style={{display:"grid",gap:6,fontSize:11,color:"#666"}}><span>Company name</span><input value={name} onChange={e=>setName(e.target.value)} placeholder="Optional" style={{height:42,border:"1px solid #dce0e3",borderRadius:9,padding:"0 11px"}}/></label><label style={{display:"grid",gap:6,fontSize:11,color:"#666"}}><span>Website</span><input value={website} onChange={e=>setWebsite(e.target.value)} placeholder="competitor.com" required style={{height:42,border:"1px solid #dce0e3",borderRadius:9,padding:"0 11px"}}/></label><button className="primary-button" disabled={adding} style={{height:42}}>{adding?<LoaderCircle size={14}/>:<Plus size={14}/>} {adding?"Adding...":"Add"}</button></form>:null}
    {message?<div className="competition-live-message" style={{marginBottom:12}}>{message}</div>:null}
    <section className="metrics-grid"><div className="stat-tile"><span>Tracked</span><strong>{rows.length}</strong><small>All competitor classes</small></div><div className="stat-tile"><span>Core</span><strong>{core}</strong><small>Similarity ≥ 80%</small></div><div className="stat-tile"><span>Moving closer</span><strong>{closer}</strong><small>Convergence detected</small></div><div className="stat-tile"><span>Deep-scanned</span><strong>{scanned}</strong><small>Evidence collected</small></div></section>
    <article className="panel" style={{padding:18}}>
      <div style={{display:"flex",alignItems:"center",gap:10,border:"1px solid #dde1e4",borderRadius:10,padding:"0 12px",height:44,marginBottom:14}}><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search competitors..." style={{border:0,outline:"none",width:"100%",fontSize:13,background:"transparent"}}/></div>
      {loading?<div style={{padding:20,color:"#747b81"}}>Loading competitors...</div>:filtered.length?<div className="intel-table-wrap"><div className="intel-table-head" style={{gridTemplateColumns:"2fr .7fr .7fr .7fr"}}><span>Company</span><span>Similarity</span><span>Threat</span><span>Movement</span></div>{filtered.map(c=><Link href={`/companies/${c.id}`} className="intel-table-row" style={{gridTemplateColumns:"2fr .7fr .7fr .7fr",textDecoration:"none"}} key={c.id}><div className="signal-main"><div><span className="signal-company">{c.category}</span></div><strong>{c.name}</strong><small>{c.description||c.website}</small></div><strong>{Math.round(Number(c.similarity_score||0))}%</strong><strong>{Math.round(Number(c.threat_score||0))}%</strong><span className="age-cell">{c.movement||"stable"}<ArrowUpRight size={13}/></span></Link>)}</div>:<div style={{padding:28,textAlign:"center",color:"#737a80"}}>No competitors yet. Run discovery or add a competitor manually.</div>}
    </article>
  </div>;
}
