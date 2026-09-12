import { NextResponse } from "next/server";
import { sbInsert, sbSelect } from "@/lib/radar-db";
import { workspaceForRequest } from "@/lib/radar-workspace";
import { generateRadarAnswer } from "@/lib/radar-ai";

export async function GET(req:Request){
  try{
    const {workspace}=await workspaceForRequest(req,true);
    const rows=await sbSelect(`radar_briefings?workspace_id=eq.${workspace.id}&select=*&order=created_at.desc&limit=30`);
    return NextResponse.json(rows);
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});
    return NextResponse.json({error:error instanceof Error?error.message:"Could not load briefings"},{status:500});
  }
}

export async function POST(req:Request){
  try{
    const {workspace}=await workspaceForRequest(req,true);
    const body=await req.json().catch(()=>({}));
    const period=["daily","weekly","monthly"].includes(String(body.period))?String(body.period):"weekly";
    const [competitors,signals,recommendations,evidence]=await Promise.all([
      sbSelect(`radar_competitors?workspace_id=eq.${workspace.id}&select=*&order=threat_score.desc&limit=20`),
      sbSelect(`radar_signals?workspace_id=eq.${workspace.id}&select=*&order=observed_at.desc&limit=40`),
      sbSelect(`radar_recommendations?workspace_id=eq.${workspace.id}&select=*&order=created_at.desc&limit=30`),
      sbSelect(`radar_evidence?workspace_id=eq.${workspace.id}&select=*&order=observed_at.desc&limit=60`),
    ]);
    const question=`Create a ${period} founder competitive-intelligence briefing. Use only supplied evidence. Structure it as: Executive summary; Important changes; New or emerging competitors; Market themes; Recommended founder actions; Confidence / evidence gaps. Keep it concise and decision-ready.`;
    const ai=await generateRadarAnswer({question,workspace,competitors,signals,recommendations,evidence});
    const content=ai||[
      signals[0]?.title?`Executive summary: ${signals[0].title}`:"Executive summary: No major new market movement has been verified.",
      recommendations[0]?.action?`Recommended action: ${recommendations[0].action}`:"Recommended action: Continue monitoring while RADAR gathers stronger evidence.",
    ].join("\n\n");
    const now=new Date();
    const created=await sbInsert("radar_briefings",{workspace_id:workspace.id,period,title:`${period[0].toUpperCase()+period.slice(1)} founder briefing · ${now.toLocaleDateString("en-GB")}`,content,evidence_count:evidence.length,generated_by:ai?"grounded-ai":"evidence-fallback",period_end:now.toISOString()});
    return NextResponse.json(created[0],{status:201});
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});
    return NextResponse.json({error:error instanceof Error?error.message:"Could not generate briefing"},{status:500});
  }
}
