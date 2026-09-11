"use client";

import { useEffect, useState } from "react";
import { Activity, BrainCircuit, LoaderCircle, Radar, ShieldCheck } from "lucide-react";
import { PageIntro } from "@/components/intelligence-ui";
import { StartupProfileForm } from "@/components/startup-profile-form";

export default function SettingsPage(){
  const [monitor,setMonitor]=useState<any>(undefined);
  const [configured,setConfigured]=useState(false);
  const [system,setSystem]=useState<any>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  async function load(){
    await Promise.all([
      fetch("/api/radar/continuous",{cache:"no-store"}).then(r=>r.json()).then(d=>{setMonitor(d.monitor||null);setConfigured(Boolean(d.configured))}).catch(()=>setMonitor(null)),
      fetch("/api/radar/system-status",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(setSystem).catch(()=>{}),
    ]);
  }
  useEffect(()=>{load()},[]);

  async function activate(){
    setBusy(true);setMessage(monitor?"Refreshing competitive universe...":"Activating continuous RADAR...");
    try{
      const discover=await fetch("/api/radar/discover",{method:"POST"});
      const discoverData=await discover.json().catch(()=>({}));
      if(!discover.ok && !discoverData?.cooldown) throw new Error(discoverData?.error||"Market discovery failed");
      const continuous=await fetch("/api/radar/continuous",{method:"POST"});
      const continuousData=await continuous.json().catch(()=>({}));
      if(!continuous.ok) throw new Error(continuousData?.error||"Continuous monitoring could not start");
      setMessage(monitor?"Competitive universe refreshed. Monitoring remains active.":"Continuous RADAR is active.");
      await load();
    }catch(error){setMessage(error instanceof Error?error.message:"Action failed")}finally{setBusy(false)}
  }

  return <div className="content">
    <PageIntro eyebrow="WORKSPACE CONTROL" title="Settings" description="Your Company Brain determines what RADAR considers relevant. Monitoring and AI status show whether the intelligence stack is ready."/>
    <section className="founder-two-col" style={{marginBottom:13}}>
      <article className="panel founder-panel">
        <div className="founder-panel-head"><div><span>SURVEILLANCE STATUS</span><h2>{monitor===undefined?"Checking…":monitor?"Continuous RADAR is active":"Continuous RADAR is not active"}</h2></div><Activity size={21}/></div>
        <p>{monitor?`Public-web discovery runs ${monitor.schedule_text||"automatically"}. ${monitor.last_event_at?`Last provider event: ${new Date(monitor.last_event_at).toLocaleString()}.`:"Waiting for the first provider event."}`:configured?"Activate continuous discovery for this workspace.":"The web-monitoring provider is not configured."}</p>
        <button onClick={activate} disabled={busy||!configured} className="secondary-button">{busy?<><LoaderCircle size={14}/>Working...</>:monitor?"Refresh competitive universe":"Activate RADAR"}</button>
        {message?<div style={{marginTop:9,fontSize:11,color:"#687076"}}>{message}</div>:null}
      </article>
      <article className="panel founder-panel">
        <div className="founder-panel-head"><div><span>AI INTELLIGENCE</span><h2>{system?.ai?.configured?"Grounded AI is active":"AI provider needs configuration"}</h2></div><BrainCircuit size={21}/></div>
        <p>{system?.ai?.configured?`Provider: ${system.ai.provider}. Model: ${system.ai.model}. AI answers are constrained to your Company Brain, competitors, Signals, decisions and stored evidence.`:"RADAR will keep working with deterministic evidence logic until an AI provider is configured."}</p>
        <div className="founder-action-block"><span>FAIL-SAFE</span><strong>If AI fails or rate-limits, RADAR falls back to stored evidence instead of breaking.</strong></div>
      </article>
    </section>
    <section className="panel founder-panel" style={{marginBottom:13}}>
      <div className="founder-panel-head"><div><span>LAUNCH STATUS</span><h2>{system?.launch_ready?"Core intelligence stack ready":"Core setup still incomplete"}</h2></div><ShieldCheck size={21}/></div>
      <p>Web intelligence: {system?.firecrawl?.configured?"ready":"not configured"} · AI: {system?.ai?.configured?"ready":"not configured"} · Continuous monitor: {system?.monitoring?.active?"active":"not active yet"}.</p>
    </section>
    <StartupProfileForm/>
    <section className="panel founder-panel" style={{marginTop:13}}><div className="founder-panel-head"><div><span>HOW RADAR WORKS</span><h2>Discovery → evidence → decision</h2></div><Radar size={21}/></div><p>Editing the Company Brain changes future discovery and scoring. Use “Refresh competitive universe” after a major positioning, customer or product change.</p></section>
  </div>;
}
