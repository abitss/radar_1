"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, ExternalLink, ShieldCheck } from "lucide-react";
import { PageIntro } from "@/components/intelligence-ui";

export default function SourcesPage(){
  const [data,setData]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{fetch("/api/radar/sources",{cache:"no-store"}).then(r=>r.json()).then(d=>{setData(d);setLoading(false)}).catch(()=>setLoading(false))},[]);
  const metrics=useMemo(()=>{
    const monitors=data?.monitors||[]; const evidence=data?.evidence||[]; const competitors=data?.competitors||[];
    return {sources:evidence.length,active:monitors.filter((m:any)=>m.status==="active").length,covered:competitors.filter((c:any)=>monitors.some((m:any)=>m.competitor_id===c.id&&m.status==="active")).length,health:monitors.filter((m:any)=>m.last_error).length};
  },[data]);
  return <div className="content">
    <PageIntro eyebrow="MONITORING CONTROL" title="Sources & Alerts" description="See what RADAR is actually watching, where evidence comes from, and whether any monitoring source is unhealthy."/>
    <section className="metrics-grid"><div className="stat-tile"><span>Evidence sources</span><strong>{metrics.sources}</strong><small>Recent stored observations</small></div><div className="stat-tile"><span>Active monitors</span><strong>{metrics.active}</strong><small>Continuous watches</small></div><div className="stat-tile"><span>Competitors covered</span><strong>{metrics.covered}</strong><small>Under active watch</small></div><div className="stat-tile"><span>Source errors</span><strong>{metrics.health}</strong><small>Needs attention</small></div></section>

    <section className="founder-two-col">
      <article className="panel founder-panel"><div className="founder-panel-head"><div><span>MONITORING HEALTH</span><h2>Live source registry</h2></div><Activity size={20}/></div>{loading?<p>Loading source coverage...</p>:(data?.monitors||[]).length?<div className="founder-list-rows">{data.monitors.map((m:any)=><div key={m.id}><strong>{m.competitor?.name||m.name}</strong><span>{m.monitor_type} · {m.status} · {m.schedule_text}{m.last_error?` · Error: ${m.last_error}`:""}</span></div>)}</div>:<p>No monitors are registered yet.</p>}</article>
      <article className="panel founder-panel"><div className="founder-panel-head"><div><span>SOURCE MIX</span><h2>Evidence by source type</h2></div><ShieldCheck size={20}/></div><div className="founder-list-rows">{data?.source_types&&Object.keys(data.source_types).length?Object.entries(data.source_types).map(([type,count]:any)=><div key={type}><strong>{String(type).replaceAll("_"," ")}</strong><span>{count} stored evidence item{Number(count)===1?"":"s"}</span></div>):<div><strong>No source history yet</strong><span>Evidence types will appear after discovery and monitoring runs.</span></div>}</div></article>
    </section>

    <section className="panel founder-panel founder-wide-panel" style={{marginTop:13}}><div className="founder-panel-head"><div><span>RECENT EVIDENCE</span><h2>Trace the intelligence back to source</h2></div><ExternalLink size={20}/></div><div style={{display:"grid",gap:0}}>{(data?.evidence||[]).slice(0,30).map((e:any)=><a key={e.id} href={e.source_url||"#"} target="_blank" rel="noreferrer" style={{display:"grid",gridTemplateColumns:"1fr auto",gap:12,padding:"12px 0",borderBottom:"1px solid #e3e6e8",textDecoration:"none"}}><div><strong style={{display:"block",fontSize:13,color:"#202428"}}>{e.title||e.source_type||"Public source"}</strong><span style={{fontSize:11,color:"#7a8085"}}>{e.source_url||"Source URL unavailable"}</span></div><span style={{fontSize:11,color:"#7a8085"}}>{Math.round(Number(e.confidence||0))}% confidence</span></a>)}{!loading&&!(data?.evidence||[]).length?<p>No source evidence yet.</p>:null}</div></section>
  </div>;
}
