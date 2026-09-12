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
        if(!first.res.ok) return;
        if(!first.data?.workspace?.website){
          if(alive){ setStatus("error"); setMessage("Complete startup setup first. RADAR needs your website before automatic discovery can begin."); }
          return;
        }

        const workspace = first.data.workspace;
        const brainReady = Boolean(
          workspace.description || workspace.problem_statement || workspace.product_keywords?.length ||
          workspace.capability_keywords?.length || workspace.industry || workspace.sub_category
        );

        if(alive){
          setStatus("working");
          setMessage("RADAR is building your Company Brain and searching the public web for competitors. You can keep using the app.");
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
        const competitorsBefore = Number(overview?.metrics?.competitors || 0);
        if(competitorsBefore < 5){
          if(alive) setMessage("Company Brain ready. Searching multiple public-web discovery paths for direct, adjacent, micro and emerging competitors...");
          const discover = await json("/api/radar/discover",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({force:competitorsBefore===0})});
          if(!discover.res.ok && !discover.data?.cooldown) throw new Error(discover.data?.error || "Market discovery failed");
        }

        const competitorsResult = await json("/api/radar/competitors");
        const competitors = Array.isArray(competitorsResult.data) ? competitorsResult.data : [];
        const toScan = competitors
          .filter((c:any)=>!c.last_scanned_at)
          .sort((a:any,b:any)=>Number(b.threat_score||b.similarity_score||0)-Number(a.threat_score||a.similarity_score||0))
          .slice(0,5);

        if(toScan.length && alive) setMessage(`Found ${competitors.length} tracked companies. Verifying similarity and threat for the top ${toScan.length}...`);
        await Promise.all(toScan.map(async (competitor:any)=>{
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
          if(alive) setMessage("Initial competitor map ready. Activating continuous discovery...");
          const monitor = await json("/api/radar/continuous",{method:"POST"});
          if(!monitor.res.ok) throw new Error(monitor.data?.error || "Continuous monitoring could not start");
        }

        const finalOverview=(await json("/api/radar/overview")).data;
        const total=Number(finalOverview?.metrics?.competitors||0);
        if(alive){
          setStatus("done");
          setMessage(total?`RADAR is active with ${total} tracked compan${total===1?"y":"ies"}. Similarity, threat and evidence will keep updating automatically.`:"Discovery completed, but no relevant companies were verified yet. RADAR will keep searching continuously.");
          await sleep(5000);
          if(alive) setStatus("idle");
        }
      }catch(error){
        if(alive){
          setStatus("error");
          setMessage(error instanceof Error ? `${error.message}. Your saved setup is safe; retry from Discover.` : "Background intelligence setup paused. Your saved setup is safe.");
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
