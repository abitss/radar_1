"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, LoaderCircle } from "lucide-react";

const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

export function RadarAutoSetup({disabled=false}:{disabled?:boolean}){
  const started=useRef(false);
  const [status,setStatus]=useState<"idle"|"working"|"done"|"error">("idle");
  const [message,setMessage]=useState("");

  useEffect(()=>{
    if(disabled||started.current)return;
    started.current=true;
    let alive=true;

    async function json(url:string,init?:RequestInit){
      const res=await fetch(url,{cache:"no-store",...init});
      const data=await res.json().catch(()=>({}));
      return {res,data};
    }

    async function run(){
      try{
        const workspaceResult=await json("/api/radar/workspace");
        if(!workspaceResult.res.ok)return;
        const workspace=workspaceResult.data;
        if(!workspace?.website)return;

        const params=new URLSearchParams(window.location.search);
        const explicit=params.get("initialize")==="1";
        const activeJob=Array.isArray(workspace.jobs)?workspace.jobs.find((j:any)=>j.job_type==="initial_intelligence"&&["queued","running"].includes(j.status)):null;
        const needsInitial=workspace.initial_scan_status!=="completed"||Boolean(activeJob);

        if(needsInitial){
          if(alive){
            setStatus("working");
            const step=activeJob?.current_step&&activeJob.current_step!=="queued"?` Current step: ${activeJob.current_step}.`:"";
            setMessage(`RADAR is creating this workspace's complete intelligence universe automatically.${step}`);
          }
          const init=await json("/api/radar/initialize",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({resume:true})});
          if(!init.res.ok)throw new Error(init.data?.error||"Automatic intelligence initialization failed");
          if(explicit)window.history.replaceState({},"",window.location.pathname||"/");
          if(alive){
            const out=init.data?.output||{};
            setStatus("done");
            setMessage(`Workspace intelligence ready: ${out.competitors||0} competitors, ${out.evidence||0} evidence items, ${out.signals||0} signals and ${out.recommendations||0} recommendations. Continuous discovery remains active.`);
            await sleep(6500);
            if(alive)setStatus("idle");
          }
          return;
        }

        const overview=await json("/api/radar/overview");
        if(!overview.res.ok)return;
        if(!overview.data?.monitor){
          if(alive){setStatus("working");setMessage("Restoring continuous market surveillance for this workspace...")}
          const monitor=await json("/api/radar/continuous",{method:"POST"});
          if(!monitor.res.ok)throw new Error(monitor.data?.error||"Continuous monitoring could not start");
          if(alive){setStatus("done");setMessage("Continuous market surveillance restored.");await sleep(4000);if(alive)setStatus("idle")}
          return;
        }

        if(Number(overview.data?.metrics?.competitors||0)===0){
          if(alive){setStatus("working");setMessage("No verified competitors yet. RADAR is running a fresh discovery sweep for this workspace...")}
          const discover=await json("/api/radar/discover",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({force:true})});
          if(!discover.res.ok&&!discover.data?.cooldown)throw new Error(discover.data?.error||"Market discovery failed");
          if(alive){setStatus("done");setMessage("Fresh discovery completed. RADAR will continue expanding this workspace automatically.");await sleep(4500);if(alive)setStatus("idle")}
        }
      }catch(error){
        if(alive){
          setStatus("error");
          setMessage(error instanceof Error?`${error.message}. RADAR saved the state and will retry safely for this workspace.`:"Initialization failed. RADAR will retry safely.");
        }
      }
    }

    run();
    return()=>{alive=false};
  },[disabled]);

  if(status==="idle")return null;
  return <div style={{margin:"12px 22px 0",padding:"10px 12px",border:"1px solid #d9dde0",borderRadius:10,background:"#f8f9f9",display:"flex",alignItems:"center",gap:9,fontSize:12,color:"#545b60"}}>
    {status==="working"?<LoaderCircle size={15} className="spin"/>:<CheckCircle2 size={15}/>}<span>{message}</span>
  </div>;
}
