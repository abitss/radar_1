"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CircleAlert, Radar, ShieldCheck, Signal, Sparkles, Target } from "lucide-react";

type Overview = any;

export default function Home(){
  const [data,setData] = useState<Overview|null>(null);
  const [brief,setBrief] = useState<any>(null);
  const [error,setError] = useState("");
  useEffect(()=>{
    fetch("/api/radar/overview",{cache:"no-store"})
      .then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error||"Could not load RADAR");return j})
      .then(setData).catch(e=>setError(e.message));
    fetch("/api/radar/brief",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(setBrief).catch(()=>{});
  },[]);
  if(error) return <div className="content"><div className="panel founder-panel"><strong>RADAR could not load.</strong><p>{error}</p></div></div>;
  if(!data) return <div className="content"><div className="panel founder-panel">Loading your competitive universe...</div></div>;
  if(!data.workspace?.website) return <div className="content founder-today"><div className="founder-today-head"><div><span>WELCOME TO RADAR</span><h1>Start with one URL.</h1><p>RADAR will understand your startup, discover competitors and activate continuous monitoring.</p></div></div><Link href="/onboarding" className="primary-button">Build my RADAR <ArrowRight size={14}/></Link></div>;

  const urgent = (data.recommendations||[]).filter((r:any)=>r.status==="open").slice(0,4);
  const signals = (data.signals||[]).slice(0,4);
  return <div className="content founder-today">
    <div className="founder-today-head">
      <div><span>FOUNDER BRIEF · LIVE</span><h1>{data.metrics.newSignals ? `${data.metrics.newSignals} new signal${data.metrics.newSignals===1?"":"s"} deserve attention.` : "No major new movement detected."}</h1><p>RADAR filters the public market into changes that may alter your competitive position.</p></div>
      <div className="founder-status"><ShieldCheck size={18}/><span><strong>{data.monitor?"Continuous RADAR active":"Monitoring needs setup"}</strong><small>{data.monitor?"Public web checked automatically":"Open Settings to activate"}</small></span></div>
    </div>

    <section className="panel founder-panel" style={{marginBottom:13}}>
      <div className="founder-panel-head"><div><span>AI FOUNDER BRIEF</span><h2>{brief?.headline || "Reading your competitive graph..."}</h2></div><Sparkles size={21}/></div>
      <p style={{whiteSpace:"pre-line",lineHeight:1.7}}>{brief?.brief || "RADAR is preparing an evidence-grounded summary of what changed, why it matters and what deserves your attention next."}</p>
      <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",marginTop:12,fontSize:11,color:"#777e83"}}><span>{brief?.mode==="grounded-ai"?"Grounded AI · evidence constrained":"Evidence fallback"}</span><Link href="/ask">Ask RADAR <ArrowRight size={12}/></Link></div>
    </section>

    <section className="founder-survival-grid">
      <Link href="/companies" className="panel survival-card"><Radar/><span>COMPETITORS</span><strong>{data.metrics.competitors}</strong><small>{data.metrics.core} in your core zone</small></Link>
      <Link href="/signals" className="panel survival-card"><Signal/><span>NEW SIGNALS</span><strong>{data.metrics.newSignals}</strong><small>Last 24 hours</small></Link>
      <Link href="/market" className="panel survival-card"><CircleAlert/><span>MOVING CLOSER</span><strong>{data.metrics.movingCloser}</strong><small>Competitive convergence</small></Link>
      <Link href="/decisions" className="panel survival-card"><Target/><span>DECISIONS</span><strong>{data.metrics.openDecisions}</strong><small>Open recommendations</small></Link>
    </section>

    <section className="founder-command-grid">
      <article className="panel founder-priorities">
        <div className="founder-panel-head"><div><span>WHAT TO DO NEXT</span><h2>Founder priorities</h2></div><small>Evidence-backed</small></div>
        <div className="founder-priority-list">
          {urgent.length?urgent.map((r:any,i:number)=><Link href="/decisions" key={r.id}><span>0{i+1}</span><div><strong>{r.title}</strong><small>{r.action}</small></div><ArrowRight size={15}/></Link>):<div style={{padding:"18px 0",color:"#737a80",fontSize:13}}>No open recommendations yet. RADAR will create them when evidence crosses a meaningful threshold.</div>}
        </div>
      </article>
      <article className="panel founder-dark-panel founder-why-now">
        <span>MARKET PULSE</span><h2>{signals[0]?.title || "The market is quiet right now."}</h2><p>{signals[0]?.summary || "RADAR will surface meaningful public changes here as continuous monitoring discovers them."}</p><Link href="/signals">Open live signals <ArrowRight size={14}/></Link>
      </article>
    </section>
  </div>;
}
