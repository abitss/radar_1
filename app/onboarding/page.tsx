"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Globe2, LoaderCircle, Radar, Search, ShieldCheck, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

type Step = { label:string; detail:string; status:"idle"|"working"|"done"|"error" };

const baseSteps: Step[] = [
  { label:"Understand startup", detail:"Reading first-party public website and building Company Brain", status:"idle" },
  { label:"Discover market", detail:"Searching the public web across product, problem, buyer, feature and technology dimensions", status:"idle" },
  { label:"Build competitive universe", detail:"Promoting relevant direct, adjacent, micro and emerging competitors", status:"idle" },
  { label:"Deep scan", detail:"Collecting public evidence from product, pricing, careers, docs and customer pages", status:"idle" },
  { label:"Activate continuous RADAR", detail:"Keeping web-wide discovery running automatically in the background", status:"idle" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [website,setWebsite] = useState("");
  const [steps,setSteps] = useState<Step[]>(baseSteps);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const [existing,setExisting] = useState<any>(null);

  useEffect(()=>{ fetch("/api/radar/workspace",{cache:"no-store"}).then(r=>r.json()).then(data=>{ if(data?.website){setExisting(data);setWebsite(data.website)} }); },[]);
  function mark(index:number,status:Step["status"],detail?:string){ setSteps(prev=>prev.map((s,i)=>i===index?{...s,status,detail:detail||s.detail}:s)); }

  async function run(e: FormEvent){
    e.preventDefault(); if(!website.trim()||busy) return;
    setBusy(true); setMessage(""); setSteps(baseSteps);
    try{
      mark(0,"working");
      let res = await fetch("/api/radar/bootstrap",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({website})});
      let data = await res.json(); if(!res.ok) throw new Error(data.error||"Could not understand startup website");
      mark(0,"done",`Company Brain built for ${data.workspace?.name||"your startup"}`);

      mark(1,"working");
      res = await fetch("/api/radar/discover",{method:"POST"}); data = await res.json(); if(!res.ok) throw new Error(data.error||"Discovery failed");
      mark(1,"done",`${data.inspected||0} public results inspected across ${data.queries_generated||0} discovery paths`);
      mark(2,"done",`${data.promoted||0} relevant competitors promoted into your RADAR`);

      mark(3,"working");
      const competitors = await fetch("/api/radar/competitors",{cache:"no-store"}).then(r=>r.json());
      const top = Array.isArray(competitors) ? competitors.slice(0,3) : [];
      let scanned = 0;
      for(const competitor of top){
        const scan = await fetch("/api/radar/scan",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({competitorId:competitor.id})});
        if(scan.ok) scanned++;
      }
      mark(3,"done",`${scanned} highest-priority competitors deep-scanned with evidence`);

      mark(4,"working");
      res = await fetch("/api/radar/continuous",{method:"POST"}); data = await res.json(); if(!res.ok) throw new Error(data.error||"Could not activate continuous monitoring");
      mark(4,"done",data.alreadyActive?"Continuous competitive discovery was already active":"Continuous competitive discovery is active every 6 hours");
      setMessage("RADAR is live. Your competitive universe will keep changing as new evidence arrives.");
      setTimeout(()=>router.replace("/market"),900);
    }catch(err){
      const text = err instanceof Error?err.message:"Setup failed"; setMessage(text);
      setSteps(prev=>prev.map(s=>s.status==="working"?{...s,status:"error"}:s));
    }finally{setBusy(false)}
  }

  return <div className="content onboarding-page"><div className="onboarding-shell">
    <div className="onboarding-head">
      <div className="onboarding-radar"><Radar size={30}/><span className="scan-line"/></div>
      <span className="tiny-label">ONE-URL BOOTSTRAP</span>
      <h1>Give RADAR your startup. We’ll map the world around it.</h1>
      <p>RADAR understands your company, discovers competitors you may not know, deep-scans the strongest matches and activates continuous public-web surveillance.</p>
    </div>

    <form onSubmit={run} className="panel" style={{maxWidth:860,margin:"0 auto 18px",padding:20}}>
      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
        <Globe2 size={18}/><input value={website} onChange={e=>setWebsite(e.target.value)} placeholder="yourstartup.com" required disabled={busy} style={{flex:1,minWidth:240,height:46,border:"1px solid #d8dcdf",borderRadius:10,padding:"0 14px",fontSize:14}}/>
        <button disabled={busy} className="primary-button" style={{height:46}}>{busy?<><LoaderCircle size={15}/>Building RADAR...</>:<><Sparkles size={15}/>{existing?.website?"Rebuild RADAR":"Build my RADAR"}</>}</button>
      </div>
      <div style={{marginTop:10,fontSize:12,color:"#72787d"}}>Only public/indexable information is scanned. RADAR keeps source evidence attached to important findings.</div>
    </form>

    <div className="onboarding-progress-card panel">
      <div className="onboarding-steps">{steps.map((step,i)=><div className="onboarding-step" key={step.label}>
        <div className={`onboarding-icon ${step.status==="done"?"done":step.status==="working"?"working":""}`}>{step.status==="done"?<CheckCircle2 size={18}/>:step.status==="working"?<LoaderCircle size={18}/>:step.status==="error"?<ShieldCheck size={18}/>:i===1?<Search size={18}/>:<Radar size={18}/>}</div>
        <div className="onboarding-copy"><strong>{step.label}</strong><span>{step.detail}</span></div>
        <em>{step.status==="working"?"Working":step.status==="done"?"Done":step.status==="error"?"Retry":"Waiting"}</em>
      </div>)}</div>
    </div>

    {message?<div className="panel" style={{maxWidth:860,margin:"14px auto 0",padding:15,display:"flex",alignItems:"center",gap:10}}><ShieldCheck size={17}/><span style={{fontSize:13}}>{message}</span>{message.startsWith("RADAR is live")?<button onClick={()=>router.replace("/market")} className="secondary-button" style={{marginLeft:"auto"}}>Open RADAR <ArrowRight size={14}/></button>:null}</div>:null}
  </div></div>;
}
