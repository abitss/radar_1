import { NextResponse } from "next/server";
import { sbSelect } from "@/lib/radar-db";
import { workspaceForRequest } from "@/lib/radar-workspace";

export async function POST(req: Request) {
  try {
    const { workspace } = await workspaceForRequest(req, true);
    const { question } = await req.json();
    const q = String(question || "").trim().toLowerCase();
    if (!q) return NextResponse.json({ error:"Ask a question about your competitive landscape." },{status:400});

    const [competitors,signals,recommendations,evidence] = await Promise.all([
      sbSelect(`radar_competitors?workspace_id=eq.${workspace.id}&select=*&order=similarity_score.desc&limit=25`),
      sbSelect(`radar_signals?workspace_id=eq.${workspace.id}&select=*&order=observed_at.desc&limit=25`),
      sbSelect(`radar_recommendations?workspace_id=eq.${workspace.id}&select=*&order=created_at.desc&limit=25`),
      sbSelect(`radar_evidence?workspace_id=eq.${workspace.id}&select=id,competitor_id,source_url,title,fact,confidence,observed_at&order=observed_at.desc&limit=50`),
    ]);

    const open = recommendations.filter((r:any)=>r.status==="open");
    const moving = competitors.filter((c:any)=>c.movement==="closer").sort((a:any,b:any)=>Number(b.threat_score||0)-Number(a.threat_score||0));
    const top = competitors[0];
    const latest = signals[0];
    let answer = "";
    let refs:any[] = [];

    if (/biggest|closest|main competitor|top competitor|most similar/.test(q)) {
      if (!top) answer = "RADAR has not discovered enough competitor evidence yet. Run market discovery first.";
      else {
        answer = `${top.name} is currently the closest mapped competitor at ${Math.round(Number(top.similarity_score||0))}% similarity and ${Math.round(Number(top.threat_score||0))}% threat. ${top.why_it_matters||""}`;
        refs = evidence.filter((e:any)=>e.competitor_id===top.id).slice(0,4);
      }
    } else if (/moving|closer|converg|approach/.test(q)) {
      if (!moving.length) answer = "No tracked company is currently marked as moving closer. That can change when new scans or monitor events arrive.";
      else { const c=moving[0]; answer=`${c.name} is the strongest current convergence signal. Its latest mapped similarity is ${Math.round(Number(c.similarity_score||0))}% with ${Math.round(Number(c.threat_score||0))}% threat. ${c.why_it_matters||""}`; refs=evidence.filter((e:any)=>e.competitor_id===c.id).slice(0,4); }
    } else if (/what.*do|should.*do|decision|priority|next/.test(q)) {
      if (!open.length) answer = "RADAR has no open evidence-backed recommendation right now. Keep monitoring active rather than manufacturing a decision.";
      else { const r=open[0]; const c=competitors.find((x:any)=>x.id===r.competitor_id); answer=`Highest-priority open recommendation: ${r.title}. ${r.rationale||""} Recommended action: ${r.action}${c?` Linked competitor: ${c.name}.`:""}`; refs=evidence.filter((e:any)=>e.competitor_id===r.competitor_id).slice(0,4); }
    } else if (/new|today|changed|latest|this week/.test(q)) {
      if (!latest) answer = "No meaningful market change has been stored yet. RADAR will only populate this when a scan or continuous monitor finds relevant evidence.";
      else { const c=competitors.find((x:any)=>x.id===latest.competitor_id); answer=`Latest meaningful signal: ${latest.title}. ${latest.summary||""}${c?` It is linked to ${c.name}.`:""}`; refs=evidence.filter((e:any)=>!latest.competitor_id||e.competitor_id===latest.competitor_id).slice(0,4); }
    } else {
      const pieces=[];
      if(top) pieces.push(`Closest competitor: ${top.name} at ${Math.round(Number(top.similarity_score||0))}% similarity.`);
      if(latest) pieces.push(`Latest signal: ${latest.title}.`);
      if(open[0]) pieces.push(`Current recommendation: ${open[0].title}. ${open[0].action}`);
      answer = pieces.length?pieces.join(" "):"RADAR does not have enough evidence yet. Complete onboarding and let discovery build your competitive graph.";
      refs=evidence.slice(0,4);
    }

    return NextResponse.json({ answer, evidence:refs.map((e:any)=>({ title:e.title, url:e.source_url, fact:e.fact, confidence:e.confidence })) });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error:"Unauthorized" },{status:401});
    return NextResponse.json({ error:error instanceof Error?error.message:"Ask RADAR failed" },{status:500});
  }
}
