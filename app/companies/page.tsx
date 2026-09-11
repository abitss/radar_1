"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import { PageIntro } from "@/components/intelligence-ui";

type Competitor = any;

export default function CompaniesPage(){
  const [rows,setRows]=useState<Competitor[]>([]); const [query,setQuery]=useState(""); const [loading,setLoading]=useState(true);
  useEffect(()=>{fetch("/api/radar/competitors",{cache:"no-store"}).then(r=>r.json()).then(d=>{setRows(Array.isArray(d)?d:[]);setLoading(false)})},[]);
  const filtered=useMemo(()=>rows.filter(c=>`${c.name} ${c.description||""} ${c.category}`.toLowerCase().includes(query.toLowerCase())),[rows,query]);
  const core=rows.filter(c=>Number(c.similarity_score||0)>=80).length; const closer=rows.filter(c=>c.movement==="closer").length; const scanned=rows.filter(c=>c.last_scanned_at).length;
  return <div className="content">
    <PageIntro eyebrow="COMPETITIVE UNIVERSE" title="Competitors" description="Every company RADAR has discovered or you have added, ranked by strategic proximity to your startup." action={<Link href="/onboarding" className="secondary-button">Rescan market</Link>}/>
    <section className="metrics-grid"><div className="stat-tile"><span>Tracked</span><strong>{rows.length}</strong><small>All competitor classes</small></div><div className="stat-tile"><span>Core</span><strong>{core}</strong><small>Similarity ≥ 80%</small></div><div className="stat-tile"><span>Moving closer</span><strong>{closer}</strong><small>Convergence detected</small></div><div className="stat-tile"><span>Deep-scanned</span><strong>{scanned}</strong><small>Evidence collected</small></div></section>
    <article className="panel" style={{padding:18}}>
      <div style={{display:"flex",alignItems:"center",gap:10,border:"1px solid #dde1e4",borderRadius:10,padding:"0 12px",height:44,marginBottom:14}}><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search competitors..." style={{border:0,outline:"none",width:"100%",fontSize:13,background:"transparent"}}/></div>
      {loading?<div style={{padding:20,color:"#747b81"}}>Loading competitors...</div>:filtered.length?<div className="intel-table-wrap"><div className="intel-table-head" style={{gridTemplateColumns:"2fr .7fr .7fr .7fr"}}><span>Company</span><span>Similarity</span><span>Threat</span><span>Movement</span></div>{filtered.map(c=><Link href={`/companies/${c.id}`} className="intel-table-row" style={{gridTemplateColumns:"2fr .7fr .7fr .7fr"}} key={c.id}><div className="signal-main"><div><span className="signal-company">{c.category}</span></div><strong>{c.name}</strong><small>{c.description||c.website}</small></div><strong>{Math.round(Number(c.similarity_score||0))}%</strong><strong>{Math.round(Number(c.threat_score||0))}%</strong><span className="age-cell">{c.movement||"stable"}<ArrowUpRight size={13}/></span></Link>)}</div>:<div style={{padding:28,textAlign:"center",color:"#737a80"}}>No competitors yet. Run onboarding once and RADAR will search the public web automatically.</div>}
    </article>
  </div>;
}
