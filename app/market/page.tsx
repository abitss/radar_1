"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Radar, ScanSearch, ShieldAlert, Sparkles } from "lucide-react";
import { CompetitorRadar } from "@/components/competitor-radar";
import { PageIntro } from "@/components/intelligence-ui";

export default function MarketPage(){
  const [data,setData]=useState<any>(null); const [discovering,setDiscovering]=useState(false); const [message,setMessage]=useState(""); const [error,setError]=useState("");
  async function load(silent=false){try{const r=await fetch("/api/radar/overview",{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"Could not load RADAR");setData(d);if(!silent)setError("")}catch(e){if(!silent)setError(e instanceof Error?e.message:"Could not load RADAR")}}
  useEffect(()=>{load();const timer=window.setInterval(()=>load(true),10000);const onFocus=()=>load(true);window.addEventListener("focus",onFocus);return()=>{window.clearInterval(timer);window.removeEventListener("focus",onFocus)}},[]);
  async function discover(){
    if(discovering)return;setDiscovering(true);setMessage("Scanning public web and resolving real company entities...");
    try{const r=await fetch("/api/radar/discover",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({force:true})});const d=await r.json();if(!r.ok&&!d?.cooldown)throw new Error(d.error||"Discovery failed");setMessage(d?.cooldown?(d.error||"Discovery is already running."):`${d.inspected||0} public results inspected · ${d.entities_extracted||0} company entities resolved · ${d.promoted||0} competitors promoted`);await load(true)}catch(e){setMessage(e instanceof Error?e.message:"Discovery failed")}finally{setDiscovering(false)}
  }
  const m=data?.metrics||{};const competitors=Array.isArray(data?.competitors)?data.competitors:[];
  const verified=useMemo(()=>competitors.filter((c:any)=>Boolean(c.last_scanned_at)).length,[competitors]);
  const activeMonitors=Number(data?.live?.activeMonitors||0);const entityWatches=Number(data?.live?.activeCompetitorMonitors||0);const lastEvent=data?.live?.lastMonitorEvent||null;
  return <div className="content">
    <PageIntro eyebrow="COMPETITIVE INTELLIGENCE" title="Your living competitive map." description="Distance represents strategic similarity. Relationship type, evidence coverage and monitoring status remain separate so the map never pretends a provisional estimate is a verified fact." action={<button onClick={discover} disabled={discovering} className="primary-button"><ScanSearch size={14}/>{discovering?"Scanning...":"Scan market now"}</button>}/>
    {error?<div className="competition-live-message radar-error-message" style={{marginBottom:12}}>{error}</div>:null}
    {message?<div className="competition-live-message" style={{marginBottom:12}}>{message}</div>:null}
    <section className="metrics-grid"><div className="stat-tile"><span>Competitive universe</span><strong>{m.competitors??0}</strong><small>Tracked company entities</small></div><div className="stat-tile"><span>First-party verified</span><strong>{verified}</strong><small>Deep-scanned competitors</small></div><div className="stat-tile"><span>Entity watches</span><strong>{entityWatches}</strong><small>Continuous competitor monitors</small></div><div className="stat-tile"><span>Moved closer</span><strong>{m.movingCloser??0}</strong><small>Evidence-backed convergence</small></div></section>
    <CompetitorRadar/>
    <section className="founder-two-col competition-bottom-grid">
      <article className="panel founder-panel founder-dark-panel"><div className="founder-panel-head"><div><span>EARLY WARNING</span><h2>Detect convergence before it becomes obvious.</h2></div><Radar size={21}/></div><p>A company does not need to call itself your competitor. RADAR separates discovery, verification, monitoring and movement so weak evidence cannot masquerade as certainty.</p><Link href="/signals" className="founder-dark-link">See live signals <ArrowUpRight size={14}/></Link></article>
      <article className="panel founder-panel"><div className="founder-panel-head"><div><span>CONTINUOUS STATUS</span><h2>{activeMonitors?`${entityWatches} active competitor watch${entityWatches===1?"":"es"}`:"Continuous monitoring is not active yet"}</h2></div><ShieldAlert size={21}/></div><p>{activeMonitors?`RADAR has ${activeMonitors} active monitor${activeMonitors===1?"":"s"} across this workspace. ${lastEvent?`Last provider event: ${new Date(lastEvent).toLocaleString()}.`:"The monitors are active and waiting for a meaningful change."}`:"Open a competitor and activate monitoring when you want continuous evidence collection. Discovery and manual scans can still run without an active watch."}</p><Link href="/sources" style={{fontSize:10,textDecoration:"none",display:"inline-flex",alignItems:"center",gap:5,marginTop:10}}>Open source coverage <ArrowUpRight size={12}/></Link></article>
    </section>
    <section className="panel competition-decision-banner"><div><Sparkles size={18}/><span>RADAR PRINCIPLE</span><strong>Never show a founder a change without showing its evidence state and why it matters.</strong></div><Link href="/decisions">Open decisions <ArrowUpRight size={14}/></Link></section>
  </div>;
}
