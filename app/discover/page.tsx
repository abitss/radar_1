"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, LoaderCircle, RefreshCcw, X } from "lucide-react";
import { PageIntro } from "@/components/intelligence-ui";

export default function DiscoverPage(){
  const [rows,setRows]=useState<any[]>([]); const [loading,setLoading]=useState(true); const [scanning,setScanning]=useState(false); const [message,setMessage]=useState("");
  async function load(){setLoading(true);try{const res=await fetch("/api/radar/discover",{cache:"no-store"});const data=await res.json();setRows(Array.isArray(data?.candidates)?data.candidates:[])}finally{setLoading(false)}}
  useEffect(()=>{load()},[]);
  async function scan(){setScanning(true);setMessage("");try{const res=await fetch("/api/radar/discover",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({force:true})});const data=await res.json();if(!res.ok&&!data?.cooldown)throw new Error(data?.error||"Discovery failed");setMessage(data?.cooldown?data.error:`${data.inspected||0} sources inspected · ${data.entities_extracted||0} real company entities extracted · ${data.promoted||0} product competitors promoted`);await load()}catch(e){setMessage(e instanceof Error?e.message:"Discovery failed")}finally{setScanning(false)}}
  async function act(id:string,action:"approve"|"reject"|"ignore"){const res=await fetch(`/api/radar/candidates/${encodeURIComponent(id)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action})});const data=await res.json();if(!res.ok){setMessage(data?.error||"Action failed");return}setRows(prev=>prev.map(r=>r.id===id?{...r,status:action==="approve"?"promoted":action==="reject"?"rejected":"ignored"}:r))}

  const companies=rows.filter(r=>r.entity_type!=="source"); const sources=rows.filter(r=>r.entity_type==="source");
  const stats=useMemo(()=>({
    review:companies.filter(r=>["new","candidate"].includes(r.status)).length,
    strong:companies.filter(r=>Number(r.product_overlap_score||0)>=50).length,
    promoted:companies.filter(r=>r.status==="promoted").length,
    sources:sources.length,
  }),[rows]);

  return <div className="content">
    <PageIntro eyebrow="DISCOVERY ENGINE" title="Discover" description="RADAR uses articles, directories, research pages and search results as leads, but only real companies with a related product can become competitors." action={<button onClick={scan} disabled={scanning} className="primary-button">{scanning?<LoaderCircle size={14}/>:<RefreshCcw size={14}/>} {scanning?"Resolving companies...":"Discover competitors"}</button>}/>
    {message?<div className="competition-live-message" style={{marginBottom:12}}>{message}</div>:null}
    <section className="metrics-grid"><div className="stat-tile"><span>Needs review</span><strong>{stats.review}</strong><small>Real company candidates</small></div><div className="stat-tile"><span>Strong product overlap</span><strong>{stats.strong}</strong><small>Overlap ≥ 50%</small></div><div className="stat-tile"><span>Promoted</span><strong>{stats.promoted}</strong><small>Verified competitor entities</small></div><div className="stat-tile"><span>Source leads</span><strong>{stats.sources}</strong><small>Articles/directories, not competitors</small></div></section>

    <section className="panel founder-panel">
      <div className="founder-panel-head"><div><span>COMPANY CANDIDATES</span><h2>Products that may compete with you</h2></div><small>Product-level evidence first</small></div>
      {loading?<div style={{padding:"22px 0",color:"#747b81"}}>Resolving companies and products...</div>:companies.length?<div style={{display:"grid",gap:0}}>{companies.map((c:any)=><div key={c.id} style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto",gap:16,padding:"14px 0",borderBottom:"1px solid #e3e6e8",alignItems:"center"}}><div><div style={{display:"flex",gap:8,alignItems:"center",marginBottom:5,flexWrap:"wrap"}}><strong style={{fontSize:13}}>{c.title||c.domain}</strong><span style={{fontSize:10,color:"#737a80"}}>{Math.round(Number(c.product_overlap_score||0))}% product overlap</span><span style={{fontSize:10,color:"#737a80"}}>{Math.round(Number(c.relation_confidence||0))}% confidence</span></div><div style={{fontSize:12,color:"#3f464b",fontWeight:600,marginBottom:4}}>{c.related_product||"Related product being resolved"}</div><div style={{fontSize:12,color:"#6f767c",lineHeight:1.5}}>{c.relationship_reason||c.description||c.url}</div><div style={{display:"flex",gap:10,alignItems:"center",marginTop:6,fontSize:10,color:"#91969a"}}><span>Status: {c.status}</span>{c.source_page_url?<a href={c.source_page_url} target="_blank" rel="noreferrer" style={{textDecoration:"none",color:"inherit",display:"inline-flex",gap:3,alignItems:"center"}}>source <ExternalLink size={10}/></a>:null}</div></div><div style={{display:"flex",gap:7}}>{["new","candidate"].includes(c.status)?<><button className="secondary-button" onClick={()=>act(c.id,"reject")}><X size={13}/> Reject</button><button className="primary-button" onClick={()=>act(c.id,"approve")}><Check size={13}/> Promote</button></>:c.status==="promoted"?<span style={{fontSize:11,color:"#555"}}>In competitive universe</span>:<button className="secondary-button" onClick={()=>act(c.id,"approve")}><Check size={13}/> Restore</button>}</div></div>)}</div>:<div style={{padding:"24px 0",color:"#737a80"}}>No verified company candidates yet. Run discovery and RADAR will resolve company names and related products from public sources.</div>}
    </section>

    {sources.length?<section className="panel founder-panel" style={{marginTop:13}}><div className="founder-panel-head"><div><span>SOURCE LEADS</span><h2>Useful sources, never competitors</h2></div><small>{sources.length} source lead{sources.length===1?"":"s"}</small></div><div className="founder-list-rows">{sources.slice(0,20).map((s:any)=><div key={s.id}><strong>{s.title||s.domain}</strong><span>{s.description||"Used only to discover real companies mentioned inside this source."}</span></div>)}</div></section>:null}
  </div>;
}
