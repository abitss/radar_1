import { NextResponse } from "next/server";
import { ensureCompanyBrainExpansion, loadCompanyBrainExpansion } from "@/lib/radar-brain-expansion";
import { companyBrainReadiness } from "@/lib/radar-profile";
import { workspaceForRequest } from "@/lib/radar-workspace";

export async function GET(req:Request){
  try{
    const {workspace}=await workspaceForRequest(req,true);
    const readiness=companyBrainReadiness(workspace);
    const expansion=await loadCompanyBrainExpansion(workspace.id);
    return NextResponse.json({ok:true,company_brain:readiness,expansion});
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});
    return NextResponse.json({error:error instanceof Error?error.message:"Could not load Company Brain expansion"},{status:500});
  }
}

export async function POST(req:Request){
  try{
    const {workspace}=await workspaceForRequest(req,true);
    const readiness=companyBrainReadiness(workspace);
    if(!readiness.ready)return NextResponse.json({error:`Company Brain is incomplete. Missing: ${readiness.missing.join(", ")}.`,company_brain:readiness},{status:400});
    const body=await req.json().catch(()=>({}));
    const expansion=await ensureCompanyBrainExpansion(workspace,{force:body?.force!==false});
    return NextResponse.json({ok:true,company_brain:readiness,expansion});
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});
    return NextResponse.json({error:error instanceof Error?error.message:"Company Brain expansion failed"},{status:500});
  }
}
