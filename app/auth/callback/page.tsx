"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Radar } from "lucide-react";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Verifying secure sign-in link...");

  useEffect(() => {
    async function finish() {
      try {
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const query = new URLSearchParams(window.location.search);
        const accessToken = hash.get("access_token") || query.get("access_token");
        const errorDescription = hash.get("error_description") || query.get("error_description");
        if (errorDescription) throw new Error(errorDescription);
        if (!accessToken) throw new Error("This sign-in link is invalid or has expired.");

        const res = await fetch("/api/auth/session-from-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken }),
        });
        const data = await res.json();
        if (!res.ok || data?.error) throw new Error(data?.error || "Could not create RADAR session.");

        window.history.replaceState({}, "", "/auth/callback");
        router.replace("/onboarding");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Secure sign-in failed.");
      }
    }
    finish();
  }, [router]);

  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#e9ebed",padding:24,fontFamily:'"Avenir Next","Segoe UI",system-ui,sans-serif'}}>
    <section style={{width:"100%",maxWidth:430,background:"#fff",border:"1px solid #d8dcdf",borderRadius:18,padding:34,boxShadow:"0 24px 70px rgba(0,0,0,.08)"}}>
      <div style={{width:44,height:44,borderRadius:12,display:"grid",placeItems:"center",background:"#24292d",color:"#fff",marginBottom:26}}><Radar size={23}/></div>
      <div style={{fontSize:11,letterSpacing:".14em",color:"#70777d",marginBottom:8}}>RADAR · SECURE SIGN-IN</div>
      <h1 style={{fontSize:28,lineHeight:1.08,letterSpacing:"-.04em",fontWeight:520,margin:"0 0 10px",color:"#15191c"}}>Opening your private RADAR.</h1>
      <p style={{fontSize:14,lineHeight:1.6,color:"#697076",margin:0}}>{message}</p>
    </section>
  </main>;
}
