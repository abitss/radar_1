"use client";

import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, Mail, Radar } from "lucide-react";
import { useRouter } from "next/navigation";

type Mode = "login" | "signup";
type Notice = { kind: "success" | "error" | "info"; text: string } | null;

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [magicBusy, setMagicBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("verified") === "1") {
      setMode("login");
      setNotice({ kind: "success", text: "Email verified. Sign in with your password or use a secure email link." });
      window.history.replaceState({}, "", "/login");
    }
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);

    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok || data?.error) {
        const text = data?.error || "Authentication failed";
        setNotice({ kind: "error", text: /invalid login credentials/i.test(text) ? "That password does not match this account. Use the secure email sign-in link below or try the correct password." : text });
        return;
      }

      if (data?.needsVerification) {
        setMode("login");
        setPassword("");
        setNotice({ kind: "success", text: data.message || "Account created. Verify your email, then return here and sign in." });
        return;
      }

      router.replace("/onboarding");
      router.refresh();
    } catch {
      setNotice({ kind: "error", text: "RADAR could not reach the sign-in service. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  async function sendMagicLink() {
    if (!email.trim()) {
      setNotice({ kind: "error", text: "Enter your email first." });
      return;
    }
    setMagicBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok || data?.error) {
        setNotice({ kind: "error", text: data?.error || "Could not send secure sign-in link." });
        return;
      }
      setNotice({ kind: "success", text: data?.message || "Secure sign-in link sent. Check your email." });
    } catch {
      setNotice({ kind: "error", text: "Could not send secure sign-in link. Please try again." });
    } finally {
      setMagicBusy(false);
    }
  }

  function switchMode() {
    setMode(mode === "signup" ? "login" : "signup");
    setNotice(null);
    setPassword("");
  }

  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#e9ebed",padding:24,fontFamily:'"Avenir Next","Segoe UI",system-ui,sans-serif'}}>
    <section style={{width:"100%",maxWidth:430,background:"#fff",border:"1px solid #d8dcdf",borderRadius:18,padding:34,boxShadow:"0 24px 70px rgba(0,0,0,.08)"}}>
      <div style={{width:44,height:44,borderRadius:12,display:"grid",placeItems:"center",background:"#24292d",color:"#fff",marginBottom:26}}><Radar size={23}/></div>
      <div style={{fontSize:11,letterSpacing:".14em",color:"#70777d",marginBottom:8}}>RADAR · FOUNDER INTELLIGENCE</div>
      <h1 style={{fontSize:30,lineHeight:1.08,letterSpacing:"-.04em",fontWeight:520,margin:"0 0 10px",color:"#15191c"}}>{mode === "signup" ? "See the market before it hits you." : "Welcome back."}</h1>
      <p style={{fontSize:14,lineHeight:1.6,color:"#697076",margin:"0 0 26px"}}>{mode === "signup" ? "Create your private workspace. RADAR will discover and continuously watch the competitive universe around your startup." : "Sign in to open your private competitive intelligence workspace."}</p>

      {notice ? <div style={{display:"flex",alignItems:"flex-start",gap:9,fontSize:12,lineHeight:1.55,padding:"11px 12px",marginBottom:14,background:notice.kind==="error"?"#f7eeee":"#f1f4f2",border:`1px solid ${notice.kind==="error"?"#ead2d2":"#dce6df"}`,borderRadius:10,color:notice.kind==="error"?"#8a3d3d":"#46564b"}}>{notice.kind==="success"?<CheckCircle2 size={16} style={{marginTop:1,flex:"0 0 auto"}}/>:null}<span>{notice.text}</span></div> : null}

      <form onSubmit={submit} style={{display:"grid",gap:14}}>
        <label style={{display:"grid",gap:6,fontSize:12,color:"#555c62"}}>Email<input autoComplete="email" type="email" required value={email} onChange={e=>setEmail(e.target.value)} style={{height:46,border:"1px solid #d7dbde",borderRadius:10,padding:"0 13px",fontSize:14,outline:"none"}}/></label>
        <label style={{display:"grid",gap:6,fontSize:12,color:"#555c62"}}>Password<input autoComplete={mode==="signup"?"new-password":"current-password"} type="password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} style={{height:46,border:"1px solid #d7dbde",borderRadius:10,padding:"0 13px",fontSize:14,outline:"none"}}/></label>
        <button disabled={busy} style={{height:46,border:0,borderRadius:10,background:"#292e32",color:"#fff",fontWeight:600,cursor:busy?"wait":"pointer",opacity:busy?.72:1}}>{busy ? "Signing in..." : mode === "signup" ? "Create private RADAR" : "Sign in"}</button>
      </form>

      {mode === "login" ? <>
        <div style={{display:"flex",alignItems:"center",gap:10,margin:"18px 0",color:"#969ca1",fontSize:11}}><span style={{height:1,background:"#e2e5e7",flex:1}}/><span>OR</span><span style={{height:1,background:"#e2e5e7",flex:1}}/></div>
        <button onClick={sendMagicLink} disabled={magicBusy} type="button" style={{width:"100%",height:46,border:"1px solid #cfd4d7",borderRadius:10,background:"#fff",color:"#30363a",fontWeight:600,cursor:magicBusy?"wait":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}><Mail size={16}/>{magicBusy?"Sending secure link...":"Email me a secure sign-in link"}</button>
      </> : null}

      <button onClick={switchMode} style={{marginTop:18,border:0,background:"transparent",padding:0,color:"#5c6368",fontSize:13,cursor:"pointer"}}>{mode === "signup" ? "Already have an account? Sign in" : "New to RADAR? Create account"}</button>
    </section>
  </main>;
}
