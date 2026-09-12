"use client";

import { useEffect, useState } from "react";
import { Check, CircleAlert, X } from "lucide-react";
import { PageIntro } from "@/components/intelligence-ui";

export default function DecisionsPage(){
  const [rows,setRows]=useState<any[]>([]); const [loading,setLoading]=useState(true); const [busy,setBusy]=useState("");
  async function load(){const data=await fetch("/api/radar/recommendations",{cache:"no-store"}).then(r=>r.json());setRows(Array.isArray(data)?data:[]);setLoading(false)}
  useEffect(()=>{load()},[]);
  async function update(id:string,status:string){setBusy(id);await fetch("/api/radar/recommendations",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,status})});await load();setBusy("")}
  const open=rows.filter(r=>r.status==="open"); const high=open.filter(r=>["high","critical"].includes(r.priority)).length; const accepted=rows.filter(r=>r.status==="accepted").length; const done=rows.filter(r=>r.status==="done").length;
  return <div className="content">
    <PageIntro eyebrow="DECISION INTELLIGENCE" title="Decisions" description="RADAR turns competitive evidence into explicit recommendations. Accept, dismiss or complete them so the system remembers what you chose." />
    <section className="metrics-grid"><div className="stat-tile"><span>Open</span><strong>{open.length}</strong><small>Needs founder review</small></div><div className="stat-tile"><span>High priority</span><strong>{high}</strong><small>Competitive risk</small></div><div className="stat-tile"><span>Accepted</span><strong>{accepted}</strong><small>Chosen responses</small></div><div className="stat-tile"><span>Done</span><strong>{done}</strong><small>Closed loop</small></div></section>
    <div className="decision-stack">
      {loading?<div className="panel" style={{padding:24}}>Loading decisions...</div>:rows.length?rows.map(r=><article className="panel decision-card" key={r.id}>
        <div className="decision-icon"><CircleAlert size={18}/></div>
        <div><span className={`decision-urgency ${r.priority}`}>{r.priority}</span><h3>{r.title}</h3><p>{r.rationale}</p><div style={{marginTop:8,fontSize:12,color:"#555c62"}}><strong>Recommended action:</strong> {r.action}</div>{r.competitor?<div style={{marginTop:7,fontSize:11,color:"#7a8085"}}>Linked to {r.competitor.name} · {Math.round(Number(r.competitor.similarity_score||0))}% similarity · {Math.round(Number(r.competitor.threat_score||0))}% threat</div>:null}</div>
        <div style={{display:"grid",gap:7,minWidth:112}}>{r.status==="open"?<><button className="primary-button" disabled={busy===r.id} onClick={()=>update(r.id,"accepted")}><Check size={13}/>Accept</button><button className="secondary-button" disabled={busy===r.id} onClick={()=>update(r.id,"dismissed")}><X size={13}/>Dismiss</button></>:<button className="secondary-button" disabled={busy===r.id||r.status==="done"} onClick={()=>update(r.id,"done")}>{r.status==="done"?"Completed":"Mark done"}</button>}</div>
      </article>):<div className="panel" style={{padding:30,textAlign:"center",color:"#737a80"}}>No recommendations yet. RADAR creates decisions only when evidence crosses a meaningful threshold.</div>}
    </div>
  </div>;
}
