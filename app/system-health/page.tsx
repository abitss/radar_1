"use client";
import { useEffect, useState } from "react";
import { PageIntro, StatTile } from "@/components/intelligence-ui";
export default function SystemHealthPage(){
  const [data,setData]=useState<any>(null),[error,setError]=useState(""),[loading,setLoading]=useState(true);
  async function load(){setLoading(true);setError("");try{const r=await fetch("/api/radar/system-status",{cache:"no-store"});if(!r.ok)throw new Error("Unable to load system status. Please retry.");setData(await r.json());}catch(e){setError(e instanceof Error?e.message:"Status unavailable");}finally{setLoading(false);}}
  useEffect(()=>{void load();},[]);
  return <div className="content"><PageIntro eyebrow="OPERATIONS" title="System Health" description="Current discovery providers, source checks and recurring monitoring."/>
    <button onClick={load} disabled={loading}>{loading?"Checking providers…":"Refresh status"}</button>
    {error&&<p role="alert">{error}</p>}
    {data&&<><section className="metrics-grid">
      <StatTile label="Monitoring" value={data.monitoring.active?"Active":"Not confirmed"} note={data.monitoring.recurring_tasks_configured?"Recurring tasks configured":"Tasks need setup"}/>
      <StatTile label="Healthy sources" value={String(data.intelligence.healthy_sources)} note={`${data.intelligence.source_errors} source errors`}/>
      <StatTile label="RSS / Atom" value={String(data.crawler.rss_sources)} note="Active feeds"/>
      <StatTile label="Firecrawl" value={data.firecrawl.status} note="Optional premium fallback"/>
    </section><section className="metrics-grid">{Object.entries(data.providers||{}).map(([name,p]:[string,any])=><StatTile key={name} label={name} value={p.status.replaceAll("_"," ")} note={p.checked_at?`Last check: ${new Date(p.checked_at).toLocaleString()}`:"No recent check"}/>)}</section>
    <p>Direct crawler: {data.crawler.status}. AI model: {data.ai.standard||data.ai.fast||"See AI settings"}.</p>
    <p>Last recurring completion: {data.monitoring.last_completed_at?new Date(data.monitoring.last_completed_at).toLocaleString():"Not observed"}.</p></>}
  </div>;
}
