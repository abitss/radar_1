"use client";

import { FormEvent, useState } from "react";
import { ExternalLink, MessageSquareText, Sparkles } from "lucide-react";
import { PageIntro } from "@/components/intelligence-ui";

const prompts=["Who is my closest competitor?","Which company is moving closer?","What changed today?","What should I do next?"];

export default function AskPage(){
  const [question,setQuestion]=useState(""); const [answer,setAnswer]=useState(""); const [evidence,setEvidence]=useState<any[]>([]); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  async function ask(e?:FormEvent,q?:string){e?.preventDefault();const text=(q??question).trim();if(!text)return;setQuestion(text);setBusy(true);setError("");const res=await fetch("/api/radar/ask",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:text})});const data=await res.json();if(!res.ok){setError(data.error||"Ask RADAR failed");setAnswer("");setEvidence([])}else{setAnswer(data.answer||"");setEvidence(data.evidence||[])}setBusy(false)}
  return <div className="content">
    <PageIntro eyebrow="GROUNDED INTELLIGENCE" title="Ask RADAR" description="Ask questions about your competitive landscape. Answers are generated only from your stored competitors, Signals, decisions and source evidence." />
    <div className="ask-layout">
      <div className="ask-hero">
        <div className="ask-orb"><Sparkles size={28}/></div><span className="tiny-label">YOUR COMPETITIVE MEMORY</span><h2>Ask what matters.</h2><p>RADAR will say when evidence is missing instead of filling the gap with a guess.</p>
        <form className="ask-box" onSubmit={e=>ask(e)}><MessageSquareText size={18}/><input value={question} onChange={e=>setQuestion(e.target.value)} aria-label="Ask RADAR" placeholder="Who is moving toward us?"/><button disabled={busy}><Sparkles size={18}/></button></form>
        <div className="prompt-grid">{prompts.map(p=><button key={p} onClick={()=>ask(undefined,p)}><Sparkles size={13}/>{p}</button>)}</div>
      </div>
      <article className="panel context-panel">
        <div className="panel-heading"><div><h3>RADAR answer</h3><p>Evidence first</p></div><span className="live-chip">LIVE</span></div>
        {busy?<p>Reading your competitive graph...</p>:error?<p>{error}</p>:answer?<><p style={{fontSize:14,lineHeight:1.7,color:"#272c30"}}>{answer}</p><div style={{marginTop:18,display:"grid",gap:9}}>{evidence.map((e:any,i:number)=><a key={`${e.url}-${i}`} href={e.url||"#"} target="_blank" rel="noreferrer" style={{textDecoration:"none",border:"1px solid #dde1e4",borderRadius:10,padding:11,display:"grid",gap:4}}><strong style={{fontSize:12}}>{e.title||"Source evidence"}</strong><span style={{fontSize:11,color:"#6f767c"}}>{e.fact}</span><small style={{fontSize:10,color:"#858b90"}}>{e.confidence||0}% confidence <ExternalLink size={10} style={{display:"inline",marginLeft:4}}/></small></a>)}</div></>:<p>Ask a question to query your real RADAR data.</p>}
      </article>
    </div>
  </div>;
}
