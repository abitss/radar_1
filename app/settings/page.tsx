"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity, ArrowRight, Radar, ShieldCheck } from "lucide-react";
import { PageIntro } from "@/components/intelligence-ui";
import { StartupProfileForm } from "@/components/startup-profile-form";

export default function SettingsPage(){
  const [monitor,setMonitor]=useState<any>(undefined);
  const [configured,setConfigured]=useState(false);
  useEffect(()=>{fetch("/api/radar/continuous",{cache:"no-store"}).then(r=>r.json()).then(d=>{setMonitor(d.monitor||null);setConfigured(Boolean(d.configured))}).catch(()=>setMonitor(null))},[]);
  return <div className="content">
    <PageIntro eyebrow="WORKSPACE CONTROL" title="Settings" description="Your Company Brain determines what RADAR considers relevant. Monitoring status tells you whether the market is being watched continuously."/>
    <section className="founder-two-col" style={{marginBottom:13}}>
      <article className="panel founder-panel">
        <div className="founder-panel-head"><div><span>SURVEILLANCE STATUS</span><h2>{monitor===undefined?"Checking…":monitor?"Continuous RADAR is active":"Continuous RADAR is not active"}</h2></div><Activity size={21}/></div>
        <p>{monitor?`Public-web discovery runs ${monitor.schedule_text||"automatically"}. ${monitor.last_event_at?`Last provider event: ${new Date(monitor.last_event_at).toLocaleString()}.`:"Waiting for the first provider event."}`:configured?"Run one-URL onboarding to build your Company Brain and activate monitoring.":"The web-monitoring provider is not configured."}</p>
        <Link href="/onboarding" className="secondary-button">{monitor?"Rebuild competitive universe":"Activate RADAR"} <ArrowRight size={14}/></Link>
      </article>
      <article className="panel founder-panel">
        <div className="founder-panel-head"><div><span>PRIVACY MODEL</span><h2>Public evidence, private workspace.</h2></div><ShieldCheck size={21}/></div>
        <p>RADAR uses public/indexable market information for competitive monitoring. Your Company Brain, competitor graph, Signals and decisions stay inside your authenticated workspace.</p>
        <div className="founder-action-block"><span>LAUNCH MODE</span><strong>Evidence-backed competitive intelligence only. No invented competitor claims.</strong></div>
      </article>
    </section>
    <StartupProfileForm/>
    <section className="panel founder-panel" style={{marginTop:13}}><div className="founder-panel-head"><div><span>HOW RADAR WORKS</span><h2>Discovery → evidence → decision</h2></div><Radar size={21}/></div><p>Editing the Company Brain changes future discovery and scoring. Re-run onboarding after a major positioning, customer or product change so RADAR can rebuild its search universe.</p></section>
  </div>
}
