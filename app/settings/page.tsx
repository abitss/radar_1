"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity, ArrowRight, BrainCircuit, Radar, ShieldCheck } from "lucide-react";
import { PageIntro } from "@/components/intelligence-ui";
import { StartupProfileForm } from "@/components/startup-profile-form";

export default function SettingsPage(){
  const [monitor,setMonitor]=useState<any>(undefined);
  const [configured,setConfigured]=useState(false);
  const [system,setSystem]=useState<any>(null);
  useEffect(()=>{
    fetch("/api/radar/continuous",{cache:"no-store"}).then(r=>r.json()).then(d=>{setMonitor(d.monitor||null);setConfigured(Boolean(d.configured))}).catch(()=>setMonitor(null));
    fetch("/api/radar/system-status",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(setSystem).catch(()=>{});
  },[]);
  return <div className="content">
    <PageIntro eyebrow="WORKSPACE CONTROL" title="Settings" description="Your Company Brain determines what RADAR considers relevant. Monitoring and AI status show whether the intelligence stack is ready."/>
    <section className="founder-two-col" style={{marginBottom:13}}>
      <article className="panel founder-panel">
        <div className="founder-panel-head"><div><span>SURVEILLANCE STATUS</span><h2>{monitor===undefined?"Checking…":monitor?"Continuous RADAR is active":"Continuous RADAR is not active"}</h2></div><Activity size={21}/></div>
        <p>{monitor?`Public-web discovery runs ${monitor.schedule_text||"automatically"}. ${monitor.last_event_at?`Last provider event: ${new Date(monitor.last_event_at).toLocaleString()}.`:"Waiting for the first provider event."}`:configured?"Run one-URL onboarding to build your Company Brain and activate monitoring.":"The web-monitoring provider is not configured."}</p>
        <Link href="/onboarding" className="secondary-button">{monitor?"Rebuild competitive universe":"Activate RADAR"} <ArrowRight size={14}/></Link>
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
    <section className="panel founder-panel" style={{marginTop:13}}><div className="founder-panel-head"><div><span>HOW RADAR WORKS</span><h2>Discovery → evidence → decision</h2></div><Radar size={21}/></div><p>Editing the Company Brain changes future discovery and scoring. Re-run onboarding after a major positioning, customer or product change so RADAR can rebuild its search universe.</p></section>
  </div>
}
