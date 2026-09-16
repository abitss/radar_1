"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Radar, RefreshCw, ScanSearch, ShieldAlert, Sparkles } from "lucide-react";
import { CompetitorRadar } from "@/components/competitor-radar";
import { PageIntro } from "@/components/intelligence-ui";

export default function MarketPage(){
  const [data,setData]=useState<any>(null);
  const [busy,setBusy]=useState<""|"refresh"|"discover">("");
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");

  async function load(silent=false){
    try{
      const r=await fetch("/api/radar/overview",{cache:"no-store"});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||"Could not load RADAR");
      setData(d);if(!silent)setError("");
    }catch(e){if(!silent)setError(e instanceof Error?e.message:"Could not load RADAR")}
  }
  useEffect(()=>{load();const timer=window.setInterval(()=>load(true),10000);const onFocus=()=>load(true);window.addEventListener("focus",onFocus);return()=>{window.clearInterval(timer);window.removeEventListener("focus",onFocus)}},[]);

  async function run(kind:"refresh"|"discover"){
    if(busy)return;
    setBusy(kind);
    setMessage(kind==="refresh"?"Refreshing discovery, competitive landscape, verification and movement...":"Searching the public web for new company entities...");
    try{
      const endpoint=kind==="refresh"?"/api/radar/refresh":"/api/radar/discover";
      const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(kind==="discover"?{force:true}:{}),cache:"no-store"});
      const d=await r.json().catch(()=>({}));
      if(!r.ok&&!d?.cooldown)throw new Error(d.error||`${kind} failed`);
      if(d?.cooldown)setMessage(d.message||d.error||"A RADAR job is already running.");
      else if(kind==="refresh")setMessage(`RADAR refresh complete · ${d.deep_scans||0} verified scans · ${d.market_events||0} market events · ${d.moves_correlated||0} strategic moves correlated.`);
      else setMessage(`${d.inspected||0} public results inspected · ${d.entities_extracted||0} company entities resolved · ${d.promoted||0} competitors promoted · ${d.source_leads_found||0} source leads captured.`);
      await load(true);
    }catch(e){setMessage(e instanceof Error?e.message:"RADAR action failed")}finally{setBusy("")}
  }

  const m=data?.metrics||{};
  const competitors=Array.isArray(data?.competitors)?data.competitors:[];
  const verified=useMemo(()=>competitors.filter((c:any)=>Boolean(c.last_scanned_at)).length,[competitors]);
  const activeMonitors=Number(data?.live?.activeMonitors||0);
  const entityWatches=Number(data?.live?.activeCompetitorMonitors||0);
  const lastEvent=data?.live?.lastMonitorEvent||null;

  return <div className="content">
    <PageIntro eyebrow="COMPETITIVE INTELLIGENCE" title="Your living competitive map." description="Distance represents strategic similarity. Relationship type, evidence coverage, verification and monitoring remain separate so provisional estimates never masquerade as verified facts." action={<div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button onClick={()=>run("discover")} disabled={Boolean(busy)} className="secondary-button"><ScanSearch size={14}/>{busy==="discover"?"Discovering...":"Discover companies"}</button><button onClick={()=>run("refresh")} disabled={Boolean(busy)} className="primary-button"><RefreshCw size={14}/>{busy==="refresh"?"Refreshing...":"Refresh RADAR"}</button></div>}/>
    {error?<div className="competition-live-message radar-error-message" style={{marginBottom:12}}>{error}</div>:null}
    {message?<div className="competition-live-message" style={{marginBottom:12}}>{message}</div>:null}

    <section className="metrics-grid">
      <div className="stat-tile"><span>Competitive universe</span><strong>{m.competitors??0}</strong><small>Tracked company entities</small></div>
      <div className="stat-tile"><span>First-party verified</span><strong>{m.verifiedCompetitors??verified}</strong><small>Deep-scanned competitors</small></div>
      <div className="stat-tile"><span>Active strategic moves</span><strong>{m.activeMoves??0}</strong><small>{m.confirmedMoves??0} confirmed patterns</small></div>
      <div className="stat-tile"><span>Open decisions</span><strong>{m.openDecisions??0}</strong><small>Founder decisions awaiting action</small></div>
    </section>

    <CompetitorRadar/>

    <section className="founder-two-col competition-bottom-grid">
      <article className="panel founder-panel founder-dark-panel"><div className="founder-panel-head"><div><span>EARLY WARNING</span><h2>Detect convergence before it becomes obvious.</h2></div><Radar size={21}/></div><p>A company does not need to call itself your competitor. RADAR separates discovery, verification, monitoring and movement so weak evidence cannot masquerade as certainty.</p><Link href="/signals" className="founder-dark-link">See live signals <ArrowUpRight size={14}/></Link></article>
      <article className="panel founder-panel"><div className="founder-panel-head"><div><span>CONTINUOUS STATUS</span><h2>{activeMonitors?`${entityWatches} active competitor watch${entityWatches===1?"":"es"}`:"Continuous monitoring is not active yet"}</h2></div><ShieldAlert size={21}/></div><p>{activeMonitors?`RADAR has ${activeMonitors} active monitor${activeMonitors===1?"":"s"} across this workspace. ${lastEvent?`Last provider event: ${new Date(lastEvent).toLocaleString()}.`:"The monitors are active and waiting for a meaningful change."}`:"Use the explicit Monitor action on a competitor when you want continuous evidence collection. Deep Scan only verifies current evidence and no longer silently activates monitoring."}</p><Link href="/sources" style={{fontSize:10,textDecoration:"none",display:"inline-flex",alignItems:"center",gap:5,marginTop:10}}>Open source coverage <ArrowUpRight size={12}/></Link></article>
    </section>

    <section className="panel competition-decision-banner"><div><Sparkles size={18}/><span>RADAR PRINCIPLE</span><strong>Discovery finds entities. Verification measures overlap. Monitoring detects change. Moves correlate signals. Decisions remain founder-controlled.</strong></div><Link href="/decisions">Open decisions <ArrowUpRight size={14}/></Link></section>
  </div>;
}
