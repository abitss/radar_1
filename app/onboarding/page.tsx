"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Globe2, LoaderCircle, Radar, Search, ShieldCheck, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

type Step = { label:string; detail:string; status:"idle"|"working"|"done"|"error" };

const baseSteps: Step[] = [
  { label:"Save startup", detail:"Saving your startup URL to your private workspace first", status:"idle" },
  { label:"Understand startup", detail:"Reading first-party public website and building Company Brain", status:"idle" },
  { label:"Discover market", detail:"Searching the public web across product, problem, buyer, feature and technology dimensions", status:"idle" },
  { label:"Build competitive universe", detail:"Promoting relevant direct, adjacent, micro and emerging competitors", status:"idle" },
  { label:"Deep scan + continuous RADAR", detail:"Deep-scanning priority competitors while continuous monitoring is activated", status:"idle" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [website,setWebsite] = useState("");
  const [steps,setSteps] = useState<Step[]>(baseSteps);
  const [busy,setBusy] = useState(false);
  const [loadingWorkspace,setLoadingWorkspace] = useState(true);
  const [message,setMessage] = useState("");
  const [existing,setExisting] = useState<any>(null);

  useEffect(()=>{
    let alive = true;
    Promise.all([
      fetch("/api/radar/workspace",{cache:"no-store"}).then(async r=>({ok:r.ok,data:await r.json()})),
      fetch("/api/radar/overview",{cache:"no-store"}).then(async r=>({ok:r.ok,data:await r.json()})).catch(()=>({ok:false,data:null})),
    ]).then(([workspaceResult,overviewResult])=>{
      if(!alive) return;
      if(!workspaceResult.ok){
        setLoadingWorkspace(false);
        return;
      }
      const workspace = workspaceResult.data;
      setExisting(workspace);
      if(workspace?.website) setWebsite(workspace.website);

      const overview = overviewResult.ok ? overviewResult.data : null;
      const setupComplete = Boolean(
        workspace?.website &&
        (overview?.monitor || Number(overview?.metrics?.competitors || 0) > 0)
      );

      if(setupComplete){
        router.replace("/");
        return;
      }

      if(workspace?.website){
        setMessage("Your startup URL is saved. Continue setup from where you left off.");
      }
      setLoadingWorkspace(false);
    }).catch(()=>{ if(alive) setLoadingWorkspace(false); });
    return ()=>{alive=false};
  },[router]);

  function mark(index:number,status:Step["status"],detail?:string){ setSteps(prev=>prev.map((s,i)=>i===index?{...s,status,detail:detail||s.detail}:s)); }

  async function run(e: FormEvent){
    e.preventDefault(); if(!website.trim()||busy) return;
    setBusy(true); setMessage(""); setSteps(baseSteps);
    try{
      mark(0,"working");
      let res = await fetch("/api/radar/workspace",{
        method:"PATCH",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ website: website.trim() })
      });
      let data = await res.json();
      if(!res.ok) throw new Error(data.error||"Could not save startup URL");
      setExisting(data);
      mark(0,"done","Startup URL saved. You can safely leave and return without losing setup.");

      mark(1,"working");
      res = await fetch("/api/radar/bootstrap",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({website})});
      data = await res.json(); if(!res.ok) throw new Error(data.error||"Could not understand startup website");
      setExisting(data.workspace);
      mark(1,"done",`Company Brain built for ${data.workspace?.name||"your startup"}`);

      mark(2,"working");
      res = await fetch("/api/radar/discover",{method:"POST"}); data = await res.json();
      if(!res.ok && !data?.cooldown) throw new Error(data.error||"Discovery failed");
      if(data?.cooldown){
        mark(2,"done","Recent discovery results already exist, so RADAR reused them.");
        mark(3,"done","Existing competitive universe restored from your workspace.");
      } else {
        mark(2,"done",`${data.inspected||0} public results inspected across ${data.queries_generated||0} discovery paths`);
        mark(3,"done",`${data.promoted||0} relevant competitors promoted into your RADAR`);
      }

      mark(4,"working");
      const competitorsRes = await fetch("/api/radar/competitors",{cache:"no-store"});
      const competitors = competitorsRes.ok ? await competitorsRes.json() : [];
      const top = Array.isArray(competitors) ? competitors.slice(0,3) : [];

      const scanPromise = Promise.all(top.map(async competitor=>{
        try {
          const scan = await fetch("/api/radar/scan",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({competitorId:competitor.id})});
          if(scan.ok) return true;
          const scanData = await scan.json().catch(()=>({}));
          return Boolean(scanData?.cooldown);
        } catch { return false; }
      }));
      const monitorPromise = fetch("/api/radar/continuous",{method:"POST"})
        .then(async r=>({ok:r.ok,data:await r.json()}))
        .catch(()=>({ok:false,data:{error:"Continuous monitoring activation failed"}}));

      const [scanResults,monitor] = await Promise.all([scanPromise,monitorPromise]);
      const scanned = scanResults.filter(Boolean).length;
      if(!monitor.ok) throw new Error(monitor.data?.error||"Could not activate continuous monitoring");
      mark(4,"done",`${scanned} priority competitors ready. ${monitor.data?.alreadyActive?"Continuous discovery was already active":"Continuous discovery is active every 6 hours"}.`);

      setMessage("RADAR is ready. Your setup is saved and your competitive universe will keep updating as evidence arrives.");
      setTimeout(()=>router.replace("/"),350);
    }catch(err){
      const text = err instanceof Error?err.message:"Setup failed"; setMessage(`${text}. Your saved setup is safe. Press Build my RADAR again to resume.`);
      setSteps(prev=>prev.map(s=>s.status==="working"?{...s,status:"error"}:s));
    }finally{setBusy(false)}
  }

  if(loadingWorkspace) return <div className="content onboarding-page"><div className="onboarding-shell"><div className="panel" style={{maxWidth:860,margin:"80px auto",padding:24,display:"flex",gap:10,alignItems:"center"}}><LoaderCircle size={18}/><span style={{fontSize:13}}>Opening your private RADAR workspace...</span></div></div></div>;

  return <div className="content onboarding-page"><div className="onboarding-shell">
    <div className="onboarding-head">
      <div className="onboarding-radar"><Radar size={30}/><span className="scan-line"/></div>
      <span className="tiny-label">ONE-URL BOOTSTRAP</span>
      <h1>Give RADAR your startup. We’ll map the world around it.</h1>
      <p>Your URL is saved first. RADAR then understands your company, discovers competitors, scans priority matches and activates continuous public-web monitoring.</p>
    </div>

    <form onSubmit={run} className="panel" style={{maxWidth:860,margin:"0 auto 18px",padding:20}}>
      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
        <Globe2 size={18}/><input value={website} onChange={e=>setWebsite(e.target.value)} placeholder="yourstartup.com" required disabled={busy} style={{flex:1,minWidth:240,height:46,border:"1px solid #d8dcdf",borderRadius:10,padding:"0 14px",fontSize:14}}/>
        <button disabled={busy} className="primary-button" style={{height:46}}>{busy?<><LoaderCircle size={15}/>Building RADAR...</>:<><Sparkles size={15}/>{existing?.website?"Resume RADAR setup":"Build my RADAR"}</>}</button>
      </div>
      <div style={{marginTop:10,fontSize:12,color:"#72787d"}}>Your URL is persisted before scanning begins. Refreshing or signing in again will not erase saved setup.</div>
    </form>

    <div className="onboarding-progress-card panel">
      <div className="onboarding-steps">{steps.map((step,i)=><div className="onboarding-step" key={step.label}>
        <div className={`onboarding-icon ${step.status==="done"?"done":step.status==="working"?"working":""}`}>{step.status==="done"?<CheckCircle2 size={18}/>:step.status==="working"?<LoaderCircle size={18}/>:step.status==="error"?<ShieldCheck size={18}/>:i===2?<Search size={18}/>:<Radar size={18}/>}</div>
        <div className="onboarding-copy"><strong>{step.label}</strong><span>{step.detail}</span></div>
        <em>{step.status==="working"?"Working":step.status==="done"?"Done":step.status==="error"?"Retry":"Waiting"}</em>
      </div>)}</div>
    </div>

    {message?<div className="panel" style={{maxWidth:860,margin:"14px auto 0",padding:15,display:"flex",alignItems:"center",gap:10}}><ShieldCheck size={17}/><span style={{fontSize:13}}>{message}</span>{message.startsWith("RADAR is ready")?<button onClick={()=>router.replace("/")} className="secondary-button" style={{marginLeft:"auto"}}>Open RADAR <ArrowRight size={14}/></button>:null}</div>:null}
  </div></div>;
}
