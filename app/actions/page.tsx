"use client";
import { useEffect,useMemo,useState } from "react";
import Link from "next/link";
import { CheckCircle2,Clock3,LoaderCircle,PlayCircle } from "lucide-react";
import { PageIntro } from "@/components/intelligence-ui";

export default function ActionsPage(){
  const[rows,setRows]=useState<any[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState("");
  async function load(){const r=await fetch("/api/radar/actions",{cache:"no-store"});const d=await r.json();if(r.ok)setRows(Array.isArray(d)?d:[]);setLoading(false)}
  useEffect(()=>{load()},[]);
  async function update(id:string,status:string){setBusy(id);await fetch("/api/radar/actions",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,status})});await load();setBusy("")}
  const stats=useMemo(()=>({active:rows.filter(r=>r.status==="active").length,draft:rows.filter(r=>r.status==="draft").length,completed:rows.filter(r=>r.status==="completed").length,overdue:rows.filter(r=>r.due_at&&new Date(r.due_at)<new Date()&&r.status!=="completed").length}),[rows]);
  return <div className="content">
    <PageIntro eyebrow="EXECUTION MEMORY" title="Actions" description="Accepted strategic decisions become concrete work here. Execute, complete, then record what actually happened." action={<Link className="secondary-button" href="/outcomes">View Outcomes</Link>}/>
    <section className="metrics-grid"><div className="stat-tile"><span>Active</span><strong>{stats.active}</strong><small>In execution</small></div><div className="stat-tile"><span>Draft</span><strong>{stats.draft}</strong><small>Ready to start</small></div><div className="stat-tile"><span>Completed</span><strong>{stats.completed}</strong><small>Awaiting or linked to outcomes</small></div><div className="stat-tile"><span>Overdue</span><strong>{stats.overdue}</strong><small>Needs attention</small></div></section>
    <section style={{display:"grid",gap:12}}>{loading?<div className="panel" style={{padding:24}}>Loading actions...</div>:rows.length?rows.map(a=><article key={a.id} className="panel founder-panel"><div className="founder-panel-head"><div><span>{a.status} · priority {Math.round(Number(a.priority||0))}</span><h2>{a.title}</h2></div>{a.status==="completed"?<CheckCircle2 size={20}/>:a.status==="active"?<PlayCircle size={20}/>:<Clock3 size={20}/>}</div><p>{a.description}</p>{a.decision?<div className="founder-action-block"><span>FROM DECISION</span><strong>{a.decision.title}</strong></div>:null}<div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:12}}>{a.status==="draft"?<button className="primary-button" disabled={busy===a.id} onClick={()=>update(a.id,"active")}>Start action</button>:null}{a.status==="active"?<button className="primary-button" disabled={busy===a.id} onClick={()=>update(a.id,"completed")}>Mark completed</button>:null}{busy===a.id?<LoaderCircle size={15}/>:null}{a.status==="completed"&&a.decision_id?<Link className="secondary-button" href={`/outcomes?decision=${a.decision_id}&action=${a.id}`}>Record outcome</Link>:null}</div></article>):<div className="panel" style={{padding:30,textAlign:"center",color:"#737a80"}}>No Actions yet. Choose a response in Decisions and RADAR will create the execution record automatically.</div>}</section>
  </div>
}
