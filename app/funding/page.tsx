"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, BadgeIndianRupee, ExternalLink, LoaderCircle, RefreshCcw, Sparkles } from "lucide-react";
import { PageIntro } from "@/components/intelligence-ui";

type Opportunity={
  name:string;organization:string;type:string;status:string;fit_score:number;fit_reasons:string[];summary:string;amount:string|null;equity:string|null;deadline:string|null;geography:string|null;stage:string|null;sector:string|null;eligibility:string[];next_action:string;source_url:string;source_title:string;
};

export default function FundingPage(){
  const [workspace,setWorkspace]=useState<any>(null);
  const [rows,setRows]=useState<Opportunity[]>([]);
  const [stats,setStats]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  const [scanning,setScanning]=useState(false);
  const [message,setMessage]=useState("");
  const [type,setType]=useState("all");
  const [stage,setStage]=useState("");
  const [geography,setGeography]=useState("");
  const [goal,setGoal]=useState("");

  useEffect(()=>{
    let alive=true;
    Promise.all([
      fetch("/api/radar/workspace",{cache:"no-store"}).then(r=>r.json()),
      fetch("/api/radar/funding",{cache:"no-store"}).then(r=>r.json()),
    ]).then(([w,f])=>{
      if(!alive)return;
      setWorkspace(w);
      setGeography(w?.geography||w?.founder_country||"");
      setGoal(w?.founder_goal||"");
      if(f?.company_brain?.ready)setMessage("Company Brain ready. Run a live funding scan to find opportunities matched to this startup.");
      setLoading(false);
    }).catch(()=>{if(alive)setLoading(false)});
    return()=>{alive=false};
  },[]);

  async function scan(){
    setScanning(true);setMessage("RADAR is scanning current public funding sources and matching them to your Company Brain...");
    try{
      const res=await fetch("/api/radar/funding",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type,stage,geography,funding_goal:goal})});
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(data?.error||"Funding scan failed");
      setRows(Array.isArray(data?.opportunities)?data.opportunities:[]);
      setStats(data?.stats||null);
      setMessage(`${data?.opportunities?.length||0} personalized opportunities found from ${data?.evidence_count||0} current public sources.`);
    }catch(error){setMessage(error instanceof Error?error.message:"Funding scan failed")}finally{setScanning(false)}
  }

  const filtered=useMemo(()=>type==="all"?rows:rows.filter(r=>r.type===type),[rows,type]);
  const highFit=stats?.high_fit??filtered.filter(r=>r.fit_score>=80).length;
  const open=stats?.open??filtered.filter(r=>["open","rolling"].includes(r.status)).length;
  const grants=stats?.grants??filtered.filter(r=>r.type==="grant").length;

  if(loading)return <div className="content"><div className="panel founder-panel" style={{padding:26,color:"#747b81"}}><LoaderCircle size={16}/> Loading Funding RADAR...</div></div>;

  return <div className="content">
    <PageIntro eyebrow="PERSONALIZED CAPITAL INTELLIGENCE" title="Funding & Grants RADAR" description="Find grants, accelerators, challenges, incubators and equity funding matched to your Company Brain, stage, geography, technology and founder goal." action={<button onClick={scan} disabled={scanning} className="primary-button">{scanning?<LoaderCircle size={14}/>:<RefreshCcw size={14}/>} {scanning?"Scanning...":"Run live funding scan"}</button>}/>

    <section className="panel founder-panel" style={{marginBottom:14}}>
      <div className="founder-panel-head"><div><span>FUNDING PROFILE</span><h2>Tell RADAR what capital matters now</h2></div><Sparkles size={20}/></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:12,marginTop:14}}>
        <label style={label}><span>Funding type</span><select value={type} onChange={e=>setType(e.target.value)} style={input}><option value="all">All funding</option><option value="grant">Grants</option><option value="equity">Equity / VC</option><option value="accelerator">Accelerators</option><option value="challenge">Challenges</option><option value="incubator">Incubators</option><option value="loan">Loans</option></select></label>
        <label style={label}><span>Startup stage</span><input value={stage} onChange={e=>setStage(e.target.value)} placeholder="Idea, prototype, pre-seed, seed..." style={input}/></label>
        <label style={label}><span>Target geography</span><input value={geography} onChange={e=>setGeography(e.target.value)} placeholder="India, global, US..." style={input}/></label>
        <label style={label}><span>Current funding goal</span><input value={goal} onChange={e=>setGoal(e.target.value)} placeholder="₹20L MVP, ₹1Cr seed, non-dilutive R&D..." style={input}/></label>
      </div>
      <div style={{marginTop:12,fontSize:12,color:"#70777d"}}>Personalization source: <strong>{workspace?.name||"your startup"}</strong> · {workspace?.industry||"industry not set"} · {workspace?.geography||workspace?.founder_country||"geography not set"}. RADAR treats eligibility as something to verify, not assume.</div>
    </section>

    {message?<div className="competition-live-message" style={{marginBottom:12}}>{message}</div>:null}

    <section className="metrics-grid">
      <div className="stat-tile"><span>Matched</span><strong>{filtered.length}</strong><small>Personalized opportunities</small></div>
      <div className="stat-tile"><span>High fit</span><strong>{highFit}</strong><small>Fit score 80+</small></div>
      <div className="stat-tile"><span>Open / rolling</span><strong>{open}</strong><small>Current windows</small></div>
      <div className="stat-tile"><span>Grants</span><strong>{grants}</strong><small>Non-dilutive matches</small></div>
    </section>

    <section className="panel founder-panel">
      <div className="founder-panel-head"><div><span>OPPORTUNITY QUEUE</span><h2>Ranked for this startup</h2></div><BadgeIndianRupee size={20}/></div>
      {!filtered.length?<div style={{padding:"28px 0",color:"#737a80"}}>Run a live funding scan. RADAR will search current public sources, verify opportunity details where possible and rank them against your Company Brain.</div>:<div style={{display:"grid",gap:12,marginTop:14}}>{filtered.map((o,index)=><article key={`${o.name}-${o.organization}-${index}`} style={{padding:16,border:"1px solid #e0e4e6",borderRadius:13,background:"#fff"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:16,alignItems:"flex-start"}}>
          <div style={{minWidth:0}}><div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap",marginBottom:6}}><span style={chip}>{o.type}</span><span style={statusChip(o.status)}>{o.status}</span><span style={{fontSize:11,color:"#737a80"}}>{o.organization}</span></div><h3 style={{fontSize:16,margin:"0 0 6px",color:"#202529"}}>{o.name}</h3><p style={{margin:0,fontSize:13,lineHeight:1.55,color:"#5a6166"}}>{o.summary}</p></div>
          <div style={{width:72,height:72,border:"1px solid #d9dddf",borderRadius:16,display:"grid",placeItems:"center",flex:"0 0 auto",background:"#f8f9f9"}}><div style={{textAlign:"center"}}><strong style={{display:"block",fontSize:22,color:"#202529"}}>{o.fit_score}</strong><span style={{fontSize:9,letterSpacing:".08em",color:"#7d8489"}}>FIT</span></div></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:8,marginTop:14}}><Meta label="Amount" value={o.amount||"Not verified"}/><Meta label="Deadline" value={o.deadline||"Not verified"}/><Meta label="Stage" value={o.stage||"Not verified"}/><Meta label="Geography" value={o.geography||"Not verified"}/></div>
        {o.fit_reasons?.length?<div style={{marginTop:14}}><div style={tiny}>WHY RADAR MATCHED IT</div><div style={{display:"flex",gap:7,flexWrap:"wrap",marginTop:7}}>{o.fit_reasons.map(reason=><span key={reason} style={{fontSize:11,padding:"6px 8px",border:"1px solid #dfe3e5",borderRadius:999,color:"#545b60",background:"#fafafa"}}>{reason}</span>)}</div></div>:null}
        {o.eligibility?.length?<div style={{marginTop:13}}><div style={tiny}>ELIGIBILITY TO VERIFY</div><div style={{fontSize:12,color:"#62696e",lineHeight:1.55,marginTop:5}}>{o.eligibility.join(" · ")}</div></div>:null}
        <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",marginTop:14,paddingTop:12,borderTop:"1px solid #eceeef"}}><div style={{fontSize:12,color:"#454c51"}}><strong>Next:</strong> {o.next_action}</div><a href={o.source_url} target="_blank" rel="noreferrer" className="secondary-button" style={{textDecoration:"none",whiteSpace:"nowrap"}}>Official/source page <ExternalLink size={13}/></a></div>
      </article>)}</div>}
    </section>
  </div>;
}

function Meta({label,value}:{label:string;value:string}){return <div style={{padding:"9px 10px",border:"1px solid #e5e8ea",borderRadius:9,background:"#fafbfb",minWidth:0}}><span style={{display:"block",fontSize:9,letterSpacing:".08em",color:"#8a9095",textTransform:"uppercase",marginBottom:4}}>{label}</span><strong style={{display:"block",fontSize:11,color:"#4b5257",overflow:"hidden",textOverflow:"ellipsis"}}>{value}</strong></div>}
const label:React.CSSProperties={display:"grid",gap:6,fontSize:11,color:"#62696e"};
const input:React.CSSProperties={height:40,border:"1px solid #d8dcdf",borderRadius:9,padding:"0 10px",fontSize:12,background:"white",color:"#272c30",width:"100%"};
const chip:React.CSSProperties={fontSize:9,textTransform:"uppercase",letterSpacing:".08em",padding:"4px 6px",border:"1px solid #d8dcdf",borderRadius:999,color:"#596066"};
const tiny:React.CSSProperties={fontSize:9,letterSpacing:".1em",color:"#8a9095"};
function statusChip(status:string):React.CSSProperties{return{fontSize:9,textTransform:"uppercase",letterSpacing:".08em",padding:"4px 6px",borderRadius:999,border:"1px solid #d8dcdf",color:["open","rolling"].includes(status)?"#255c3c":"#6b7074",background:["open","rolling"].includes(status)?"#f1f7f3":"#f7f8f8"}}
