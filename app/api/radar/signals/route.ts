import { NextResponse } from "next/server";
import { sbSelect, sbUpdate } from "@/lib/radar-db";
import { workspaceForRequest } from "@/lib/radar-workspace";

function tokens(text:any){return new Set(String(text||"").toLowerCase().replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(x=>x.length>3))}
function overlap(a:any,b:any){const A=tokens(a),B=tokens(b);if(!A.size||!B.size)return 0;let both=0;for(const x of A)if(B.has(x))both++;return both/Math.max(1,Math.min(A.size,B.size))}
function sortByDistance(signal:any,evidence:any){const st=new Date(signal.observed_at||signal.created_at||0).getTime();const et=new Date(evidence.observed_at||evidence.created_at||0).getTime();const time=Math.abs(st-et);const text=Math.max(overlap(signal.title,evidence.title),overlap(signal.summary,evidence.fact),overlap(signal.summary,evidence.summary));return time-(text*6*60*60*1000)}

export async function GET(req: Request) {
  try {
    const { workspace } = await workspaceForRequest(req, true);
    const [signals,competitors,evidence,links,moves] = await Promise.all([
      sbSelect(`radar_signals?workspace_id=eq.${workspace.id}&select=*&order=observed_at.desc&limit=250`),
      sbSelect(`radar_competitors?workspace_id=eq.${workspace.id}&select=id,name,website,category,similarity_score,product_overlap_score,threat_score,movement,monitoring_preference`),
      sbSelect(`radar_evidence?workspace_id=eq.${workspace.id}&select=id,competitor_id,source_url,source_type,title,fact,summary,confidence,claim_type,observed_at,created_at&order=observed_at.desc&limit=2500`),
      sbSelect(`radar_move_signals?select=move_id,signal_id,contribution&limit=5000`).catch(()=>[]),
      sbSelect(`radar_moves?workspace_id=eq.${workspace.id}&select=id,competitor_id,title,move_type,summary,confidence,impact_score,status,updated_at&limit=500`).catch(()=>[]),
    ]);
    const byId = new Map(competitors.map((c:any)=>[c.id,c]));
    const moveById=new Map(moves.map((m:any)=>[m.id,m]));
    const linksBySignal=new Map<string,any[]>();
    for(const link of links){if(!link.signal_id)continue;const list=linksBySignal.get(link.signal_id)||[];list.push(link);linksBySignal.set(link.signal_id,list)}
    const evidenceByCompetitor=new Map<string,any[]>();
    for(const e of evidence){const key=String(e.competitor_id||"");if(!key)continue;const list=evidenceByCompetitor.get(key)||[];list.push(e);evidenceByCompetitor.set(key,list)}

    return NextResponse.json(signals.map((s:any)=>{
      const competitor=s.competitor_id?byId.get(s.competitor_id)||null:null;
      const linkedMoves=(linksBySignal.get(s.id)||[]).map((link:any)=>{const move:any=moveById.get(link.move_id);return move?{...move,contribution:Number(link.contribution||0)}:null}).filter(Boolean).sort((a:any,b:any)=>Number(b.contribution||0)-Number(a.contribution||0));
      const candidates=(evidenceByCompetitor.get(String(s.competitor_id||""))||[]).filter((e:any)=>Math.abs(new Date(e.observed_at||e.created_at||0).getTime()-new Date(s.observed_at||s.created_at||0).getTime())<=7*24*60*60*1000);
      const supporting=[...candidates].sort((a:any,b:any)=>sortByDistance(s,a)-sortByDistance(s,b)).slice(0,4);
      return{
        ...s,
        competitor,
        ignored_competitor:Boolean(competitor?.monitoring_preference==="ignore"),
        moves:linkedMoves,
        move_count:linkedMoves.length,
        evidence:supporting,
        evidence_count:supporting.length,
        best_source_url:supporting.find((e:any)=>e.source_url)?.source_url||null,
      };
    }));
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error:"Unauthorized" },{status:401});
    return NextResponse.json({ error:error instanceof Error?error.message:"Signals failed" },{status:500});
  }
}

export async function PATCH(req:Request){
  try{
    const {workspace}=await workspaceForRequest(req,true);
    const body=await req.json().catch(()=>({}));
    const id=String(body.id||"");
    const status=String(body.status||"");
    if(!id||!["new","reviewed","archived"].includes(status))return NextResponse.json({error:"Invalid signal update"},{status:400});
    const current=(await sbSelect(`radar_signals?id=eq.${encodeURIComponent(id)}&workspace_id=eq.${workspace.id}&select=id,status&limit=1`))[0];
    if(!current)return NextResponse.json({error:"Signal not found"},{status:404});
    const patch:any={status,updated_at:new Date().toISOString()};
    if(status==="reviewed")patch.reviewed_at=new Date().toISOString();
    if(status==="new")patch.reviewed_at=null;
    const rows=await sbUpdate("radar_signals",`id=eq.${id}&workspace_id=eq.${workspace.id}`,patch);
    return NextResponse.json(rows[0]||null);
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});
    return NextResponse.json({error:error instanceof Error?error.message:"Could not update signal"},{status:500});
  }
}
