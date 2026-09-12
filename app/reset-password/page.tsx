"use client";

import { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, Radar } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Checking your password reset link...");
  const [error, setError] = useState(false);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    const accessToken = hash.get("access_token") || query.get("access_token") || "";
    const errorDescription = hash.get("error_description") || query.get("error_description");

    if (errorDescription) {
      setError(true);
      setMessage(errorDescription);
      return;
    }
    if (!accessToken) {
      setError(true);
      setMessage("This password reset link is invalid or has expired. Request a new one from the sign-in page.");
      return;
    }
    setToken(accessToken);
    setMessage("Choose a new password for your RADAR account.");
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError(true);
      setMessage("Use a password of at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError(true);
      setMessage("The two passwords do not match.");
      return;
    }

    setBusy(true);
    setError(false);
    try {
      const res = await fetch("/api/auth/update-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: token, password }),
      });
      const data = await res.json();
      if (!res.ok || data?.error) throw new Error(data?.error || "Could not update password.");
      window.history.replaceState({}, "", "/reset-password");
      router.replace("/login?reset=1");
      router.refresh();
    } catch (e) {
      setError(true);
      setMessage(e instanceof Error ? e.message : "Could not update password.");
    } finally {
      setBusy(false);
    }
  }

  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#e9ebed",padding:24,fontFamily:'"Avenir Next","Segoe UI",system-ui,sans-serif'}}>
    <section style={{width:"100%",maxWidth:430,background:"#fff",border:"1px solid #d8dcdf",borderRadius:18,padding:34,boxShadow:"0 24px 70px rgba(0,0,0,.08)"}}>
      <div style={{width:44,height:44,borderRadius:12,display:"grid",placeItems:"center",background:"#24292d",color:"#fff",marginBottom:26}}><Radar size={23}/></div>
      <div style={{fontSize:11,letterSpacing:".14em",color:"#70777d",marginBottom:8}}>RADAR · PASSWORD RECOVERY</div>
      <h1 style={{fontSize:30,lineHeight:1.08,letterSpacing:"-.04em",fontWeight:520,margin:"0 0 10px",color:"#15191c"}}>Set a new password.</h1>
      <p style={{fontSize:14,lineHeight:1.6,color:error?"#8a3d3d":"#697076",margin:"0 0 24px"}}>{message}</p>

      {!error || token ? <form onSubmit={submit} style={{display:"grid",gap:14}}>
        <label style={{display:"grid",gap:6,fontSize:12,color:"#555c62"}}>New password<div style={{position:"relative"}}><input type={show?"text":"password"} required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} style={{width:"100%",height:46,border:"1px solid #d7dbde",borderRadius:10,padding:"0 42px 0 13px",fontSize:14,boxSizing:"border-box"}}/><button type="button" onClick={()=>setShow(v=>!v)} style={{position:"absolute",right:10,top:0,bottom:0,border:0,background:"transparent",display:"grid",placeItems:"center",color:"#737a80",cursor:"pointer"}}>{show?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>
        <label style={{display:"grid",gap:6,fontSize:12,color:"#555c62"}}>Confirm password<input type={show?"text":"password"} required minLength={8} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} style={{height:46,border:"1px solid #d7dbde",borderRadius:10,padding:"0 13px",fontSize:14}}/></label>
        <button disabled={busy || !token} style={{height:46,border:0,borderRadius:10,background:"#292e32",color:"#fff",fontWeight:600,cursor:busy?"wait":"pointer",opacity:busy||!token?.65:1}}>{busy?"Updating password...":"Update password"}</button>
      </form> : null}
    </section>
  </main>;
}
