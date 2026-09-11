"use client";

import { FormEvent, useEffect, useState } from "react";
import { Globe2, LoaderCircle, Radar, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const router = useRouter();
  const [website,setWebsite] = useState("");
  const [busy,setBusy] = useState(false);
  const [loadingWorkspace,setLoadingWorkspace] = useState(true);
  const [message,setMessage] = useState("");

  useEffect(()=>{
    let alive = true;
    fetch("/api/radar/workspace",{cache:"no-store"})
      .then(async r=>({ok:r.ok,data:await r.json()}))
      .then(({ok,data})=>{
        if(!alive) return;
        if(!ok){setLoadingWorkspace(false);return;}
        if(data?.website){
          setWebsite(data.website);
          router.replace("/");
          return;
        }
        setLoadingWorkspace(false);
      })
      .catch(()=>{ if(alive) setLoadingWorkspace(false); });
    return ()=>{alive=false};
  },[router]);

  async function run(e: FormEvent){
    e.preventDefault();
    if(!website.trim() || busy) return;
    setBusy(true);
    setMessage("");
    try{
      const res = await fetch("/api/radar/workspace",{
        method:"PATCH",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({website:website.trim()})
      });
      const data = await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(data.error || "Could not save startup URL");
      router.replace("/");
      router.refresh();
    }catch(err){
      setMessage(err instanceof Error ? err.message : "Setup failed");
      setBusy(false);
    }
  }

  if(loadingWorkspace) return <div className="content onboarding-page"><div className="onboarding-shell"><div className="panel" style={{maxWidth:720,margin:"90px auto",padding:24,display:"flex",gap:10,alignItems:"center"}}><LoaderCircle size={18}/><span style={{fontSize:13}}>Opening your private RADAR workspace...</span></div></div></div>;

  return <div className="content onboarding-page"><div className="onboarding-shell">
    <div className="onboarding-head">
      <div className="onboarding-radar"><Radar size={30}/><span className="scan-line"/></div>
      <span className="tiny-label">ONE-URL SETUP</span>
      <h1>Give RADAR your startup URL.</h1>
      <p>That’s it. We save it instantly and build your Company Brain, competitors, deep scans and monitoring in the background while you enter the dashboard.</p>
    </div>

    <form onSubmit={run} className="panel" style={{maxWidth:720,margin:"0 auto",padding:20}}>
      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
        <Globe2 size={18}/>
        <input value={website} onChange={e=>setWebsite(e.target.value)} placeholder="yourstartup.com" required disabled={busy} autoFocus style={{flex:1,minWidth:240,height:48,border:"1px solid #d8dcdf",borderRadius:10,padding:"0 14px",fontSize:14}}/>
        <button disabled={busy} className="primary-button" style={{height:48}}>{busy?<><LoaderCircle size={15}/>Saving...</>:<><Sparkles size={15}/>Enter RADAR</>}</button>
      </div>
      <div style={{marginTop:10,fontSize:12,color:"#72787d"}}>No waiting screen. Your workspace opens immediately and RADAR continues setup automatically.</div>
      {message?<div style={{marginTop:12,fontSize:12,color:"#8a3d3d"}}>{message}</div>:null}
    </form>
  </div></div>;
}
