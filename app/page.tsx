"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CircleAlert, Radar, ShieldCheck, Signal, Sparkles, Target, Activity, Clock3 } from "lucide-react";

type Overview = any;

function ago(raw?:string|null){if(!raw)return"waiting for first event";const ms=Date.now()-new Date(raw).getTime();const m=Math.max(0,Math.floor(ms/60000));if(m<1)return"just now";if(m<60)return`${m}m ago`;const h=Math.floor(m/60);if(h<24)return`${h}h ago`;return`${Math.floor(h/24)}d ago`}

export default function Home(){
  const [data,setData] = useState<Overview|null>(null);
  const [brief,setBrief] = useState<any>(null);
  const [error,setError] = useState("");
  const [lastRefresh,setLastRefresh]=useState<Date|null>(null);

  async function loadOverview(silent=false){
    try{
      const r=await fetch("/api/radar/overview",{cache:"no-store"});
      const j=await r.json();
      if(!r.ok)throw new Error(j.error||"Could not load RADAR");
      setData(j);setLastRefresh(new Date());if(!silent)setError("");
    }catch(e){if(!silent)setError(e instanceof Error?e.message:"Could not load RADAR")}
  }

  useEffect(()=>{
    loadOverview();
    fetch("/api/radar/brief",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(setBrief).catch(()=>{});
    const timer=window.setInterval(()=>loadOverview(true),5000);
    const onFocus=()=>loadOverview(true);
    window.addEventListener("focus",onFocus);
    return()=>{window.clearInterval(timer);window.removeEventListener("focus",onFocus)};
  },[]);

  const liveEvents=useMemo(()=>Array.isArray(data?.events)?data.events.slice(0,8):[],[data]);
  if(error) return <div className="content"><div className="panel founder-panel"><strong>RADAR could not load.</strong><p>{error}</p></div></div>;
  if(!data) return <div className="content"><div className="panel founder-panel">Loading your competitive universe...</div></div>;
  if(!data.workspace?.website) return <div className="content founder-today"><div className="founder-today-head"><div><span>WELCOME TO RADAR</span><h1>Start with one URL.</h1><p>RADAR will understand your startup, discover competitors and activate continuous monitoring.</p></div></div><Link href="/onboarding" className="primary-button">Build my RADAR <ArrowRight size={14}/></Link></div>;

  const urgent = (data.recommendations||[]).filter((r:any)=>r.status==="open").slice(0,4);
  const signals = (data.signals||[]).slice(0,4);
  return <div className="content founder-today">
    <div className="founder-today-head">
      <div><span>FOUNDER BRIEF · LIVE</span><h1>{data.live?.critical?`${data.live.critical} critical competitive event${data.live.critical===1?"":"s"} require attention.`:data.metrics.newSignals?`${data.metrics.newSignals} new signal${data.metrics.newSignals===1?"":"s"} deserve attention.`:"No major new movement detected."}</h1><p>RADAR continuously converts public competitive movement into evidence, threat scoring and founder decisions.</p></div>
      <div className="founder-status"><ShieldCheck size={18}/><span><strong>{data.monitor?"High-frequency RADAR active":"Monitoring needs setup"}</strong><small>{data.monitor?`${data.live?.activeCompetitorMonitors||0} competitor watches · ${data.live?.eventsLastHour||0} events last hour`:"Open Settings to activate"}</small></span></div>
    </div>

    <section className="panel founder-panel" style={{marginBottom:13,borderColor:data.live?.critical?"#aeb4b8":undefined}}>
      <div className="founder-panel-head"><div><span>LIVE INTELLIGENCE STATUS</span><h2>Event-driven competitive watch</h2></div><Activity size={21}/></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:10}}>
        <div className="stat-tile"><span>Discovery</span><strong>{data.live?.activeDiscoveryMonitors||0}</strong><small>high-frequency market watch</small></div>
        <div className="stat-tile"><span>Entity watches</span><strong>{data.live?.activeCompetitorMonitors||0}</strong><small>verified companies watched</small></div>
        <div className="stat-tile"><span>Events · 1h</span><strong>{data.live?.eventsLastHour||0}</strong><small>processed intelligence events</small></div>
        <div className="stat-tile"><span>Last event</span><strong style={{fontSize:18}}>{ago(data.live?.lastMonitorEvent)}</strong><small>monitor heartbeat</small></div>
      </div>
      <div style={{fontSize:10,color:"#858b90",marginTop:10,display:"flex",alignItems:"center",gap:5}}><Clock3 size={12}/>Dashboard refreshes every 5 seconds · last UI refresh {lastRefresh?lastRefresh.toLocaleTimeString():"-"}</div>
    </section>

    <section className="panel founder-panel" style={{marginBottom:13}}>
      <div className="founder-panel-head"><div><span>LIVE INTELLIGENCE FEED</span><h2>What RADAR just detected</h2></div><small>{data.live?.highPriority||0} high-priority open</small></div>
      {liveEvents.length?<div style={{display:"grid"}}>{liveEvents.map((e:any)=><div key={e.id} style={{display:"grid",gridTemplateColumns:"90px minmax(0,1fr) 70px",gap:12,padding:"11px 0",borderBottom:"1px solid #e5e7e9",alignItems:"start"}}><div><span style={{fontSize:10,textTransform:"uppercase",letterSpacing:".08em",color:"#747b80"}}>{e.severity}</span><div style={{fontSize:10,color:"#999",marginTop:4}}>{ago(e.occurred_at)}</div></div><div><strong style={{fontSize:12}}>{e.title}</strong><div style={{fontSize:11,lineHeight:1.5,color:"#6f767b",marginTop:3}}>{e.summary}</div>{e.source_url?<a href={e.source_url} target="_blank" rel="noreferrer" style={{fontSize:10,color:"#555",textDecoration:"none",display:"inline-block",marginTop:4}}>Open evidence ↗</a>:null}</div><div style={{textAlign:"right"}}><strong style={{fontSize:12}}>{Number(e.impact_score||0)}%</strong><div style={{fontSize:9,color:"#8c9296"}}>impact</div></div></div>)}</div>:<div style={{padding:"18px 0",fontSize:12,color:"#737a80"}}>No live intelligence events yet. RADAR will populate this feed as monitored public sources change.</div>}
    </section>

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
