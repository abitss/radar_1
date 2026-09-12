"use client";

import { useEffect, useMemo, useState } from "react";
import { BrainCircuit, CheckCircle2, Circle, ShieldCheck } from "lucide-react";
import { PageIntro } from "@/components/intelligence-ui";
import { StartupProfileForm } from "@/components/startup-profile-form";

export default function BrainPage() {
  const [data,setData]=useState<any>(null);
  const [error,setError]=useState("");
  useEffect(()=>{fetch("/api/radar/overview",{cache:"no-store"}).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error||"Could not load Company Brain");return j}).then(setData).catch(e=>setError(e.message))},[]);
  const completeness=useMemo(()=>{
    const w=data?.workspace||{};
    const fields=[w.name,w.website,w.description,w.industry,w.sub_category,w.problem_statement,w.target_customers,w.buyer,w.product_keywords?.length,w.major_features?.length,w.capability_keywords?.length,w.technology_keywords?.length,w.business_model,w.pricing_context,w.geography,w.positioning];
    const done=fields.filter(Boolean).length;
    return {done,total:fields.length,percent:Math.round(done/fields.length*100)};
  },[data]);

  if(error)return <div className="content"><div className="panel founder-panel">{error}</div></div>;
  return <div className="content">
    <PageIntro eyebrow="COMPANY BRAIN" title="What RADAR believes about your company." description="This editable strategic profile is the context engine behind discovery, similarity, monitoring, signals, briefings and Ask RADAR." />
    <section className="metrics-grid brain-metrics">
      <div className="stat-tile"><span>Profile completeness</span><strong>{data?`${completeness.percent}%`:"…"}</strong><small>{data?`${completeness.done}/${completeness.total} context fields`:"Loading"}</small></div>
      <div className="stat-tile"><span>Competitive universe</span><strong>{data?.metrics?.competitors??"…"}</strong><small>Tracked companies</small></div>
      <div className="stat-tile"><span>Monitored competitors</span><strong>{data?.metrics?.monitoredCompetitors??"…"}</strong><small>Approved / actively watched</small></div>
      <div className="stat-tile"><span>Evidence</span><strong>{data?.metrics?.evidence??"…"}</strong><small>{data?.metrics?`${data.metrics.highConfidenceEvidence||0} high confidence`:"Loading"}</small></div>
    </section>

    <section className="panel founder-panel" style={{marginBottom:13}}>
      <div className="founder-panel-head"><div><span>CONTEXT HEALTH</span><h2>{completeness.percent>=80?"Strong Company Brain":completeness.percent>=50?"Usable, but RADAR can learn more":"Company Brain needs more context"}</h2></div>{completeness.percent>=80?<CheckCircle2 size={21}/>:<BrainCircuit size={21}/>}</div>
      <p>{completeness.percent>=80?"Discovery and interpretation have enough structured context to be selective instead of broad.":"Complete the missing business, customer, pricing, positioning and feature context below to improve competitor precision and reduce noise."}</p>
      <div style={{height:8,borderRadius:999,background:"#e8ebed",overflow:"hidden",marginTop:12}}><div style={{height:"100%",width:`${completeness.percent}%`,background:"#202428"}}/></div>
    </section>

    <StartupProfileForm />
    <section className="panel founder-panel" style={{marginTop:13}}><div className="founder-panel-head"><div><span>TRUST RULE</span><h2>Company Brain is editable, not unquestionable.</h2></div><ShieldCheck size={20}/></div><p>RADAR may infer company context from public evidence, but the founder remains the authority on what the company actually builds, sells and prioritizes.</p></section>
  </div>;
}
