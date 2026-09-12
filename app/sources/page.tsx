"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, BellRing, ExternalLink, LoaderCircle, Save, ShieldCheck } from "lucide-react";
import { PageIntro } from "@/components/intelligence-ui";

export default function SourcesPage(){
  const [data,setData]=useState<any>(null);
  const [alerts,setAlerts]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");

  async function load(){
    setLoading(true);
    try{
      const [sourcesRes,alertsRes]=await Promise.all([
        fetch("/api/radar/sources",{cache:"no-store"}),
        fetch("/api/radar/alerts",{cache:"no-store"}),
      ]);
      const [sourcesData,alertsData]=await Promise.all([sourcesRes.json(),alertsRes.json()]);
      setData(sourcesData);setAlerts(alertsData);
    }finally{setLoading(false)}
  }
  useEffect(()=>{load()},[]);

  async function saveAlerts(){
    if(!alerts)return;
    setSaving(true);setMessage("");
    try{
      const r=await fetch("/api/radar/alerts",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(alerts)});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"Could not save alert settings");setAlerts(d);setMessage("Alert preferences saved.");
    }catch(e){setMessage(e instanceof Error?e.message:"Could not save alert settings")}finally{setSaving(false)}
  }

  const metrics=useMemo(()=>{
    const monitors=data?.monitors||[]; const evidence=data?.evidence||[]; const competitors=data?.competitors||[];
    return {sources:evidence.length,active:monitors.filter((m:any)=>m.status==="active").length,covered:competitors.filter((c:any)=>monitors.some((m:any)=>m.competitor_id===c.id&&m.status==="active")).length,health:monitors.filter((m:any)=>m.last_error).length};
  },[data]);
  return <div className="content">
    <PageIntro eyebrow="MONITORING CONTROL" title="Sources & Alerts" description="See what RADAR is watching, trace evidence to source, and control what is important enough to interrupt you."/>
    <section className="metrics-grid"><div className="stat-tile"><span>Evidence sources</span><strong>{metrics.sources}</strong><small>Recent stored observations</small></div><div className="stat-tile"><span>Active monitors</span><strong>{metrics.active}</strong><small>Continuous watches</small></div><div className="stat-tile"><span>Competitors covered</span><strong>{metrics.covered}</strong><small>Under active watch</small></div><div className="stat-tile"><span>Source errors</span><strong>{metrics.health}</strong><small>Needs attention</small></div></section>

    <section className="founder-two-col">
      <article className="panel founder-panel"><div className="founder-panel-head"><div><span>MONITORING HEALTH</span><h2>Live source registry</h2></div><Activity size={20}/></div>{loading?<p>Loading source coverage...</p>:(data?.monitors||[]).length?<div className="founder-list-rows">{data.monitors.map((m:any)=><div key={m.id}><strong>{m.competitor?.name||m.name}</strong><span>{m.monitor_type} · {m.status} · {m.schedule_text}{m.last_error?` · Error: ${m.last_error}`:""}</span></div>)}</div>:<p>No monitors are registered yet.</p>}</article>
      <article className="panel founder-panel"><div className="founder-panel-head"><div><span>SOURCE MIX</span><h2>Evidence by source type</h2></div><ShieldCheck size={20}/></div><div className="founder-list-rows">{data?.source_types&&Object.keys(data.source_types).length?Object.entries(data.source_types).map(([type,count]:any)=><div key={type}><strong>{String(type).replaceAll("_"," ")}</strong><span>{count} stored evidence item{Number(count)===1?"":"s"}</span></div>):<div><strong>No source history yet</strong><span>Evidence types will appear after discovery and monitoring runs.</span></div>}</div></article>
    </section>

    <section className="panel founder-panel founder-wide-panel" style={{marginTop:13}}>
      <div className="founder-panel-head"><div><span>ALERT RULES</span><h2>Only interrupt me when it matters.</h2></div><BellRing size={20}/></div>
      {alerts?<div className="startup-form-grid">
        <label><span>Minimum impact</span><input type="number" min="0" max="100" value={alerts.min_impact??70} onChange={e=>setAlerts({...alerts,min_impact:Number(e.target.value)})}/></label>
        <label><span>Minimum confidence</span><input type="number" min="0" max="100" value={alerts.min_confidence??70} onChange={e=>setAlerts({...alerts,min_confidence:Number(e.target.value)})}/></label>
        <label><span>New competitor threshold</span><input type="number" min="0" max="100" value={alerts.new_competitor_threshold??55} onChange={e=>setAlerts({...alerts,new_competitor_threshold:Number(e.target.value)})}/></label>
        <label><span>Delivery</span><select value={alerts.delivery_mode||"digest"} onChange={e=>setAlerts({...alerts,delivery_mode:e.target.value})} style={{height:42,border:"1px solid #d8dcdf",borderRadius:9,padding:"0 10px",background:"white"}}><option value="digest">Digest</option><option value="immediate">Immediate</option></select></label>
        <label style={{display:"flex",alignItems:"center",gap:8}}><input type="checkbox" checked={Boolean(alerts.email_enabled)} onChange={e=>setAlerts({...alerts,email_enabled:e.target.checked})}/><span>Email alerts enabled</span></label>
        <label style={{display:"flex",alignItems:"center",gap:8}}><input type="checkbox" checked={Boolean(alerts.include_high_threat_only)} onChange={e=>setAlerts({...alerts,include_high_threat_only:e.target.checked})}/><span>Only high-threat companies</span></label>
      </div>:<p>Loading alert preferences...</p>}
      <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",marginTop:14}}><span style={{fontSize:11,color:"#737a80"}}>{message||"Founder defaults are conservative. Tune thresholds as RADAR learns your market."}</span><button className="primary-button" onClick={saveAlerts} disabled={!alerts||saving}>{saving?<LoaderCircle size={14}/>:<Save size={14}/>} {saving?"Saving...":"Save alerts"}</button></div>
    </section>

    <section className="panel founder-panel founder-wide-panel" style={{marginTop:13}}><div className="founder-panel-head"><div><span>RECENT EVIDENCE</span><h2>Trace the intelligence back to source</h2></div><ExternalLink size={20}/></div><div style={{display:"grid",gap:0}}>{(data?.evidence||[]).slice(0,30).map((e:any)=><a key={e.id} href={e.source_url||"#"} target="_blank" rel="noreferrer" style={{display:"grid",gridTemplateColumns:"1fr auto",gap:12,padding:"12px 0",borderBottom:"1px solid #e3e6e8",textDecoration:"none"}}><div><strong style={{display:"block",fontSize:13,color:"#202428"}}>{e.title||e.source_type||"Public source"}</strong><span style={{fontSize:11,color:"#7a8085"}}>{e.source_url||"Source URL unavailable"}</span></div><span style={{fontSize:11,color:"#7a8085"}}>{Math.round(Number(e.confidence||0))}% confidence</span></a>)}{!loading&&!(data?.evidence||[]).length?<p>No source evidence yet.</p>:null}</div></section>
  </div>;
}
