"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, Building2, LoaderCircle, Radar, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";

type FormState={
  founder_name:string; founder_role:string; founder_phone:string; founder_country:string; founder_goal:string;
  name:string; website:string; description:string; industry:string; sub_category:string; problem_statement:string;
  target_customers:string; buyer:string; product_keywords:string; major_features:string; capability_keywords:string;
  technology_keywords:string; geography:string; business_model:string; pricing_context:string; positioning:string; public_team_facts:string;
};

const empty:FormState={founder_name:"",founder_role:"Founder",founder_phone:"",founder_country:"",founder_goal:"",name:"",website:"",description:"",industry:"",sub_category:"",problem_statement:"",target_customers:"",buyer:"",product_keywords:"",major_features:"",capability_keywords:"",technology_keywords:"",geography:"",business_model:"",pricing_context:"",positioning:"",public_team_facts:""};
const csv=(v:any)=>Array.isArray(v)?v.join(", "):String(v||"");
const split=(v:string)=>v.split(",").map(x=>x.trim()).filter(Boolean);

export default function OnboardingPage(){
  const router=useRouter();
  const [form,setForm]=useState<FormState>(empty);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{
    let alive=true;
    fetch("/api/radar/workspace",{cache:"no-store"}).then(async r=>({ok:r.ok,data:await r.json()})).then(({ok,data})=>{
      if(!alive)return;
      if(!ok){setLoading(false);return;}
      if(data?.onboarding_completed){router.replace("/");return;}
      setForm({
        founder_name:data?.founder_name||"", founder_role:data?.founder_role||"Founder", founder_phone:data?.founder_phone||"", founder_country:data?.founder_country||"", founder_goal:data?.founder_goal||"",
        name:data?.name==="My startup"?"":data?.name||"", website:data?.website||"", description:data?.description||"", industry:data?.industry||"", sub_category:data?.sub_category||"",
        problem_statement:data?.problem_statement||"", target_customers:data?.target_customers||"", buyer:data?.buyer||"", product_keywords:csv(data?.product_keywords), major_features:csv(data?.major_features),
        capability_keywords:csv(data?.capability_keywords), technology_keywords:csv(data?.technology_keywords), geography:data?.geography||"", business_model:data?.business_model||"", pricing_context:data?.pricing_context||"", positioning:data?.positioning||"", public_team_facts:data?.public_team_facts||""
      });
      setLoading(false);
    }).catch(()=>setLoading(false));
    return()=>{alive=false};
  },[router]);

  function set<K extends keyof FormState>(key:K,value:FormState[K]){setForm(prev=>({...prev,[key]:value}))}

  async function submit(e:FormEvent){
    e.preventDefault(); if(busy)return; setError(""); setBusy(true);
    try{
      const required=[form.founder_name,form.founder_role,form.name,form.description,form.problem_statement,form.target_customers,form.industry];
      if(required.some(v=>!v.trim()))throw new Error("Please complete the founder name, role, startup name, description, problem, target customers and industry.");
      if(!split(form.product_keywords).length&&!split(form.capability_keywords).length&&!split(form.major_features).length)throw new Error("Add at least one product, capability or major feature so RADAR can understand what to search for.");
      const res=await fetch("/api/radar/workspace",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        founder_name:form.founder_name.trim(),founder_role:form.founder_role.trim(),founder_phone:form.founder_phone.trim(),founder_country:form.founder_country.trim(),founder_goal:form.founder_goal.trim(),
        name:form.name.trim(),website:form.website.trim()||null,description:form.description.trim(),industry:form.industry.trim(),sub_category:form.sub_category.trim(),problem_statement:form.problem_statement.trim(),
        target_customers:form.target_customers.trim(),buyer:form.buyer.trim(),product_keywords:split(form.product_keywords),major_features:split(form.major_features),capability_keywords:split(form.capability_keywords),technology_keywords:split(form.technology_keywords),
        geography:form.geography.trim(),business_model:form.business_model.trim(),pricing_context:form.pricing_context.trim(),positioning:form.positioning.trim(),public_team_facts:form.public_team_facts.trim(),onboarding_completed:true,
      })});
      const data=await res.json().catch(()=>({})); if(!res.ok)throw new Error(data.error||"Could not save your workspace.");
      router.replace("/?initialize=1"); router.refresh();
    }catch(err){setError(err instanceof Error?err.message:"Setup failed");setBusy(false)}
  }

  if(loading)return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#e9ebed",padding:24}}><div style={{display:"flex",gap:10,alignItems:"center",fontSize:13,color:"#5f666b"}}><LoaderCircle size={18}/>Preparing your private workspace...</div></main>;

  const field=(label:string,key:keyof FormState,placeholder:string,wide=false,area=false,optional=false)=><label style={{display:"grid",gap:6,fontSize:12,color:"#555c62",gridColumn:wide?"1 / -1":undefined}}>{label}{optional?<span style={{color:"#92979b"}}> optional</span>:null}{area?<textarea value={form[key]} onChange={e=>set(key,e.target.value)} placeholder={placeholder} style={{...input,minHeight:88,padding:"12px 13px",resize:"vertical"}}/>:<input value={form[key]} onChange={e=>set(key,e.target.value)} placeholder={placeholder} style={input}/>}</label>;

  return <main style={{minHeight:"100vh",background:"#e9ebed",padding:"42px 20px",fontFamily:'"Avenir Next","Segoe UI",system-ui,sans-serif'}}>
    <section style={{width:"100%",maxWidth:980,margin:"0 auto",background:"#fff",border:"1px solid #d8dcdf",borderRadius:20,boxShadow:"0 26px 80px rgba(0,0,0,.08)",overflow:"hidden"}}>
      <div style={{padding:"30px 34px 24px",borderBottom:"1px solid #e4e7e9",display:"flex",gap:16,alignItems:"flex-start"}}>
        <div style={{width:46,height:46,borderRadius:13,display:"grid",placeItems:"center",background:"#252a2e",color:"#fff",flex:"0 0 auto"}}><Radar size={24}/></div>
        <div><div style={{fontSize:11,letterSpacing:".14em",color:"#70777d",marginBottom:7}}>BUILD YOUR COMPANY BRAIN</div><h1 style={{fontSize:30,lineHeight:1.08,letterSpacing:"-.04em",fontWeight:520,margin:"0 0 8px",color:"#15191c"}}>Teach RADAR what you are building.</h1><p style={{margin:0,color:"#697076",fontSize:14,lineHeight:1.55}}>Your answers are RADAR's primary intelligence input. A website is optional. RADAR uses this profile to discover competitors, personalize live market scanning, score threats, interpret changes and generate founder-specific decisions.</p></div>
      </div>

      <form onSubmit={submit} style={{padding:34,display:"grid",gap:28}}>
        <section><div style={{display:"flex",gap:9,alignItems:"center",marginBottom:14,color:"#30363a"}}><UserRound size={17}/><strong style={{fontSize:13}}>Founder context</strong></div><div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:14}}>
          {field("Full name","founder_name","Your name")}{field("Role","founder_role","Founder / CEO / Co-founder")}{field("Country","founder_country","India",false,false,true)}{field("Phone","founder_phone","+91...",false,false,true)}{field("What decisions do you want RADAR to help with?","founder_goal","Find emerging competitors early, track pricing, spot market shifts...",true,true,true)}
        </div></section>

        <section><div style={{display:"flex",gap:9,alignItems:"center",marginBottom:14,color:"#30363a"}}><Building2 size={17}/><strong style={{fontSize:13}}>Company Brain</strong></div><div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:14}}>
          {field("Startup name","name","Acme AI")}{field("Website","website","Optional if you do not have one yet",false,false,true)}
          {field("One-line description","description","What exactly are you building?",true,true)}
          {field("Problem / use case","problem_statement","What pain or job are you solving?",true,true)}
          {field("Industry","industry","Education, drone, SaaS, fintech...")}{field("Sub-category","sub_category","Foundational literacy, creator drones...",false,false,true)}
          {field("Target customers","target_customers","Who uses or benefits from it?")}{field("Buyer / decision maker","buyer","Who pays or approves the purchase?",false,false,true)}
          {field("Products / services","product_keywords","Comma separated: AI tutor, assessment engine, analytics",true)}
          {field("Major features","major_features","Comma separated: speech analysis, adaptive plans, live alerts",true)}
          {field("Core capabilities","capability_keywords","Comma separated: competitor discovery, vision AI, semantic monitoring",true)}
          {field("Core technologies","technology_keywords","Comma separated: LLM, computer vision, edge AI",true,false,true)}
          {field("Geography","geography","India, US, global...",false,false,true)}{field("Business model","business_model","B2B SaaS, D2C hardware...",false,false,true)}
          {field("Pricing / price band","pricing_context","₹499/mo, premium hardware, not decided",false,false,true)}
          {field("Positioning","positioning","How should customers understand you?",true,true,true)}
          {field("Relevant company/team facts","public_team_facts","Stage, traction, partnerships, team strengths, launch status...",true,true,true)}
        </div></section>

        {error?<div style={{fontSize:12,padding:"11px 12px",border:"1px solid #ead2d2",borderRadius:10,background:"#f7eeee",color:"#8a3d3d"}}>{error}</div>:null}
        <div style={{display:"flex",justifyContent:"space-between",gap:14,alignItems:"center",paddingTop:4}}><span style={{fontSize:12,color:"#737a80"}}>RADAR will start from your Company Brain immediately. If you add a website later, it becomes an extra evidence source, not a requirement.</span><button disabled={busy} className="primary-button" style={{height:46,minWidth:190}}>{busy?<><LoaderCircle size={15}/>Building RADAR...</>:<>Start intelligence scan <ArrowRight size={15}/></>}</button></div>
      </form>
    </section>
  </main>;
}

const input:React.CSSProperties={height:46,border:"1px solid #d7dbde",borderRadius:10,padding:"0 13px",fontSize:14,outline:"none",background:"#fff",color:"#1f2428"};
