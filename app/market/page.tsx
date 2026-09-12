"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Radar, ScanSearch, ShieldAlert, Sparkles } from "lucide-react";
import { CompetitorRadar } from "@/components/competitor-radar";
import { PageIntro } from "@/components/intelligence-ui";

export default function MarketPage(){
  const [data,setData]=useState<any>(null); const [discovering,setDiscovering]=useState(false); const [message,setMessage]=useState("");
  async function load(){const d=await fetch("/api/radar/overview",{cache:"no-store"}).then(r=>r.json());setData(d)}
  useEffect(()=>{load()},[]);
  async function discover(){setDiscovering(true);setMessage("Scanning public web...");const r=await fetch("/api/radar/discover",{method:"POST"});const d=await r.json();setMessage(r.ok?`${d.inspected||0} results inspected · ${d.promoted||0} new competitors promoted`:d.error||"Discovery failed");await load();setDiscovering(false)}
  const m=data?.metrics||{};
  return <div className="content">
    <PageIntro eyebrow="COMPETITIVE INTELLIGENCE" title="Your living competitive map." description="Distance represents strategic similarity. RADAR continuously discovers companies and pulls them inward or outward as public evidence changes." action={<button onClick={discover} disabled={discovering} className="primary-button"><ScanSearch size={14}/>{discovering?"Scanning...":"Scan market now"}</button>}/>
    {message?<div className="competition-live-message" style={{marginBottom:12}}>{message}</div>:null}
    <section className="metrics-grid"><div className="stat-tile"><span>Competitive universe</span><strong>{m.competitors??0}</strong><small>Tracked companies</small></div><div className="stat-tile"><span>Core competitors</span><strong>{m.core??0}</strong><small>Similarity ≥ 80%</small></div><div className="stat-tile"><span>New candidates</span><strong>{m.candidates??0}</strong><small>Awaiting stronger evidence</small></div><div className="stat-tile"><span>Moved closer</span><strong>{m.movingCloser??0}</strong><small>Convergence detected</small></div></section>
    <CompetitorRadar/>
    <section className="founder-two-col competition-bottom-grid">
      <article className="panel founder-panel founder-dark-panel"><div className="founder-panel-head"><div><span>EARLY WARNING</span><h2>Detect convergence before it becomes obvious.</h2></div><Radar size={21}/></div><p>A company does not need to call itself your competitor. RADAR watches product, buyer, pricing, hiring, technology and positioning, then recalculates competitive proximity.</p><Link href="/signals" className="founder-dark-link">See live signals <ArrowUpRight size={14}/></Link></article>
      <article className="panel founder-panel"><div className="founder-panel-head"><div><span>CONTINUOUS STATUS</span><h2>{data?.monitor?"Web-wide discovery is active":"Continuous discovery is not active"}</h2></div><ShieldAlert size={21}/></div><p>{data?.monitor?`RADAR monitor is active and will keep searching for new competitive evidence. Last provider event: ${data.monitor.last_event_at?new Date(data.monitor.last_event_at).toLocaleString():"waiting for first event"}.`:"Re-run onboarding to activate the continuous public-web monitor."}</p></article>
    </section>
    <section className="panel competition-decision-banner"><div><Sparkles size={18}/><span>RADAR PRINCIPLE</span><strong>Never show a founder a change without explaining why it matters.</strong></div><Link href="/decisions">Open decisions <ArrowUpRight size={14}/></Link></section>
  </div>;
}
