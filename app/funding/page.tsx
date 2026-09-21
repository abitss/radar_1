"use client";

import Link from "next/link";
import { useEffect,useMemo,useState } from "react";
import { Archive,ArrowUpRight,BadgeIndianRupee,CalendarClock,CheckCircle2,ExternalLink,Filter,LoaderCircle,RefreshCcw,Search,Sparkles,Target } from "lucide-react";
import { PageIntro } from "@/components/intelligence-ui";

type PipelineStatus="new"|"saved"|"preparing"|"applied"|"interview"|"awarded"|"rejected"|"ignored";
type Opportunity={
  id:string;name:string;organization:string;type:string;status:string;pipeline_status:PipelineStatus;fit_score:number;fit_reasons:string[];summary:string;
  amount:string|null;equity:string|null;deadline:string|null;deadline_at:string|null;geography:string|null;stage:string|null;sector:string|null;
  eligibility:string[];next_action:string;source_url:string;source_title:string|null;founder_note:string|null;owner:string|null;
  first_seen_at:string;last_seen_at:string;last_verified_at:string|null;updated_at:string;
};

const PIPELINE:PipelineStatus[]=["new","saved","preparing","applied","interview","awarded","rejected","ignored"];
function label(v:any){return String(v||"").replaceAll("_"," ")}
function when(raw?:string|null){if(!raw)return"never";const ms=Math.max(0,Date.now()-new Date(raw).getTime());const m=Math.floor(ms/60000);if(m<1)return"just now";if(m<60)return`${m}m ago`;const h=Math.floor(m/60);if(h<24)return`${h}h ago`;return`${Math.floor(h/24)}d ago`}
function deadlineState(raw?:string|null){
  if(!raw)return{label:"Unverified",tone:"unknown"};
  const d=new Date(raw+"T23:59:59");if(Number.isNaN(d.getTime()))return{label:"Unverified",tone:"unknown"};
  const days=Math.ceil((d.getTime()-Date.now())/86400000);
  if(days<0)return{label:"Deadline passed",tone:"closed"};
  if(days===0)return{label:"Due today",tone:"urgent"};
  if(days<=7)return{label:`${days}d left`,tone:"urgent"};
  if(days<=30)return{label:`${days}d left`,tone:"soon"};
  return{label:`${days}d left`,tone:"open"};
}

export default function FundingPage(){
  const[workspace,setWorkspace]=useState<any>(null),[rows,setRows]=useState<Opportunity[]>([]),[stats,setStats]=useState<any>(null),[scans,setScans]=useState<any[]>([]);
  const[loading,setLoading]=useState(true),[scanning,setScanning]=useState(false),[busy,setBusy]=useState(""),[message,setMessage]=useState(""),[error,setError]=useState("");
  const[type,setType]=useState("all"),[stage,setStage]=useState(""),[geography,setGeography]=useState(""),[goal,setGoal]=useState(""),[includeClosed,setIncludeClosed]=useState(false);
  const[view,setView]=useState<"all"|"high_fit"|"open"|"tracked"|"applied"|"awarded"|"ignored">("all"),[query,setQuery]=useState("");

  async function load(silent=false){
    try{
      const[wRes,fRes]=await Promise.all([fetch("/api/radar/workspace",{cache:"no-store"}),fetch("/api/radar/funding",{cache:"no-store"})]);
      const[w,f]=await Promise.all([wRes.json(),fRes.json()]);
      if(!wRes.ok)throw new Error(w?.error||"Could not load workspace");
      if(!fRes.ok)throw new Error(f?.error||"Could not load funding intelligence");
      setWorkspace(w);setRows(Array.isArray(f?.opportunities)?f.opportunities:[]);setStats(f?.stats||null);setScans(Array.isArray(f?.scans)?f.scans:[]);
      const p=f?.preferences;
      setType(p?.funding_type||"all");setStage(p?.stage||"");setGeography(p?.geography||w?.geography||w?.founder_country||"");
      setGoal(p?.funding_goal||w?.founder_goal||"");setIncludeClosed(Boolean(p?.include_closed));setError("");
      if(!silent&&f?.last_scan?.warning)setMessage(f.last_scan.warning);
    }catch(e){if(!silent)setError(e instanceof Error?e.message:"Could not load funding intelligence")}
    finally{if(!silent)setLoading(false)}
  }
  useEffect(()=>{load();const timer=window.setInterval(()=>load(true),15000);const focus=()=>load(true);window.addEventListener("focus",focus);return()=>{window.clearInterval(timer);window.removeEventListener("focus",focus)}},[]);

  async function scan(){
    if(scanning)return;setScanning(true);setMessage("RADAR is scanning current public funding sources and matching them to this Company Brain...");setError("");
    try{
      const res=await fetch("/api/radar/funding",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type,stage,geography,funding_goal:goal,include_closed:includeClosed})});
      const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data?.error||"Funding scan failed");
      setRows(Array.isArray(data?.opportunities)?data.opportunities:[]);setStats(data?.stats||null);
      setMessage(data?.warning||`${data?.stats?.total??data?.opportunities?.length??0} tracked opportunities in RADAR. Latest scan used ${data?.evidence_count||0} current public sources.`);
      await load(true);
    }catch(e){setMessage(e instanceof Error?e.message:"Funding scan failed")}finally{setScanning(false)}
  }

  async function updateOpportunity(id:string,patch:any){
    if(busy)return;setBusy(id);setMessage("");
    try{
      const r=await fetch("/api/radar/funding",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,...patch})});
      const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Could not update opportunity");
      setRows(prev=>prev.map(x=>x.id===id?{...x,...d}:x));setMessage("Funding pipeline updated.");
      await load(true);
    }catch(e){setMessage(e instanceof Error?e.message:"Could not update opportunity")}finally{setBusy("")}
  }

  const filtered=useMemo(()=>rows.filter(r=>{
    if(type!=="all"&&r.type!==type)return false;
    if(view==="high_fit"&&r.fit_score<80)return false;
    if(view==="open"&&!["open","rolling"].includes(r.status))return false;
    if(view==="tracked"&&!["saved","preparing","applied","interview","awarded"].includes(r.pipeline_status))return false;
    if(view==="applied"&&!["applied","interview"].includes(r.pipeline_status))return false;
    if(view==="awarded"&&r.pipeline_status!=="awarded")return false;
    if(view==="ignored"&&r.pipeline_status!=="ignored")return false;
    if(view!=="ignored"&&r.pipeline_status==="ignored")return false;
    const hay=`${r.name} ${r.organization} ${r.summary} ${r.type} ${r.stage||""} ${r.geography||""} ${r.sector||""} ${r.fit_reasons?.join(" ")||""}`.toLowerCase();
    return hay.includes(query.trim().toLowerCase());
  }).sort((a,b)=>b.fit_score-a.fit_score||new Date(b.last_seen_at).getTime()-new Date(a.last_seen_at).getTime()),[rows,type,view,query]);

  const highFit=stats?.high_fit??rows.filter(r=>r.pipeline_status!=="ignored"&&r.fit_score>=80).length;
  const open=stats?.open??rows.filter(r=>r.pipeline_status!=="ignored"&&["open","rolling"].includes(r.status)).length;
  const tracked=stats?.tracked??rows.filter(r=>["saved","preparing","applied","interview","awarded"].includes(r.pipeline_status)).length;
  const applied=stats?.applied??rows.filter(r=>["applied","interview"].includes(r.pipeline_status)).length;

  if(loading)return <div className="content"><div className="panel founder-panel funding-loading"><LoaderCircle size={16}/> Loading Funding RADAR...</div></div>;

  return <div className="content">
    <PageIntro eyebrow="PERSONALIZED CAPITAL INTELLIGENCE" title="Funding & Grants RADAR" description="Discover current grants, accelerators, challenges, incubators and investors, then move each opportunity through a founder-owned application pipeline instead of losing it after a scan." action={<div className="funding-top-actions"><Link className="secondary-button" href="/brain">Company Brain</Link><button onClick={()=>load()} className="secondary-button"><RefreshCcw size={14}/>Refresh</button><button onClick={scan} disabled={scanning} className="primary-button">{scanning?<LoaderCircle size={14}/>:<Sparkles size={14}/>} {scanning?"Scanning...":"Run live funding scan"}</button></div>}/>

    {error?<div className="competition-live-message radar-error-message" style={{marginBottom:12}}>{error}</div>:null}
    {message?<div className="competition-live-message" style={{marginBottom:12}}>{message}</div>:null}

    <section className="metrics-grid">
      <div className="stat-tile"><span>High fit</span><strong>{highFit}</strong><small>Fit score 80+</small></div>
      <div className="stat-tile"><span>Open / rolling</span><strong>{open}</strong><small>Current windows</small></div>
      <div className="stat-tile"><span>Tracked</span><strong>{tracked}</strong><small>Saved through awarded</small></div>
      <div className="stat-tile"><span>Applied</span><strong>{applied}</strong><small>Submitted or interviewing</small></div>
    </section>

    <section className="panel funding-profile">
      <div className="founder-panel-head"><div><span>FUNDING PROFILE</span><h2>Tell RADAR what capital matters now</h2></div><BadgeIndianRupee size={20}/></div>
      <div className="funding-profile-grid">
        <label><span>Funding type</span><select value={type} onChange={e=>setType(e.target.value)}><option value="all">All funding</option><option value="grant">Grants</option><option value="equity">Equity / VC</option><option value="accelerator">Accelerators</option><option value="challenge">Challenges</option><option value="incubator">Incubators</option><option value="loan">Loans</option></select></label>
        <label><span>Startup stage</span><input value={stage} onChange={e=>setStage(e.target.value)} placeholder="Prototype, pre-seed, seed..."/></label>
        <label><span>Target geography</span><input value={geography} onChange={e=>setGeography(e.target.value)} placeholder="India, global, US..."/></label>
        <label><span>Funding goal</span><input value={goal} onChange={e=>setGoal(e.target.value)} placeholder="₹20L MVP, ₹1Cr seed, non-dilutive R&D..."/></label>
      </div>
      <label className="funding-closed-toggle"><input type="checkbox" checked={includeClosed} onChange={e=>setIncludeClosed(e.target.checked)}/><span>Include clearly closed opportunities in scans for reference</span></label>
      <div className="funding-profile-note">Personalization: <strong>{workspace?.name||"your startup"}</strong> · {workspace?.industry||"industry not set"} · {workspace?.geography||workspace?.founder_country||"geography not set"}. Eligibility is treated as something to verify, never assumed.</div>
    </section>

    <section className="panel funding-toolbar">
      <div className="funding-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search program, organization, sector, stage or fit reason..."/></div>
      <div className="funding-filter-row"><Filter size={13}/>{(["all","high_fit","open","tracked","applied","awarded","ignored"] as const).map(x=><button key={x} className={view===x?"active":""} onClick={()=>setView(x)}>{label(x)}</button>)}</div>
    </section>

    <section className="funding-layout">
      <div className="funding-list">
        {!filtered.length?<div className="panel funding-empty"><Target size={24}/><strong>{rows.length?"No funding opportunities match this view.":"No funding intelligence stored yet."}</strong><span>{rows.length?"Change the filters or search term.":"Run a live funding scan. RADAR will persist matched opportunities so your queue survives page refreshes."}</span></div>:filtered.map(o=>{
          const deadline=deadlineState(o.deadline_at);return <article className={`panel funding-card funding-${o.pipeline_status}`} key={o.id}>
            <div className="funding-card-head"><div><div className="funding-tags"><span>{o.type}</span><span className={`availability-${o.status}`}>{o.status}</span><span className={`pipeline-${o.pipeline_status}`}>{label(o.pipeline_status)}</span>{o.deadline_at?<span className={`deadline-${deadline.tone}`}><CalendarClock size={11}/>{deadline.label}</span>:null}</div><h3>{o.name}</h3><div className="funding-org">{o.organization}</div><p>{o.summary}</p></div><div className="funding-fit"><strong>{Math.round(Number(o.fit_score||0))}</strong><span>FIT</span></div></div>

            <div className="funding-meta-grid"><Meta label="Amount" value={o.amount||"Not verified"}/><Meta label="Deadline" value={o.deadline||"Not verified"}/><Meta label="Stage" value={o.stage||"Not verified"}/><Meta label="Geography" value={o.geography||"Not verified"}/></div>

            {o.fit_reasons?.length?<div className="funding-block"><span>WHY RADAR MATCHED IT</span><div className="funding-reasons">{o.fit_reasons.map(r=><em key={r}>{r}</em>)}</div></div>:null}
            {o.eligibility?.length?<div className="funding-block"><span>ELIGIBILITY TO VERIFY</span><p>{o.eligibility.join(" · ")}</p></div>:null}

            <div className="funding-next"><span>NEXT ACTION</span><strong>{o.next_action||"Review the official source and verify current eligibility before applying."}</strong></div>

            <div className="funding-pipeline-row">
              <label><span>Pipeline</span><select value={o.pipeline_status} disabled={busy===o.id} onChange={e=>updateOpportunity(o.id,{pipeline_status:e.target.value})}>{PIPELINE.map(x=><option key={x} value={x}>{label(x)}</option>)}</select></label>
              <label><span>Owner</span><input defaultValue={o.owner||""} placeholder="Founder / team member" onBlur={e=>{if(e.target.value!==(o.owner||""))updateOpportunity(o.id,{owner:e.target.value})}}/></label>
            </div>
            <label className="funding-note"><span>Founder note</span><textarea defaultValue={o.founder_note||""} placeholder="Application angle, missing documents, intro path, follow-up..." onBlur={e=>{if(e.target.value!==(o.founder_note||""))updateOpportunity(o.id,{founder_note:e.target.value})}}/></label>

            <div className="funding-card-footer"><div><small>First seen {when(o.first_seen_at)} · verified {when(o.last_verified_at)} · last seen {when(o.last_seen_at)}</small>{busy===o.id?<LoaderCircle size={13}/>:null}</div><div><a href={o.source_url} target="_blank" rel="noreferrer" className="secondary-button">Official/source page <ExternalLink size={13}/></a>{o.pipeline_status==="awarded"?<span className="funding-awarded"><CheckCircle2 size={13}/>Awarded</span>:null}</div></div>
          </article>
        })}
      </div>

      <aside className="panel funding-sidebar">
        <div className="founder-panel-head"><div><span>SCAN HISTORY</span><h2>Funding intelligence runs</h2></div><RefreshCcw size={18}/></div>
        <div className="funding-scan-list">{scans.length?scans.slice(0,8).map(s=><div key={s.id}><strong>{s.status}</strong><span>{new Date(s.started_at).toLocaleString()}</span><small>{s.opportunity_count||0} matched · {s.evidence_count||0} sources</small>{s.warning?<em>{s.warning}</em>:s.error?<em>{s.error}</em>:null}</div>):<p>No funding scans yet.</p>}</div>
        <div className="funding-sidebar-note"><Archive size={15}/><span>RADAR preserves your funding pipeline between scans. New scans refresh facts and fit, while founder-owned statuses, notes and owners remain intact.</span></div>
      </aside>
    </section>
  </div>;
}

function Meta({label,value}:{label:string;value:string}){return <div><span>{label}</span><strong>{value}</strong></div>}
