"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, Building2, Globe2, LoaderCircle, Radar, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";

type FormState = {
  founder_name:string;
  founder_role:string;
  founder_phone:string;
  founder_country:string;
  founder_goal:string;
  name:string;
  website:string;
};

const empty:FormState={founder_name:"",founder_role:"Founder",founder_phone:"",founder_country:"",founder_goal:"",name:"",website:""};

export default function OnboardingPage(){
  const router=useRouter();
  const [form,setForm]=useState<FormState>(empty);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{
    let alive=true;
    fetch("/api/radar/workspace",{cache:"no-store"})
      .then(async r=>({ok:r.ok,data:await r.json()}))
      .then(({ok,data})=>{
        if(!alive)return;
        if(!ok){setLoading(false);return;}
        if(data?.onboarding_completed){router.replace("/");return;}
        setForm({
          founder_name:data?.founder_name||"",
          founder_role:data?.founder_role||"Founder",
          founder_phone:data?.founder_phone||"",
          founder_country:data?.founder_country||"",
          founder_goal:data?.founder_goal||"",
          name:data?.name==="My startup"?"":data?.name||"",
          website:data?.website||"",
        });
        setLoading(false);
      })
      .catch(()=>setLoading(false));
    return()=>{alive=false};
  },[router]);

  function set<K extends keyof FormState>(key:K,value:FormState[K]){setForm(prev=>({...prev,[key]:value}))}

  async function submit(e:FormEvent){
    e.preventDefault();
    if(busy)return;
    setError("");
    setBusy(true);
    try{
      const required=[form.founder_name,form.founder_role,form.name,form.website];
      if(required.some(v=>!v.trim())) throw new Error("Please complete your name, role, startup name and website.");
      const res=await fetch("/api/radar/workspace",{
        method:"PATCH",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          founder_name:form.founder_name.trim(),
          founder_role:form.founder_role.trim(),
          founder_phone:form.founder_phone.trim(),
          founder_country:form.founder_country.trim(),
          founder_goal:form.founder_goal.trim(),
          name:form.name.trim(),
          website:form.website.trim(),
          onboarding_completed:true,
        })
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(data.error||"Could not save your workspace.");
      router.replace("/");
      router.refresh();
    }catch(err){setError(err instanceof Error?err.message:"Setup failed");setBusy(false)}
  }

  if(loading)return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#e9ebed",padding:24}}><div style={{display:"flex",gap:10,alignItems:"center",fontSize:13,color:"#5f666b"}}><LoaderCircle size={18}/>Preparing your private workspace...</div></main>;

  return <main style={{minHeight:"100vh",background:"#e9ebed",padding:"42px 20px",fontFamily:'"Avenir Next","Segoe UI",system-ui,sans-serif'}}>
    <section style={{width:"100%",maxWidth:860,margin:"0 auto",background:"#fff",border:"1px solid #d8dcdf",borderRadius:20,boxShadow:"0 26px 80px rgba(0,0,0,.08)",overflow:"hidden"}}>
      <div style={{padding:"30px 34px 24px",borderBottom:"1px solid #e4e7e9",display:"flex",gap:16,alignItems:"flex-start"}}>
        <div style={{width:46,height:46,borderRadius:13,display:"grid",placeItems:"center",background:"#252a2e",color:"#fff",flex:"0 0 auto"}}><Radar size={24}/></div>
        <div><div style={{fontSize:11,letterSpacing:".14em",color:"#70777d",marginBottom:7}}>WELCOME TO RADAR</div><h1 style={{fontSize:30,lineHeight:1.08,letterSpacing:"-.04em",fontWeight:520,margin:"0 0 8px",color:"#15191c"}}>Set up your founder workspace.</h1><p style={{margin:0,color:"#697076",fontSize:14,lineHeight:1.55}}>Tell RADAR who you are and what you are building. We save this once, then your competitive intelligence starts automatically.</p></div>
      </div>

      <form onSubmit={submit} style={{padding:34,display:"grid",gap:26}}>
        <section>
          <div style={{display:"flex",gap:9,alignItems:"center",marginBottom:14,color:"#30363a"}}><UserRound size={17}/><strong style={{fontSize:13}}>Founder profile</strong></div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:14}}>
            <label style={{display:"grid",gap:6,fontSize:12,color:"#555c62"}}>Full name<input required value={form.founder_name} onChange={e=>set("founder_name",e.target.value)} placeholder="Your name" style={input}/></label>
            <label style={{display:"grid",gap:6,fontSize:12,color:"#555c62"}}>Role<input required value={form.founder_role} onChange={e=>set("founder_role",e.target.value)} placeholder="Founder / CEO / Co-founder" style={input}/></label>
            <label style={{display:"grid",gap:6,fontSize:12,color:"#555c62"}}>Phone <span style={{color:"#92979b"}}>(optional)</span><input value={form.founder_phone} onChange={e=>set("founder_phone",e.target.value)} placeholder="+91..." style={input}/></label>
            <label style={{display:"grid",gap:6,fontSize:12,color:"#555c62"}}>Country <span style={{color:"#92979b"}}>(optional)</span><input value={form.founder_country} onChange={e=>set("founder_country",e.target.value)} placeholder="India" style={input}/></label>
          </div>
        </section>

        <section>
          <div style={{display:"flex",gap:9,alignItems:"center",marginBottom:14,color:"#30363a"}}><Building2 size={17}/><strong style={{fontSize:13}}>Startup</strong></div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:14}}>
            <label style={{display:"grid",gap:6,fontSize:12,color:"#555c62"}}>Startup name<input required value={form.name} onChange={e=>set("name",e.target.value)} placeholder="Acme AI" style={input}/></label>
            <label style={{display:"grid",gap:6,fontSize:12,color:"#555c62"}}>Website<div style={{position:"relative"}}><Globe2 size={15} style={{position:"absolute",left:12,top:15,color:"#80868b"}}/><input required value={form.website} onChange={e=>set("website",e.target.value)} placeholder="yourstartup.com" style={{...input,paddingLeft:36,width:"100%",boxSizing:"border-box"}}/></div></label>
            <label style={{display:"grid",gap:6,fontSize:12,color:"#555c62",gridColumn:"1 / -1"}}>What do you want RADAR to help you with? <span style={{color:"#92979b"}}>(optional)</span><textarea value={form.founder_goal} onChange={e=>set("founder_goal",e.target.value)} placeholder="Example: Find micro-competitors early, track pricing changes, and warn me when companies move into our market." style={{...input,minHeight:92,padding:"12px 13px",resize:"vertical"}}/></label>
          </div>
        </section>

        {error?<div style={{fontSize:12,padding:"11px 12px",border:"1px solid #ead2d2",borderRadius:10,background:"#f7eeee",color:"#8a3d3d"}}>{error}</div>:null}

        <div style={{display:"flex",justifyContent:"space-between",gap:14,alignItems:"center",paddingTop:4}}><span style={{fontSize:12,color:"#737a80"}}>Your data stays attached to your private RADAR workspace.</span><button disabled={busy} className="primary-button" style={{height:46,minWidth:170}}>{busy?<><LoaderCircle size={15}/>Saving...</>:<>Enter RADAR <ArrowRight size={15}/></>}</button></div>
      </form>
    </section>
  </main>;
}

const input:React.CSSProperties={height:46,border:"1px solid #d7dbde",borderRadius:10,padding:"0 13px",fontSize:14,outline:"none",background:"#fff",color:"#1f2428"};
