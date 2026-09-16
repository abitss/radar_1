import { NextResponse } from "next/server";
import { radarEngineAIStatus, radarEngineOpenRouterHealth, radarEngineText } from "@/lib/radar-engine-ai";
import { workspaceForRequest } from "@/lib/radar-workspace";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(req:Request){
  try{
    await workspaceForRequest(req,true);
    const status=radarEngineAIStatus();
    const openrouter=status.openrouter_key_present?await radarEngineOpenRouterHealth():null;
    return NextResponse.json({ok:true,...status,openrouter});
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});
    return NextResponse.json({error:error instanceof Error?error.message:"AI status failed"},{status:500});
  }
}

export async function POST(req:Request){
  try{
    await workspaceForRequest(req,true);
    const status=radarEngineAIStatus();
    if(!status.configured)return NextResponse.json({ok:false,...status,error:"No RADAR AI provider is configured"},{status:503});
    const openrouter=status.openrouter_key_present?await radarEngineOpenRouterHealth():null;
    const result=await radarEngineText("Return exactly: RADAR_AI_OK",{feature:"health_check",maxTokens:32,temperature:0});
    return NextResponse.json({ok:result.text.includes("RADAR_AI_OK"),provider:result.provider,model:result.model,live_web:status.live_web,openrouter});
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:"AI health check failed"},{status:500});
  }
}
