"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, LoaderCircle, Plus, Search, ShieldCheck, X } from "lucide-react";
import { PageIntro } from "@/components/intelligence-ui";

type Competitor = any;
type Filter = "active"|"verified"|"monitored"|"provisional"|"ignored"|"all";
type Sort = "threat"|"overlap"|"similarity"|"name";

function pct(v:any){const n=Number(v);return Number.isFinite(n)?Math.round(n):0}
function stateOf(c:any){if(c.monitoring_preference==="ignore")return"ignored";if(c.monitor_active)return"monitoring";if(c.last_scanned_at)return"verified";if(Number(c.evidence_count||0)>0)return"evidence-backed";return"provisional"}

export default function CompaniesPage(){
  const [rows,setRows]=useState<Competitor[]>([]);
  const [query,setQuery]=useState("");
  const [filter,setFilter]=useState<Filter>("active");
  const [sort,setSort]=useState<Sort>("threat");
  const [loading,setLoading]=useState(true);
  const [loadError,setLoadError]=useState("");
  const [scanning,setScanning]=useState(false);
  const [message,setMessage]=useState("");
  const [adding,setAdding]=useState(false);
  const [showAdd,setShowAdd]=useState(false);
  const [name,setName]=useState("");
  const [website,setWebsite]=useState("");
  const [monitoring,setMonitoring]=useState(false);

  async function load(silent=false){
    try{
      const r=await fetch("/api/radar/competitors",{cache:"no-store"});
      const d=await r.json();
      if(!r.ok)throw new Error(d?.error||"Could not load competitors");
      setRows(Array.isArray(d)?d:[]);
      setLoadError("");
    }catch(e){if(!silent)setLoadError(e instanceof Error?e.message:"Could not load competitors")}
    finally{if(!silent)setLoading(false)}
  }

  useEffect(()=>{load();const timer=window.setInterval(()=>load(true),8000);const onFocus=()=>load(true);window.addEventListener("focus",onFocus);return()=>{window.clearInterval(timer);window.removeEventListener("focus",onFocus)}},[]);

  async function rescan(){
    if(scanning)return;
    setScanning(true);setMessage("Refreshing discovery, verification, market events, evidence and founder actions...");
    try{
      const r=await fetch("/api/radar/refresh",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||"Market refresh failed");
      if(d.cooldown){setMessage(d.message||"A workspace refresh is already running.");await load(true);return}
      const discovery=d.discovery||{};
      setMessage(`${discovery.inspected||0} public results inspected · ${discovery.promoted||0} competitors added · ${d.deep_scans||0} verification scans · ${d.market_events||0} material market events · ${d.signals_created||0} new signals · ${d.recommendations_created||0} founder actions`);
      await load(true);
    }catch(e){setMessage(e instanceof Error?e.message:"Market refresh failed. Please try again.")}
    finally{setScanning(false)}
  }

  async function addCompetitor(e:FormEvent){
    e.preventDefault();if(!website.trim()||adding)return;
    setAdding(true);setMessage("");
    try{
      const r=await fetch("/api/radar/competitors",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,website})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||"Could not add competitor");
      await load(true);setName("");setWebsite("");setShowAdd(false);setFilter("active");
      setMessage(r.status===200?`${d.name||"Company"} is already in your competitive universe.`:"Company added to the watchlist. Open its dossier and run a deep scan to verify the relationship.");
    }catch(e){setMessage(e instanceof Error?e.message:"Could not add competitor")}
    finally{setAdding(false)}
  }

  async function monitorTop(){
    const targets=[...rows].filter(c=>c.monitoring_preference!=="ignore"&&!c.monitor_active&&c.website).sort((a,b)=>Number(b.threat_score||0)-Number(a.threat_score||0)).slice(0,5);
    if(!targets.length){setMessage("No unmonitored eligible competitors are ready for activation.");return}
    setMonitoring(true);setMessage(`Activating surveillance for ${targets.length} high-priority competitor${targets.length===1?"":"s"}...`);
    let ok=0;const failures:string[]=[];
    for(const c of targets){
      try{const r=await fetch(`/api/radar/competitors/${c.id}/monitor`,{method:"POST"});const d=await r.json();if(r.ok)ok++;else failures.push(`${c.name}: ${d.error||"failed"}`)}catch{failures.push(`${c.name}: failed`)}
    }
    await load(true);
    setMessage(`${ok} competitor watch${ok===1?"":"es"} active.${failures.length?` ${failures.length} could not be activated.`:""}`);
    setMonitoring(false);
  }

  const stats=useMemo(()=>({
    total:rows.filter(c=>c.monitoring_preference!=="ignore").length,
    verified:rows.filter(c=>c.monitoring_preference!=="ignore"&&c.last_scanned_at).length,
    monitored:rows.filter(c=>c.monitoring_preference!=="ignore"&&c.monitor_active).length,
    ignored:rows.filter(c=>c.monitoring_preference==="ignore").length,
    core:rows.filter(c=>c.monitoring_preference!=="ignore"&&(Number(c.product_overlap_score||0)>=70||Number(c.similarity_score||0)>=75)).length,
  }),[rows]);

  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase();
    const arr=rows.filter(c=>{
      const state=stateOf(c);
      const matchesFilter=filter==="all"||(filter==="active"?state!=="ignored":filter==="verified"?Boolean(c.last_scanned_at):filter==="monitored"?Boolean(c.monitor_active):filter==="provisional"?!c.last_scanned_at&&c.monitoring_preference!=="ignore":state==="ignored");
      const hay=`${c.name} ${c.related_product||""} ${c.description||""} ${c.relationship_reason||""} ${c.category||""} ${state}`.toLowerCase();
      return matchesFilter&&(!q||hay.includes(q));
    });
    arr.sort((a,b)=>sort==="name"?String(a.name).localeCompare(String(b.name)):Number(b[sort==="overlap"?"product_overlap_score":sort==="similarity"?"similarity_score":"threat_score"]||0)-Number(a[sort==="overlap"?"product_overlap_score":sort==="similarity"?"similarity_score":"threat_score"]||0));
    return arr;
  },[rows,query,filter,sort]);

  return <div className="content">
    <PageIntro eyebrow="PRODUCT-LEVEL COMPETITIVE UNIVERSE" title="Competitors" description="Review every company RADAR is tracking, distinguish provisional intelligence from first-party verification, control continuous monitoring, and open a full evidence-backed dossier." action={<div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button onClick={()=>setShowAdd(v=>!v)} className="secondary-button">{showAdd?<X size={14}/>:<Plus size={14}/>} {showAdd?"Close":"Add competitor"}</button><button onClick={monitorTop} disabled={monitoring||!stats.total} className="secondary-button">{monitoring?<LoaderCircle size={14}/>:<ShieldCheck size={14}/>} {monitoring?"Activating...":"Monitor top 5"}</button><button onClick={rescan} disabled={scanning} className="primary-button">{scanning?<><LoaderCircle size={14}/>Refreshing...</>:"Refresh intelligence"}</button></div>}/>

    {showAdd?<form onSubmit={addCompetitor} className="panel competitor-add-form"><label><span>Company name</span><input value={name} onChange={e=>setName(e.target.value)} placeholder="Optional"/></label><label><span>Official website</span><input value={website} onChange={e=>setWebsite(e.target.value)} placeholder="competitor.com" required/></label><button className="primary-button" disabled={adding}>{adding?<LoaderCircle size={14}/>:<Plus size={14}/>} {adding?"Adding...":"Add to watchlist"}</button></form>:null}
    {loadError?<div className="competition-live-message radar-error-message" style={{marginBottom:12}}>{loadError} <button onClick={()=>load()} className="text-button" style={{display:"inline-flex",marginLeft:8}}>Retry</button></div>:null}
    {message?<div className="competition-live-message" style={{marginBottom:12}}>{message}</div>:null}

    <section className="metrics-grid"><div className="stat-tile"><span>Active universe</span><strong>{stats.total}</strong><small>Companies not dismissed</small></div><div className="stat-tile"><span>Core product threats</span><strong>{stats.core}</strong><small>High product overlap / proximity</small></div><div className="stat-tile"><span>Continuous watches</span><strong>{stats.monitored}</strong><small>Provider monitoring active</small></div><div className="stat-tile"><span>First-party verified</span><strong>{stats.verified}</strong><small>Deep-scan verification complete</small></div></section>

    <article className="panel" style={{padding:18}}>
      <div className="competitor-list-toolbar"><div className="competitor-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search company, product, relationship or category..."/></div><select value={sort} onChange={e=>setSort(e.target.value as Sort)}><option value="threat">Highest threat</option><option value="overlap">Highest product overlap</option><option value="similarity">Highest similarity</option><option value="name">Company name</option></select></div>
      <div className="competitor-filter-row">{(["active","verified","monitored","provisional","ignored","all"] as Filter[]).map(x=><button key={x} className={filter===x?"active":""} onClick={()=>setFilter(x)}>{x.charAt(0).toUpperCase()+x.slice(1)}{x==="ignored"&&stats.ignored?` · ${stats.ignored}`:""}</button>)}</div>

      {loading?<div style={{padding:20,color:"#747b81"}}>Loading competitors...</div>:filtered.length?<div className="intel-table-wrap"><div className="intel-table-head competitor-table-grid"><span>Company</span><span>Competing product</span><span>Overlap</span><span>Threat</span><span>Evidence</span><span>State</span></div>{filtered.map(c=><Link href={`/companies/${c.id}`} className="intel-table-row competitor-table-grid" key={c.id}><div className="signal-main"><div><span className="signal-company">{c.category}{c.category_locked?" · founder locked":""}</span></div><strong>{c.name}</strong><small>{c.relationship_reason||c.description||c.website}</small></div><div className="signal-main"><strong>{c.related_product||"Product relationship being verified"}</strong><small>{pct(c.relation_confidence)}% relationship confidence</small></div><strong>{pct(c.product_overlap_score)}%</strong><strong>{pct(c.threat_score)}%</strong><div className="signal-main"><strong>{Number(c.evidence_count||0)}</strong><small>{Number(c.high_confidence_evidence||0)} high confidence</small></div><span className={`competitor-state-chip ${stateOf(c)}`}>{stateOf(c)}<ArrowUpRight size={13}/></span></Link>)}</div>:<div className="competitor-list-empty"><strong>{query?"No competitors match this search.":filter==="ignored"?"No dismissed competitors.":"No competitors in this view yet."}</strong><span>{filter==="active"&&!query?"Run discovery or add a company manually to build the competitive universe.":"Change the filter or search terms."}</span></div>}
    </article>
  </div>;
}
