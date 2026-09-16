"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CircleAlert, Radar, ShieldCheck, Signal, Sparkles, Target, Activity, Clock3, RefreshCw, Search, Radio, DatabaseZap, CheckCircle2, AlertTriangle } from "lucide-react";

type Overview = any;

function ago(raw?:string|null){if(!raw)return"waiting for first event";const ms=Date.now()-new Date(raw).getTime();const m=Math.max(0,Math.floor(ms/60000));if(m<1)return"just now";if(m<60)return`${m}m ago`;const h=Math.floor(m/60);if(h<24)return`${h}h ago`;return`${Math.floor(h/24)}d ago`}
function scanLabel(scan:any){if(!scan)return"No scan yet";const type=String(scan.run_type||"").replaceAll("_"," ");return`${type} · ${scan.status}`}

export default function Home(){
  const [data,setData] = useState<Overview|null>(null);
  const [brief,setBrief] = useState<any>(null);
  const [system,setSystem] = useState<any>(null);
  const [error,setError] = useState("");
  const [lastRefresh,setLastRefresh]=useState<Date|null>(null);
  const [busy,setBusy]=useState<""|"refresh"|"discover"|"brief">("");
  const [message,setMessage]=useState("");

  async function loadOverview(silent=false){
    try{
      const r=await fetch("/api/radar/overview",{cache:"no-store"});
      const j=await r.json();
      if(!r.ok)throw new Error(j.error||"Could not load RADAR");
      setData(j);setLastRefresh(new Date());if(!silent)setError("");
    }catch(e){if(!silent)setError(e instanceof Error?e.message:"Could not load RADAR")}
  }
  async function loadBrief(){try{const r=await fetch("/api/radar/brief",{cache:"no-store"});if(r.ok)setBrief(await r.json())}catch{}}
  async function loadSystem(){try{const r=await fetch("/api/radar/system-status",{cache:"no-store"});if(r.ok)setSystem(await r.json())}catch{}}
  async function reloadAll(){await Promise.all([loadOverview(true),loadBrief(),loadSystem()]);setLastRefresh(new Date())}

  useEffect(()=>{
    reloadAll();
    const overviewTimer=window.setInterval(()=>{loadOverview(true);loadSystem()},7000);
    const briefTimer=window.setInterval(()=>loadBrief(),60000);
    const onFocus=()=>reloadAll();
    window.addEventListener("focus",onFocus);
    return()=>{window.clearInterval(overviewTimer);window.clearInterval(briefTimer);window.removeEventListener("focus",onFocus)};
  },[]);

  async function runAction(kind:"refresh"|"discover"|"brief"){
    if(busy)return;setBusy(kind);setMessage(kind==="refresh"?"Refreshing competitive intelligence...":kind==="discover"?"Discovering new competitors...":"Refreshing founder brief...");
    try{
      if(kind==="brief"){await loadBrief();setMessage("Founder brief refreshed.");await reloadAll();return;}
      const endpoint=kind==="refresh"?"/api/radar/refresh":"/api/radar/discover";
      const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(kind==="discover"?{force:true}:{}),cache:"no-store"});
      const j=await r.json().catch(()=>({}));
      if(!r.ok&&!j?.cooldown)throw new Error(j.error||`${kind} failed`);
      if(j?.cooldown)setMessage(j.message||j.error||"A RADAR job is already running.");
      else if(kind==="refresh")setMessage(`Refresh complete · ${j.deep_scans||0} deep scans · ${j.market_events||0} market events · ${j.signals_created||0} new signals.`);
      else setMessage(`${j.inspected||0} results inspected · ${j.entities_extracted||0} entities resolved · ${j.promoted||0} competitors promoted.`);
      await reloadAll();
    }catch(e){setMessage(e instanceof Error?e.message:"RADAR action failed")}finally{setBusy("")}
  }

  const liveEvents=useMemo(()=>Array.isArray(data?.events)?data.events.slice(0,8):[],[data]);
  if(error) return <div className="content"><div className="panel founder-panel"><strong>RADAR could not load.</strong><p>{error}</p><button className="primary-button" onClick={()=>reloadAll()}><RefreshCw size={14}/>Retry</button></div></div>;
  if(!data) return <div className="content"><div className="panel founder-panel">Loading your competitive universe...</div></div>;
  if(!data.workspace?.onboarding_completed) return <div className="content founder-today"><div className="founder-today-head"><div><span>WELCOME TO RADAR</span><h1>Build your Company Brain.</h1><p>Tell RADAR what you are building. A website is optional and can be added later as another evidence source.</p></div></div><Link href="/onboarding" className="primary-button">Build my RADAR <ArrowRight size={14}/></Link></div>;

  const urgent = (data.recommendations||[]).filter((r:any)=>r.status==="open").slice(0,4);
  const signals = (data.signals||[]).slice(0,4);
  const monitoringActive=Number(data.live?.activeMonitors||0)>0;
  const systemHealthy=Boolean(system?.launch_ready);
  const latestScan=system?.scans?.latest||null;

  return <div className="content founder-today">
    <div className="founder-today-head">
      <div><span>FOUNDER BRIEF · LIVE</span><h1>{data.live?.critical?`${data.live.critical} critical competitive event${data.live.critical===1?"":"s"} require attention.`:data.metrics.newSignals?`${data.metrics.newSignals} new signal${data.metrics.newSignals===1?"":"s"} deserve attention.`:"No major new movement detected."}</h1><p>RADAR continuously converts public competitive movement into evidence, threat scoring and founder decisions.</p></div>
      <div className="founder-status"><ShieldCheck size={18}/><span><strong>{monitoringActive?"RADAR monitoring active":"Monitoring needs setup"}</strong><small>{monitoringActive?`${data.live?.activeCompetitorMonitors||0} entity watches · ${data.live?.eventsLastHour||0} events last hour`:"Open Companies or Monitor to activate watches"}</small></span></div>
    </div>

    <section className="panel founder-panel" style={{marginBottom:13}}>
      <div className="founder-panel-head"><div><span>FOUNDER COMMANDS</span><h2>Run intelligence on demand</h2></div><small>{busy?"RADAR is working":"Ready"}</small></div>
      <div className="dashboard-command-grid">
        <button className="dashboard-command" onClick={()=>runAction("refresh")} disabled={Boolean(busy)}><RefreshCw size={16}/><span><strong>Refresh intelligence</strong><small>Discover, verify, research and correlate movement</small></span></button>
        <button className="dashboard-command" onClick={()=>runAction("discover")} disabled={Boolean(busy)}><Search size={16}/><span><strong>Discover competitors</strong><small>Search public web for new company entities</small></span></button>
        <button className="dashboard-command" onClick={()=>runAction("brief")} disabled={Boolean(busy)}><Sparkles size={16}/><span><strong>Refresh founder brief</strong><small>Regenerate evidence-grounded summary</small></span></button>
        <Link href="/sources" className="dashboard-command"><Radio size={16}/><span><strong>Manage monitoring</strong><small>Inspect sources, alerts and monitor health</small></span></Link>
      </div>
      {message?<div className="competition-live-message" style={{marginTop:10,border:0,padding:"10px 12px"}}>{message}</div>:null}
    </section>

    <section className="panel founder-panel" style={{marginBottom:13,borderColor:data.live?.critical?"#aeb4b8":undefined}}>
      <div className="founder-panel-head"><div><span>LIVE INTELLIGENCE STATUS</span><h2>Event-driven competitive watch</h2></div><Activity size={21}/></div>
      <div className="founder-live-grid">
        <div className="stat-tile"><span>Discovery pool</span><strong>{data.metrics?.candidates||0}</strong><small>candidate companies mapped</small></div>
        <div className="stat-tile"><span>Entity watches</span><strong>{data.live?.activeCompetitorMonitors||0}</strong><small>verified companies watched</small></div>
        <div className="stat-tile"><span>Events · 1h</span><strong>{data.live?.eventsLastHour||0}</strong><small>processed intelligence events</small></div>
        <div className="stat-tile"><span>Last event</span><strong style={{fontSize:18}}>{ago(data.live?.lastMonitorEvent)}</strong><small>monitor heartbeat</small></div>
      </div>
      <div style={{fontSize:10,color:"#858b90",marginTop:10,display:"flex",alignItems:"center",gap:5}}><Clock3 size={12}/>Dashboard refreshes every 7 seconds · last UI refresh {lastRefresh?lastRefresh.toLocaleTimeString():"-"}</div>
    </section>

    <section className="panel founder-panel" style={{marginBottom:13}}>
      <div className="founder-panel-head"><div><span>SYSTEM HEALTH</span><h2>{systemHealthy?"Workspace intelligence engine is operational":"Workspace still needs attention"}</h2></div>{systemHealthy?<CheckCircle2 size={21}/>:<AlertTriangle size={21}/>}</div>
      <div className="founder-live-grid">
        <div className="stat-tile"><span>Verified competitors</span><strong>{system?.intelligence?.verified_competitors??0}</strong><small>first-party deep scans</small></div>
        <div className="stat-tile"><span>Evidence</span><strong>{system?.intelligence?.evidence??data.metrics?.evidence??0}</strong><small>{system?.intelligence?.covered_competitors??0} competitors covered</small></div>
        <div className="stat-tile"><span>Healthy sources</span><strong>{system?.intelligence?.healthy_sources??0}</strong><small>of {system?.intelligence?.sources??0} tracked sources</small></div>
        <div className="stat-tile"><span>Running jobs</span><strong>{system?.scans?.running??0}</strong><small>{scanLabel(latestScan)}</small></div>
      </div>
      {system?.scans?.recent_failure?<div className="dashboard-health-note"><AlertTriangle size={13}/><span><strong>Recent failure:</strong> {system.scans.recent_failure.error||"A scan failed."}</span></div>:null}
    </section>

    <section className="panel founder-panel" style={{marginBottom:13}}>
      <div className="founder-panel-head"><div><span>LIVE INTELLIGENCE FEED</span><h2>What RADAR just detected</h2></div><small>{data.live?.highPriority||0} high-priority open</small></div>
      {liveEvents.length?<div style={{display:"grid"}}>{liveEvents.map((e:any)=><div key={e.id} className="founder-live-event"><div><span style={{fontSize:10,textTransform:"uppercase",letterSpacing:".08em",color:"#747b80"}}>{e.severity}</span><div style={{fontSize:10,color:"#999",marginTop:4}}>{ago(e.occurred_at)}</div></div><div><strong style={{fontSize:12}}>{e.title}</strong><div style={{fontSize:11,lineHeight:1.5,color:"#6f767b",marginTop:3}}>{e.summary}</div>{e.source_url?<a href={e.source_url} target="_blank" rel="noreferrer" style={{fontSize:10,color:"#555",textDecoration:"none",display:"inline-block",marginTop:4}}>Open evidence ↗</a>:null}</div><div style={{textAlign:"right"}}><strong style={{fontSize:12}}>{Number(e.impact_score||0)}%</strong><div style={{fontSize:9,color:"#8c9296"}}>impact</div></div></div>)}</div>:<div style={{padding:"18px 0",fontSize:12,color:"#737a80"}}>No live intelligence events yet. {monitoringActive?"Your active watches are waiting for a meaningful public change.":"Activate monitoring on relevant companies to begin the live feed."}</div>}
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
