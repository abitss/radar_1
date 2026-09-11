"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, LoaderCircle } from "lucide-react";

const sleep = (ms:number) => new Promise(resolve => setTimeout(resolve, ms));

export function RadarAutoSetup({ disabled = false }: { disabled?: boolean }) {
  const started = useRef(false);
  const [status,setStatus] = useState<"idle"|"working"|"done"|"error">("idle");
  const [message,setMessage] = useState("");

  useEffect(()=>{
    if(disabled || started.current) return;
    started.current = true;
    let alive = true;

    async function json(url:string, init?:RequestInit){
      const res = await fetch(url,{cache:"no-store",...init});
      const data = await res.json().catch(()=>({}));
      return {res,data};
    }

    async function run(){
      try{
        const first = await json("/api/radar/overview");
        if(!first.res.ok || !first.data?.workspace?.website) return;

        const workspace = first.data.workspace;
        const brainReady = Boolean(
          workspace.description ||
          workspace.problem_statement ||
          workspace.product_keywords?.length ||
          workspace.capability_keywords?.length
        );
        const competitorsReady = Number(first.data?.metrics?.competitors || 0) > 0;
        const monitorReady = Boolean(first.data?.monitor);
        if(brainReady && competitorsReady && monitorReady) return;

        if(alive){
          setStatus("working");
          setMessage("RADAR is scanning in fast mode. You can keep using the app.");
        }

        if(!brainReady){
          const boot = await json("/api/radar/bootstrap",{
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({website:workspace.website})
          });
          if(!boot.res.ok) throw new Error(boot.data?.error || "Could not build Company Brain");
        }

        let overview = (await json("/api/radar/overview")).data;
        if(Number(overview?.metrics?.competitors || 0) === 0){
          const discover = await json("/api/radar/discover",{method:"POST"});
          if(!discover.res.ok && !discover.data?.cooldown) throw new Error(discover.data?.error || "Market discovery failed");
        }

        const competitorsResult = await json("/api/radar/competitors");
        const competitors = Array.isArray(competitorsResult.data) ? competitorsResult.data.slice(0,2) : [];
        await Promise.all(competitors.map(async (competitor:any)=>{
          try{
            const scan = await json("/api/radar/scan",{
              method:"POST",
              headers:{"Content-Type":"application/json"},
              body:JSON.stringify({competitorId:competitor.id,quick:true})
            });
            return scan.res.ok || Boolean(scan.data?.cooldown);
          }catch{return false;}
        }));

        overview = (await json("/api/radar/overview")).data;
        if(!overview?.monitor){
          const monitor = await json("/api/radar/continuous",{method:"POST"});
          if(!monitor.res.ok) throw new Error(monitor.data?.error || "Continuous monitoring could not start");
        }

        if(alive){
          setStatus("done");
          setMessage("Initial RADAR scan is ready. Deeper evidence will accumulate automatically.");
          await sleep(3500);
          if(alive) setStatus("idle");
        }
      }catch(error){
        if(alive){
          setStatus("error");
          setMessage(error instanceof Error ? `${error.message}. Your saved setup is safe.` : "Background setup paused. Your saved setup is safe.");
        }
      }
    }

    run();
    return ()=>{alive=false};
  },[disabled]);

  if(status === "idle") return null;
  return <div style={{margin:"12px 22px 0",padding:"10px 12px",border:"1px solid #d9dde0",borderRadius:10,background:"#f8f9f9",display:"flex",alignItems:"center",gap:9,fontSize:12,color:"#545b60"}}>
    {status === "working" ? <LoaderCircle size={15} className="spin"/> : <CheckCircle2 size={15}/>}<span>{message}</span>
  </div>;
}
