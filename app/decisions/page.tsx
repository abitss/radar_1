"use client";

import Link from "next/link";
import { useEffect,useMemo,useState } from "react";
import { ArrowUpRight,Check,CircleAlert,Clock3,Filter,LoaderCircle,Plus,RefreshCcw,Search,Target,X } from "lucide-react";
import { PageIntro } from "@/components/intelligence-ui";
import "./decisions.css";

type FilterKey="all"|"open"|"decided"|"dismissed";
function pct(v:any){return `${Math.round(Number(v||0))}%`}
function when(raw?:string|null){if(!raw)return"never";const ms=Math.max(0,Date.now()-new Date(raw).getTime());const min=Math.floor(ms/60000);if(min<1)return"just now";if(min<60)return`${min}m ago`;const h=Math.floor(min/60);if(h<24)return`${h}h ago`;return`${Math.floor(h/24)}d ago`}

export default function DecisionsPage(){
  const[rows,setRows]=useState<any[]>([]),[moves,setMoves]=useState<any[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(""),[message,setMessage]=useState(""),[error,setError]=useState("");
  const[filter,setFilter]=useState<FilterKey>("all"),[query,setQuery]=useState("");
  const[founderQuestion,setFounderQuestion]=useState("");

  async function load(silent=false){
    try{
      const[dRes,mRes]=await Promise.all([fetch("/api/radar/decisions",{cache:"no-store"}),fetch("/api/radar/moves",{cache:"no-store"})]);
      const[d,m]=await Promise.all([dRes.json(),mRes.json()]);
      if(!dRes.ok)throw new Error(d.error||"Could not load decisions");
      if(!mRes.ok)throw new Error(m.error||"Could not load strategic moves");
      setRows(Array.isArray(d)?d:[]);setMoves(Array.isArray(m)?m:[]);setError("");
    }catch(e){if(!silent)setError(e instanceof Error?e.message:"Could not load decisions")}finally{if(!silent)setLoading(false)}
  }
  useEffect(()=>{load();const timer=window.setInterval(()=>load(true),10000);const focus=()=>load(true);window.addEventListener("focus",focus);return()=>{window.clearInterval(timer);window.removeEventListener("focus",focus)}},[]);

  async function update(id:string,status:string,decision?:string){
    if(busy)return;setBusy(id);setMessage("");
    try{
      const r=await fetch("/api/radar/decisions",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,status,decision})});
      const d=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(d.error||"Could not update decision");
      if(status==="decided")setMessage(`Decision committed${decision?`: ${decision}`:""}. A draft Action has been created with a review deadline.`);
      else if(status==="dismissed")setMessage("Decision dismissed. The evidence remains in RADAR's audit trail.");
      else setMessage("Decision reopened for review.");
      await load(true);
    }catch(e){setMessage(e instanceof Error?e.message:"Could not update decision")}finally{setBusy("")}
  }

  async function createManual(){
    const question=founderQuestion.trim();
    if(!question||busy)return;
    setBusy("manual");setMessage("Building a founder decision memo from your question...");
    try{
      const r=await fetch("/api/radar/decisions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question})});
      const d=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(d.error||"Could not create decision");
      setFounderQuestion("");
      setMessage("Founder decision memo created.");
      await load(true);setFilter("open");
    }catch(e){setMessage(e instanceof Error?e.message:"Could not create decision")}finally{setBusy("")}
  }

  async function createFromSignal(signalId:string){
    if(busy)return;setBusy(`signal:${signalId}`);setMessage("Building a decision memo from this signal...");
    try{
      const r=await fetch("/api/radar/decisions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({signalId})});
      const d=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(d.error||"Could not create decision");
      setMessage(d.existing?"An active decision already exists for this Signal.":"Decision memo created from the Signal.");
      await load(true);setFilter("open");
    }catch(e){setMessage(e instanceof Error?e.message:"Could not create decision")}finally{setBusy("")}
  }

  async function createFromMove(moveId:string){
    if(busy)return;setBusy(`move:${moveId}`);setMessage("Building an evidence-backed decision memo...");
    try{
      const r=await fetch("/api/radar/decisions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({moveId})});
      const d=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(d.error||"Could not create decision");
      setMessage(d.existing?"An active decision already exists for this Move.":"Decision memo created from the strategic Move.");
      await load(true);
      setFilter("open");
    }catch(e){setMessage(e instanceof Error?e.message:"Could not create decision")}finally{setBusy("")}
  }

  const decisionMoveIds=useMemo(()=>new Set(rows.filter(r=>r.status!=="dismissed").map(r=>String(r.move_id||"")).filter(Boolean)),[rows]);
  const decisionSignalIds=useMemo(()=>new Set(rows.filter(r=>r.status!=="dismissed").map(r=>String(r.source_signal_id||"")).filter(Boolean)),[rows]);
  const availableMoves=useMemo(()=>moves.filter(m=>["watching","confirmed"].includes(m.status)&&!decisionMoveIds.has(String(m.id))),[moves,decisionMoveIds]);
  const availableSignals=useMemo(()=>rows.length||moves.length?[]:[],[rows,moves]);
  const stats=useMemo(()=>({
    open:rows.filter(r=>r.status==="open").length,
    high:rows.filter(r=>Number(r.move?.impact_score||0)>=75&&r.status==="open").length,
    decided:rows.filter(r=>r.status==="decided").length,
    outcomes:rows.reduce((a,r)=>a+Number(r.outcome_count||0),0),
  }),[rows]);
  const filtered=useMemo(()=>rows.filter(r=>{
    if(filter!=="all"&&r.status!==filter)return false;
    const hay=`${r.title||""} ${r.question||""} ${r.context||""} ${r.competitor?.name||""} ${r.move?.title||""} ${r.decided_option||""}`.toLowerCase();
    return hay.includes(query.trim().toLowerCase());
  }),[rows,filter,query]);

  return <div className="content">
    <PageIntro eyebrow="DECISION INTELLIGENCE" title="Decisions" description="RADAR converts evidence-backed strategic Moves into practical founder choices, then preserves the handoff into Action and Outcome so the reasoning never evaporates after the meeting." action={<div className="decision-top-actions"><Link className="secondary-button" href="/moves">View RADAR Moves</Link><Link className="secondary-button" href="/actions">Open Actions</Link><button className="primary-button" onClick={()=>load()} disabled={loading}><RefreshCcw size={14}/>Refresh</button></div>}/>
    {error?<div className="competition-live-message radar-error-message" style={{marginBottom:12}}>{error}</div>:null}
    {message?<div className="competition-live-message" style={{marginBottom:12}}>{message}</div>:null}

    <section className="panel decision-inbox">
      <div className="decision-inbox-head"><div><span>FOUNDER DECISION</span><h2>Ask RADAR a decision question directly</h2><p>You no longer need to wait for a multi-signal Move. RADAR can create a decision memo from your question, while still using evidence-backed Moves when they exist.</p></div><Plus size={20}/></div>
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
        <input value={founderQuestion} onChange={e=>setFounderQuestion(e.target.value)} placeholder="e.g. Should we prioritize schools or parents for the next 90 days?" style={{flex:"1 1 420px",minHeight:40,border:"1px solid #dfe3e6",borderRadius:9,padding:"0 11px",font:"inherit",fontSize:10}}/>
        <button className="primary-button" disabled={busy==="manual"||!founderQuestion.trim()} onClick={createManual}>{busy==="manual"?<LoaderCircle size={14}/>:<Plus size={14}/>}Create decision</button>
      </div>
    </section>

    <section className="metrics-grid"><div className="stat-tile"><span>Open</span><strong>{stats.open}</strong><small>Needs founder review</small></div><div className="stat-tile"><span>High impact</span><strong>{stats.high}</strong><small>Move impact ≥75</small></div><div className="stat-tile"><span>Decided</span><strong>{stats.decided}</strong><small>Response selected</small></div><div className="stat-tile"><span>Outcomes</span><strong>{stats.outcomes}</strong><small>Learning loop closed</small></div></section>

    {availableMoves.length?<section className="panel decision-inbox"><div className="decision-inbox-head"><div><span>DECISION INBOX</span><h2>{availableMoves.length} strategic Move{availableMoves.length===1?"":"s"} ready for founder review</h2><p>These Moves have enough evidence to become a decision memo but do not yet have an active Decision.</p></div><Target size={20}/></div><div className="decision-move-grid">{availableMoves.slice(0,6).map(m=><div key={m.id} className="decision-move-row"><div><strong>{m.title}</strong><span>{m.competitor?.name||"Market move"} · {pct(m.impact_score)} impact · {pct(m.confidence)} confidence · {m.signal_count||0} signals</span></div><button className="secondary-button" disabled={busy===`move:${m.id}`} onClick={()=>createFromMove(m.id)}>{busy===`move:${m.id}`?<LoaderCircle size={13}/>:<Target size={13}/>}Create decision</button></div>)}</div></section>:null}

    <section className="panel decision-toolbar"><div className="decision-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search decision, competitor, move or chosen response..."/></div><div className="decision-filter-row"><Filter size={13}/>{(["all","open","decided","dismissed"] as FilterKey[]).map(x=><button key={x} onClick={()=>setFilter(x)} className={filter===x?"active":""}>{x}</button>)}</div></section>

    <div className="decision-stack">{loading?<div className="panel" style={{padding:24}}>Loading decisions...</div>:filtered.length?filtered.map(r=>{
      const opts=Array.isArray(r.options)?r.options:[];const rec=r.recommendation||{};const selected=r.selected_option||opts.find((o:any)=>o.label===r.decided_option)||null;const assumptions=Array.isArray(rec.assumptions)?rec.assumptions:[];const changeEvidence=Array.isArray(rec.evidence_that_changes_this)?rec.evidence_that_changes_this:[];
      return <article className={`panel decision-card decision-card-${r.status}`} key={r.id}><div className="decision-icon"><CircleAlert size={18}/></div><div className="decision-body"><div className="decision-head"><div><div className="decision-status-row"><span className={`decision-urgency ${Number(r.move?.impact_score||0)>=75?"high":"medium"}`}>{r.status}</span>{r.move?.status?<span className="decision-meta-chip">Move: {r.move.status}</span>:null}{r.action?<span className="decision-meta-chip">Action: {r.action.status}</span>:null}</div><h3>{r.title}</h3><p className="decision-question">{r.question}</p><p>{r.context}</p></div><div className="decision-confidence">{r.competitor?.name?<strong>{r.competitor.name}</strong>:null}<span>{Math.round(Number(r.confidence||0))}% decision confidence</span>{r.move?<span>{Math.round(Number(r.move.impact_score||0))}% move impact · {r.move.signal_count||0} signals</span>:null}<span>Updated {when(r.updated_at)}</span></div></div>

      <div className="decision-recommendation"><span>RADAR RECOMMENDATION</span><strong>{rec.summary||"Review the evidence before acting."}</strong>{rec.expected_outcome?<small>Expected outcome: {rec.expected_outcome}</small>:null}</div>

      {assumptions.length||changeEvidence.length?<div className="decision-evidence-logic"><div><span>ASSUMPTIONS</span>{assumptions.length?assumptions.map((x:any,i:number)=><p key={i}>{x}</p>):<p>None explicitly stated.</p>}</div><div><span>WHAT WOULD CHANGE THIS VIEW</span>{changeEvidence.length?changeEvidence.map((x:any,i:number)=><p key={i}>{x}</p>):<p>No explicit reversal evidence listed.</p>}</div></div>:null}

      {r.status==="decided"&&selected?<div className="decision-selected"><span>CHOSEN RESPONSE</span><strong>{selected.label}</strong><p>{selected.action}</p>{r.action?<div className="decision-execution-link"><Clock3 size={13}/><span>{r.action.status} · review {r.action.due_at?new Date(r.action.due_at).toLocaleDateString():"not scheduled"}</span><Link href="/actions">Open action <ArrowUpRight size={12}/></Link></div>:null}</div>:null}

      {opts.length&&r.status==="open"?<div className="decision-option-grid">{opts.map((o:any)=><div key={o.label} className="decision-option"><strong>{o.label}</strong><span>{o.action}</span>{o.upside?<small><b>Upside:</b> {o.upside}</small>:null}{o.downside?<small><b>Trade-off:</b> {o.downside}</small>:null}{o.when_to_choose?<small><b>Choose when:</b> {o.when_to_choose}</small>:null}<button className="secondary-button" disabled={busy===r.id} onClick={()=>update(r.id,"decided",o.label)}><Check size={13}/>Choose {o.label}</button></div>)}</div>:null}

      <div className="decision-footer"><div>{r.outcome_count?<Link className="decision-outcome-link" href={`/outcomes?decision=${r.id}`}>{r.outcome_count} outcome{r.outcome_count===1?"":"s"} recorded <ArrowUpRight size={12}/></Link>:r.status==="decided"?<span>No outcome recorded yet</span>:null}</div><div>{r.status==="open"?<button className="secondary-button" disabled={busy===r.id} onClick={()=>update(r.id,"dismissed")}><X size={13}/>Dismiss</button>:null}{r.status==="dismissed"?<button className="secondary-button" disabled={busy===r.id} onClick={()=>update(r.id,"open")}><RefreshCcw size={13}/>Reopen</button>:null}{r.status==="decided"&&r.action?.status==="draft"?<button className="secondary-button" disabled={busy===r.id} onClick={()=>update(r.id,"open")}><RefreshCcw size={13}/>Reconsider</button>:null}{busy===r.id?<LoaderCircle size={15}/>:null}{r.status==="decided"?<Link className="primary-button" href="/actions">Open Actions</Link>:null}</div></div></div></article>})
      :<div className="panel decision-empty"><Target size={24}/><strong>{rows.length?"No decisions match this view.":"No Decisions yet."}</strong><span>{rows.length?"Change the filter or search term.":"Create a founder decision directly above, or let RADAR generate evidence-backed decisions from strategic Moves as they emerge."}</span>{!rows.length?<Link className="secondary-button" href="/moves">Open RADAR Moves</Link>:null}</div>}</div>
  </div>
}
