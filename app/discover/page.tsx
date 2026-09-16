"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, LoaderCircle, RefreshCcw, X, ShieldCheck, Search, RadioTower } from "lucide-react";
import { PageIntro } from "@/components/intelligence-ui";

function ago(raw?:string|null){if(!raw)return"never";const ms=Date.now()-new Date(raw).getTime();const m=Math.max(0,Math.floor(ms/60000));if(m<1)return"just now";if(m<60)return`${m}m ago`;const h=Math.floor(m/60);if(h<24)return`${h}h ago`;return`${Math.floor(h/24)}d ago`}

export default function DiscoverPage(){
  const [rows,setRows]=useState<any[]>([]);
  const [meta,setMeta]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  const [scanning,setScanning]=useState(false);
  const [message,setMessage]=useState("");
  const [filter,setFilter]=useState<"review"|"promoted"|"all">("review");
  const [acting,setActing]=useState<string|null>(null);

  async function load(){
    setLoading(true);
    try{
      const res=await fetch("/api/radar/discover",{cache:"no-store"});
      const data=await res.json();
      if(!res.ok)throw new Error(data?.error||"Could not load discovery");
      setRows(Array.isArray(data?.candidates)?data.candidates:[]);
      setMeta(data);
    }catch(e){setMessage(e instanceof Error?e.message:"Could not load discovery")}
    finally{setLoading(false)}
  }

  useEffect(()=>{load()},[]);

  async function scan(){
    if(scanning)return;
    setScanning(true);setMessage("");
    try{
      const res=await fetch("/api/radar/discover",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({force:true})});
      const data=await res.json();
      if(!res.ok&&!data?.cooldown)throw new Error(data?.error||"Discovery failed");
      setMessage(data?.cooldown?data.error:data?.degraded?data.error:`Scanned ${data.inspected||0} public results · resolved ${data.entities_extracted||0} company entities · added ${data.candidates_found||0} candidates · promoted ${data.promoted||0}`);
      await load();
    }catch(e){setMessage(e instanceof Error?e.message:"Discovery failed")}
    finally{setScanning(false)}
  }

  async function act(id:string,action:"approve"|"reject"|"ignore"){
    if(acting)return;
    setActing(id);setMessage("");
    try{
      const res=await fetch(`/api/radar/candidates/${encodeURIComponent(id)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action})});
      const data=await res.json();
      if(!res.ok)throw new Error(data?.error||"Action failed");
      setRows(prev=>prev.map(r=>r.id===id?{...r,status:action==="approve"?"promoted":action==="reject"?"rejected":"ignored"}:r));
      setMessage(action==="approve"?"Competitor promoted into your competitive universe.":action==="reject"?"Candidate rejected. Future scans will preserve this decision.":"Candidate ignored.");
    }catch(e){setMessage(e instanceof Error?e.message:"Action failed")}
    finally{setActing(null)}
  }

  const companies=rows.filter(r=>r.entity_type!=="source");
  const sources=rows.filter(r=>r.entity_type==="source");
  const reviewRows=companies.filter(r=>["new","candidate"].includes(r.status));
  const promotedRows=companies.filter(r=>r.status==="promoted");
  const visible=filter==="review"?reviewRows:filter==="promoted"?promotedRows:companies;
  const stats=useMemo(()=>({
    review:reviewRows.length,
    strong:companies.filter(r=>Number(r.product_overlap_score||0)>=50&&Number(r.relation_confidence||0)>=70).length,
    promoted:promotedRows.length,
    sources:sources.length,
  }),[rows]);

  const last=meta?.last_run;
  return <div className="content">
    <PageIntro eyebrow="DISCOVERY ENGINE" title="Discover" description="RADAR searches broadly, resolves real company entities, verifies official domains and separates evidence sources from actual competitors. Articles, research papers and directories can inform discovery, but they cannot become competitors by themselves." action={<button onClick={scan} disabled={scanning} className="primary-button">{scanning?<LoaderCircle size={14}/>:<RefreshCcw size={14}/>} {scanning?"Discovering...":"Discover competitors"}</button>}/>

    {message?<div className="competition-live-message" style={{marginBottom:12}}>{message}</div>:null}

    <section className="metrics-grid">
      <div className="stat-tile"><span>Needs review</span><strong>{stats.review}</strong><small>Unconfirmed company candidates</small></div>
      <div className="stat-tile"><span>Strong matches</span><strong>{stats.strong}</strong><small>≥50% overlap and ≥70% confidence</small></div>
      <div className="stat-tile"><span>Promoted</span><strong>{stats.promoted}</strong><small>Inside competitive universe</small></div>
      <div className="stat-tile"><span>Active watches</span><strong>{meta?.active_entity_monitors||0}</strong><small>Competitor surveillance monitors</small></div>
    </section>

    <section className="panel founder-panel" style={{marginBottom:13}}>
      <div className="founder-panel-head"><div><span>DISCOVERY HEALTH</span><h2>What the engine is doing</h2></div><Search size={20}/></div>
      <div className="discover-health-grid">
        <div><span>Public search</span><strong>{meta?.configured?"Ready":"Not configured"}</strong><small>{meta?.firecrawl?"Firecrawl":""}{meta?.firecrawl&&meta?.live_search?" + ":""}{meta?.live_search?"live search":""}</small></div>
        <div><span>AI entity resolution</span><strong>{meta?.ai?"Ready":"Fallback mode"}</strong><small>{meta?.ai_expansion_items||0} Company Brain expansion angles</small></div>
        <div><span>Last discovery</span><strong>{last?.status||"waiting"}</strong><small>{last?`${last.pages_scanned||0} results · ${ago(last.finished_at||last.started_at)}`:"No run yet"}</small></div>
        <div><span>Source leads</span><strong>{stats.sources}</strong><small>Evidence only, never auto-promoted</small></div>
      </div>
    </section>

    <section className="panel founder-panel">
      <div className="founder-panel-head"><div><span>COMPANY CANDIDATES</span><h2>Review what may actually compete with you</h2></div><small>Founder decisions are preserved</small></div>
      <div className="discover-filter-row">
        <button className={filter==="review"?"active":""} onClick={()=>setFilter("review")}>Needs review · {reviewRows.length}</button>
        <button className={filter==="promoted"?"active":""} onClick={()=>setFilter("promoted")}>Promoted · {promotedRows.length}</button>
        <button className={filter==="all"?"active":""} onClick={()=>setFilter("all")}>All · {companies.length}</button>
      </div>

      {loading?<div style={{padding:"22px 0",color:"#747b81"}}>Resolving companies and products...</div>:visible.length?<div className="discover-company-list">{visible.map((c:any)=>{
        const overlap=Math.round(Number(c.product_overlap_score||0));
        const confidence=Math.round(Number(c.relation_confidence||0));
        const canReview=["new","candidate"].includes(c.status);
        return <div key={c.id} className="discover-company-row">
          <div>
            <div className="discover-company-title"><strong>{c.title||c.domain}</strong><span>{overlap}% overlap</span><span>{confidence}% confidence</span>{c.status==="promoted"?<span className="discover-verified"><ShieldCheck size={11}/> promoted</span>:null}</div>
            <div className="discover-product">{c.related_product||"Related product being resolved"}</div>
            <div className="discover-reason">{c.relationship_reason||c.description||"RADAR found this company through a related market search."}</div>
            <div className="discover-meta"><span>{c.domain}</span><span>Status: {c.status}</span>{c.official_website?<a href={c.official_website} target="_blank" rel="noreferrer">official site <ExternalLink size={10}/></a>:null}{c.source_page_url?<a href={c.source_page_url} target="_blank" rel="noreferrer">evidence <ExternalLink size={10}/></a>:null}</div>
          </div>
          <div className="discover-actions">
            {canReview?<><button disabled={acting===c.id} className="secondary-button" onClick={()=>act(c.id,"reject")}><X size={13}/> Reject</button><button disabled={acting===c.id||!c.official_website} className="primary-button" onClick={()=>act(c.id,"approve")}><Check size={13}/> Promote</button></>:c.status==="promoted"?<span className="discover-in-universe"><RadioTower size={13}/> In universe</span>:<button disabled={acting===c.id||!c.official_website} className="secondary-button" onClick={()=>act(c.id,"approve")}><Check size={13}/> Restore</button>}
          </div>
        </div>})}</div>:<div style={{padding:"24px 0",color:"#737a80"}}>{filter==="review"?"Nothing needs review right now. Run discovery to search for new competitors.":"No companies in this view yet."}</div>}
    </section>

    {sources.length?<section className="panel founder-panel" style={{marginTop:13}}><div className="founder-panel-head"><div><span>SOURCE LEADS</span><h2>Useful evidence sources, never competitors</h2></div><small>{sources.length} source lead{sources.length===1?"":"s"}</small></div><div className="founder-list-rows">{sources.slice(0,20).map((s:any)=><div key={s.id}><strong>{s.title||s.domain}</strong><span>{s.description||"Used only to discover real companies mentioned inside this source."}</span></div>)}</div></section>:null}
  </div>;
}
