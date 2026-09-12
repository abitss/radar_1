"use client";

import { useEffect } from "react";
import { RefreshCw, ShieldAlert } from "lucide-react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("RADAR page error", error); }, [error]);
  return <div className="content"><div className="panel founder-panel" style={{maxWidth:720,margin:"56px auto",padding:28}}>
    <ShieldAlert size={24}/>
    <span className="tiny-label" style={{display:"block",marginTop:14}}>RADAR RECOVERY</span>
    <h1 style={{margin:"8px 0 10px",fontSize:28}}>Something interrupted this view.</h1>
    <p style={{color:"#697076",lineHeight:1.6}}>Your workspace data is stored separately and has not been erased. Retry the view. If the problem continues, sign out and back in before rebuilding anything.</p>
    <button className="primary-button" onClick={reset} style={{marginTop:10}}><RefreshCw size={14}/> Retry</button>
  </div></div>;
}
