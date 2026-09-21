"use client";

import Link from "next/link";
import { useEffect,useMemo,useState } from "react";
import { Archive,ArrowUpRight,Check,ChevronDown,ChevronUp,CircleAlert,ExternalLink,Filter,LoaderCircle,RefreshCcw,Search,Target,ThumbsDown,ThumbsUp } from "lucide-react";
import { PageIntro } from "@/components/intelligence-ui";
import "./signals.module.css";

type FilterKey="all"|"new"|"reviewed"|"high_impact"|"high_confidence"|"linked_move"|"archived";
function pct(v:any){return `${Math.round(Number(v||0))}%`}
function age(raw?:string|null){if(!raw)return"unknown";const ms=Math.max(0,Date.now()-new Date(raw).getTime());const min=Math.floor(ms/60000);if(min<1)return"just now";if(min<60)return`${min}m`;const h=Math.floor(min/60);if(h<24)return`${h}h`;return`${Math.floor(h/24)}d`}
function label(value:any){return String(value||"change").replaceAll("_"," ")}

export default function SignalsPage(){
  const[rows,setRows]=useState<any[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(""),[message,setMessage]=useState(""),[error,setError]=useState("");
  const[filter,setFilter]=useState<FilterKey>("all"),[query,setQuery]=useState(""),[expanded,setExpanded]=useState("");
  const[correlating,setCorrelating]=useState(false);

  async function load(silent=false){
    try{
      const r=await fetch("/api/radar/signals",{cache:"no-store"});const d=await r.json();
      if(!r.ok)throw new Error(d.error||"Could not load signals");
      setRows(Array.isArray(d)?d:[]);setError("");
    }catch(e){if(!silent)setError(e instanceof Error?e.message:"Could not load signals")}finally{if(!silent)setLoading(false)}
  }
  useEffect(()=>{load();const timer=window.setInterval(()=>load(true),10000);const focus=()=>load(true);window.addEventListener("focus",focus);return()=>{window.clearInterval(timer);window.removeEventListener("focus",focus)}},[]);

  async function feedback(id:string,type:"useful"|"not_useful"|"too_noisy"|"wrong_interpretation"|"wrong_fact"){
    if(busy)return;setBusy(id);setMessage("");
    try{
      const r=await fetch("/api/radar/feedback",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({target_type:"signal",target_id:id,feedback_type:type})});
      const d=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(d?.error||"Feedback failed");
      setMessage(type==="useful"?"Marked useful. RADAR will preserve this as positive signal-quality feedback.":type==="not_useful"?"Marked not useful. RADAR will use this to reduce similar noise.":type==="too_noisy"?"Marked too noisy.":type==="wrong_fact"?"Marked as a factual problem. Review this evidence before relying on it.":"Marked as an interpretation problem.");
      await load(true);
    }catch(e){setMessage(e instanceof Error?e.message:"Feedback failed")}finally{setBusy("")}
  }

  async function updateStatus(id:string,status:"new"|"reviewed"|"archived"){
    if(busy)return;setBusy(id);setMessage("");
    try{
      const r=await fetch("/api/radar/signals",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,status})});
      const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Could not update signal");
      setMessage(status==="reviewed"?"Signal marked reviewed.":status==="archived"?"Signal archived. It remains in RADAR's intelligence memory.":"Signal returned to the review inbox.");
      await load(true);
    }catch(e){setMessage(e instanceof Error?e.message:"Could not update signal")}finally{setBusy("")}
  }

  async function correlate(){
    if(correlating)return;setCorrelating(true);setMessage("Correlating reviewed and recent signals into strategic Moves...");
    try{
      const r=await fetch("/api/radar/moves",{method:"POST"});const d=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(d.error||"Could not correlate signals");
      setMessage(`${Number(d.moves||0)} strategic Move${Number(d.moves||0)===1?"":"s"} detected or refreshed from current signal patterns.`);
      await load(true);
    }catch(e){setMessage(e instanceof Error?e.message:"Could not correlate signals")}finally{setCorrelating(false)}
  }

  const stats=useMemo(()=>({
    total:rows.filter(r=>r.status!=="archived").length,
    newCount:rows.filter(r=>r.status==="new").length,
    high:rows.filter(r=>r.status!=="archived"&&Number(r.impact_score||0)>=80).length,
    linked:rows.filter(r=>r.status!=="archived"&&Number(r.move_count||0)>0).length,
  }),[rows]);

  const filtered=useMemo(()=>rows.filter(r=>{
    if(filter==="new"&&r.status!=="new")return false;
    if(filter==="reviewed"&&r.status!=="reviewed")return false;
    if(filter==="archived"&&r.status!=="archived")return false;
    if(filter==="high_impact"&&(r.status==="archived"||Number(r.impact_score||0)<80))return false;
    if(filter==="high_confidence"&&(r.status==="archived"||Number(r.confidence||0)<80))return false;
    if(filter==="linked_move"&&(r.status==="archived"||Number(r.move_count||0)<1))return false;
    if(filter==="all"&&r.status==="archived")return false;
    const hay=`${r.title||""} ${r.summary||""} ${r.signal_type||""} ${r.competitor?.name||""} ${r.explanation||""} ${r.impact||""}`.toLowerCase();
    return hay.includes(query.trim().toLowerCase());
  }),[rows,filter,query]);

  return <div className="content">
    <PageIntro eyebrow="EVIDENCE LAYER" title="Signals" description="RADAR's signal layer turns public changes into reviewable intelligence with source evidence, confidence, impact, founder feedback and Move linkage." action={<div className="signal-top-actions"><Link className="secondary-button" href="/moves">Open Moves</Link><button className="secondary-button" onClick={()=>load()} disabled={loading}><RefreshCcw size={14}/>Refresh</button><button className="primary-button" onClick={correlate} disabled={correlating||!rows.length}>{correlating?<LoaderCircle size={14}/>:<Target size={14}/>} {correlating?"Correlating...":"Correlate into Moves"}</button></div>}/>
    {error?<div className="competition-live-message radar-error-message" style={{marginBottom:12}}>{error}</div>:null}
    {message?<div className="competition-live-message" style={{marginBottom:12}}>{message}</div>:null}

    <section className="metrics-grid"><div className="stat-tile"><span>Active signals</span><strong>{stats.total}</strong><small>Current intelligence memory</small></div><div className="stat-tile"><span>Needs review</span><strong>{stats.newCount}</strong><small>Founder attention queue</small></div><div className="stat-tile"><span>High impact</span><strong>{stats.high}</strong><small>Impact ≥80</small></div><div className="stat-tile"><span>Linked to Moves</span><strong>{stats.linked}</strong><small>Signals contributing to patterns</small></div></section>

    <section className="panel signal-toolbar"><div className="signal-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search signal, company, event type or explanation..."/></div><div className="signal-filter-row"><Filter size={13}/>{(["all","new","reviewed","high_impact","high_confidence","linked_move","archived"] as FilterKey[]).map(x=><button key={x} onClick={()=>setFilter(x)} className={filter===x?"active":""}>{label(x)}</button>)}</div></section>

    <section className="signal-list">{loading?<div className="panel signal-empty">Loading live signals...</div>:filtered.length?filtered.map(row=>{
      const open=expanded===row.id;const evidence=Array.isArray(row.evidence)?row.evidence:[];const moves=Array.isArray(row.moves)?row.moves:[];
      return <article className={`panel signal-card signal-card-${row.status||"new"}`} key={row.id}>
        <div className="signal-card-head"><div className="signal-card-main"><div className="signal-card-tags"><span className="signal-company">{row.competitor?.name||"Market"}</span><span className="signal-type">{label(row.signal_type)}</span><span className={`signal-review-chip ${row.status||"new"}`}>{row.status||"new"}</span>{row.fact_or_inference?<span className="signal-review-chip">{label(row.fact_or_inference)}</span>:null}</div><h3>{row.title}</h3><p>{row.summary}</p></div><div className="signal-score-stack"><div><span>Impact</span><strong>{pct(row.impact_score)}</strong></div><div><span>Confidence</span><strong>{pct(row.confidence)}</strong></div><small>{age(row.observed_at||row.created_at)} ago</small></div></div>

        <div className="signal-core-grid"><div><span>Relevance</span><strong>{pct(row.relevance??row.impact_score)}</strong></div><div><span>Urgency</span><strong>{pct(row.urgency??0)}</strong></div><div><span>Novelty</span><strong>{pct(row.novelty??0)}</strong></div><div><span>Credibility</span><strong>{pct(row.credibility??row.confidence)}</strong></div><div><span>Evidence</span><strong>{row.evidence_count||0}</strong></div><div><span>Move links</span><strong>{row.move_count||0}</strong></div></div>

        {row.previous_state||row.new_state?<div className="signal-change-grid"><div><span>PREVIOUS STATE</span><p>{row.previous_state||"Not available"}</p></div><div><span>NEW STATE</span><p>{row.new_state||row.summary||"Not available"}</p></div></div>:null}

        {row.explanation||row.impact||row.suggested_action?<div className="signal-interpretation"><div><span>WHY IT MATTERS</span><p>{row.explanation||row.impact||"RADAR detected a meaningful change with competitive relevance."}</p></div>{row.suggested_action?<div><span>SUGGESTED NEXT STEP</span><p>{row.suggested_action}</p></div>:null}</div>:null}

        {moves.length?<div className="signal-move-links"><span>CONTRIBUTES TO</span>{moves.map((m:any)=><Link href="/moves" key={m.id}><strong>{m.title}</strong><small>{pct(m.contribution)} contribution · {m.status} · {pct(m.confidence)} confidence</small><ArrowUpRight size={12}/></Link>)}</div>:null}

        {open?<div className="signal-detail-panel"><div><span>SUPPORTING EVIDENCE</span>{evidence.length?<div className="signal-evidence-list">{evidence.map((e:any)=><a key={e.id} href={e.source_url||"#"} target="_blank" rel="noreferrer"><div><strong>{e.title||"Public source"}</strong><p>{e.fact||e.summary||"Supporting evidence"}</p><small>{label(e.source_type)} · {pct(e.confidence)} confidence · {label(e.claim_type||"supporting")}</small></div><ExternalLink size={13}/></a>)}</div>:<p className="signal-muted">No closely matched evidence record is available yet.</p>}</div></div>:null}

        <div className="signal-card-footer"><div className="signal-feedback-group"><span>Quality feedback</span><button className={row.user_feedback==="useful"?"active":""} disabled={busy===row.id} onClick={()=>feedback(row.id,"useful")} title="Useful"><ThumbsUp size={12}/></button><button className={row.user_feedback==="not_useful"?"active":""} disabled={busy===row.id} onClick={()=>feedback(row.id,"not_useful")} title="Not useful"><ThumbsDown size={12}/></button><button className={row.user_feedback==="too_noisy"?"active":""} disabled={busy===row.id} onClick={()=>feedback(row.id,"too_noisy")}>Too noisy</button><button className={row.user_feedback==="wrong_interpretation"?"active":""} disabled={busy===row.id} onClick={()=>feedback(row.id,"wrong_interpretation")}>Wrong interpretation</button><button className={row.user_feedback==="wrong_fact"?"active":""} disabled={busy===row.id} onClick={()=>feedback(row.id,"wrong_fact")}>Wrong fact</button></div><div className="signal-action-group">{row.competitor?.id?<Link className="secondary-button" href={`/companies/${row.competitor.id}`}>Competitor <ArrowUpRight size={12}/></Link>:null}{row.best_source_url?<a className="secondary-button" href={row.best_source_url} target="_blank" rel="noreferrer">Source <ExternalLink size={12}/></a>:null}<button className="secondary-button" onClick={()=>setExpanded(open?"":row.id)}>{open?<ChevronUp size={13}/>:<ChevronDown size={13}/>} {open?"Less":"Evidence"}</button>{row.status==="new"?<button className="primary-button" disabled={busy===row.id} onClick={()=>updateStatus(row.id,"reviewed")}><Check size={13}/>Reviewed</button>:row.status==="reviewed"?<button className="secondary-button" disabled={busy===row.id} onClick={()=>updateStatus(row.id,"new")}><RefreshCcw size={13}/>Return to inbox</button>:null}{row.status!=="archived"?<button className="secondary-button" disabled={busy===row.id} onClick={()=>updateStatus(row.id,"archived")}><Archive size={13}/>Archive</button>:<button className="secondary-button" disabled={busy===row.id} onClick={()=>updateStatus(row.id,"reviewed")}><RefreshCcw size={13}/>Restore</button>}{busy===row.id?<LoaderCircle size={14}/>:null}</div></div>
      </article>})
      :<div className="panel signal-empty"><CircleAlert size={23}/><strong>{rows.length?"No signals match this view.":"No meaningful signals yet."}</strong><span>{rows.length?"Change the filter or search term.":"RADAR will populate this layer when deep scans, source monitoring or live market research detect relevant changes."}</span></div>}</section>
  </div>;
}
