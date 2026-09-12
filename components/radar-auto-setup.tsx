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
        const needsInitial=workspace.initial_scan_status!=="completed";
        if(!explicit&&!needsInitial)return;

        if(alive){
          setStatus("working");
          setMessage("RADAR is creating your complete competitive-intelligence universe automatically: Company Brain → web discovery → real companies/products → similarity & threat → deep evidence → monitoring → founder briefing.");
        }

        const init=await json("/api/radar/initialize",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
        if(!init.res.ok)throw new Error(init.data?.error||"Automatic intelligence initialization failed");

        if(explicit){
          window.history.replaceState({},"",window.location.pathname||"/");
        }

        if(alive){
          const out=init.data?.output||{};
          setStatus("done");
          setMessage(`RADAR initialization complete: ${out.competitors||0} competitors, ${out.evidence||0} evidence items, ${out.signals||0} signals and ${out.recommendations||0} founder recommendations. Continuous discovery remains active.`);
          await sleep(7000);
          if(alive)setStatus("idle");
        }
      }catch(error){
        if(alive){
          setStatus("error");
          setMessage(error instanceof Error?`${error.message}. RADAR saved the failure state and will retry on your next workspace load.`:"Initialization failed. RADAR will retry automatically.");
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
