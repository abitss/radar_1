"use client";

import { FormEvent, useState } from "react";
import { Radar } from "lucide-react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login"|"signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMessage("");
    const res = await fetch(`/api/auth/${mode}`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({email,password}) });
    const data = await res.json();
    if (!res.ok || data?.error) { setMessage(data?.error || "Authentication failed"); setBusy(false); return; }
    if (data?.needsVerification) { setMessage(data.message || "Verify your email, then sign in."); setMode("login"); setBusy(false); return; }
    router.replace("/onboarding");
    router.refresh();
  }

  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#e9ebed",padding:24,fontFamily:'"Avenir Next","Segoe UI",system-ui,sans-serif'}}>
    <section style={{width:"100%",maxWidth:430,background:"#fff",border:"1px solid #d8dcdf",borderRadius:18,padding:34,boxShadow:"0 24px 70px rgba(0,0,0,.08)"}}>
      <div style={{width:44,height:44,borderRadius:12,display:"grid",placeItems:"center",background:"#24292d",color:"#fff",marginBottom:26}}><Radar size={23}/></div>
      <div style={{fontSize:11,letterSpacing:".14em",color:"#70777d",marginBottom:8}}>RADAR · FOUNDER INTELLIGENCE</div>
      <h1 style={{fontSize:30,lineHeight:1.08,letterSpacing:"-.04em",fontWeight:520,margin:"0 0 10px",color:"#15191c"}}>{mode === "signup" ? "See the market before it hits you." : "Welcome back."}</h1>
      <p style={{fontSize:14,lineHeight:1.6,color:"#697076",margin:"0 0 26px"}}>{mode === "signup" ? "Create your private workspace. RADAR will discover and continuously watch the competitive universe around your startup." : "Open your private competitive intelligence workspace."}</p>
      <form onSubmit={submit} style={{display:"grid",gap:14}}>
        <label style={{display:"grid",gap:6,fontSize:12,color:"#555c62"}}>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} style={{height:46,border:"1px solid #d7dbde",borderRadius:10,padding:"0 13px",fontSize:14,outline:"none"}}/></label>
        <label style={{display:"grid",gap:6,fontSize:12,color:"#555c62"}}>Password<input type="password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} style={{height:46,border:"1px solid #d7dbde",borderRadius:10,padding:"0 13px",fontSize:14,outline:"none"}}/></label>
        {message ? <div style={{fontSize:12,lineHeight:1.5,padding:"10px 12px",background:"#f1f3f4",borderRadius:9,color:"#4d545a"}}>{message}</div> : null}
        <button disabled={busy} style={{height:46,border:0,borderRadius:10,background:"#292e32",color:"#fff",fontWeight:600,cursor:"pointer"}}>{busy ? "Working..." : mode === "signup" ? "Create private RADAR" : "Sign in"}</button>
      </form>
      <button onClick={()=>{setMode(mode === "signup" ? "login" : "signup");setMessage("")}} style={{marginTop:18,border:0,background:"transparent",padding:0,color:"#5c6368",fontSize:13,cursor:"pointer"}}>{mode === "signup" ? "Already have an account? Sign in" : "New to RADAR? Create account"}</button>
    </section>
  </main>;
}
