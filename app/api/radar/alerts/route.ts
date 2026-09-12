import { NextResponse } from "next/server";
import { sbInsert, sbSelect, sbUpdate } from "@/lib/radar-db";
import { workspaceForRequest } from "@/lib/radar-workspace";

const defaults={min_impact:70,min_confidence:70,new_competitor_threshold:55,delivery_mode:"digest",email_enabled:true,include_high_threat_only:false};

export async function GET(req:Request){
  try{
    const {workspace}=await workspaceForRequest(req,true);
    const rows=await sbSelect(`radar_alert_preferences?workspace_id=eq.${workspace.id}&select=*&limit=1`);
    return NextResponse.json(rows[0]||{workspace_id:workspace.id,...defaults});
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});
    return NextResponse.json({error:error instanceof Error?error.message:"Could not load alert settings"},{status:500});
  }
}

export async function PATCH(req:Request){
  try{
    const {workspace}=await workspaceForRequest(req,true);
    const body=await req.json();
    const patch={
      min_impact:Math.max(0,Math.min(100,Number(body.min_impact??defaults.min_impact))),
      min_confidence:Math.max(0,Math.min(100,Number(body.min_confidence??defaults.min_confidence))),
      new_competitor_threshold:Math.max(0,Math.min(100,Number(body.new_competitor_threshold??defaults.new_competitor_threshold))),
      delivery_mode:["immediate","digest"].includes(String(body.delivery_mode))?String(body.delivery_mode):"digest",
      email_enabled:Boolean(body.email_enabled),
      include_high_threat_only:Boolean(body.include_high_threat_only),
      updated_at:new Date().toISOString(),
    };
    const existing=await sbSelect(`radar_alert_preferences?workspace_id=eq.${workspace.id}&select=workspace_id&limit=1`);
    const rows=existing[0]
      ? await sbUpdate("radar_alert_preferences",`workspace_id=eq.${workspace.id}`,patch)
      : await sbInsert("radar_alert_preferences",{workspace_id:workspace.id,...patch});
    return NextResponse.json(rows[0]||{workspace_id:workspace.id,...patch});
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});
    return NextResponse.json({error:error instanceof Error?error.message:"Could not save alert settings"},{status:500});
  }
}
