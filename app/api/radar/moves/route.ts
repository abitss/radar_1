import { NextResponse } from "next/server";
import { sbSelect, sbUpdate } from "@/lib/radar-db";
import { detectMovesForWorkspace } from "@/lib/radar-moves";
import { workspaceForRequest } from "@/lib/radar-workspace";

export async function GET(req:Request){
  try{
    const {workspace}=await workspaceForRequest(req,true);
    const [moves,competitors,links]=await Promise.all([
      sbSelect(`radar_moves?workspace_id=eq.${workspace.id}&status=neq.dismissed&select=*&order=impact_score.desc,updated_at.desc&limit=100`),
      sbSelect(`radar_competitors?workspace_id=eq.${workspace.id}&select=id,name,website,category,threat_score`),
      sbSelect(`radar_move_signals?select=move_id,signal_id&limit=2000`),
    ]);
    const byId=new Map(competitors.map((c:any)=>[c.id,c]));
    const counts=new Map<string,number>();for(const link of links)counts.set(link.move_id,(counts.get(link.move_id)||0)+1);
    return NextResponse.json(moves.map((m:any)=>({...m,competitor:byId.get(m.competitor_id)||null,signal_count:counts.get(m.id)||0})));
  }catch(error){if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});return NextResponse.json({error:error instanceof Error?error.message:"Could not load Moves"},{status:500})}
}

export async function POST(req:Request){
  try{const {workspace}=await workspaceForRequest(req,true);const result=await detectMovesForWorkspace(workspace.id);return NextResponse.json({ok:true,...result});}
  catch(error){if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});return NextResponse.json({error:error instanceof Error?error.message:"Could not correlate Moves"},{status:500})}
}

export async function PATCH(req:Request){
  try{const {workspace}=await workspaceForRequest(req,true);const {id,status}=await req.json();if(!id||!["watching","confirmed","resolved","dismissed"].includes(status))return NextResponse.json({error:"Invalid Move update"},{status:400});const owned=await sbSelect(`radar_moves?id=eq.${encodeURIComponent(id)}&workspace_id=eq.${workspace.id}&select=id&limit=1`);if(!owned[0])return NextResponse.json({error:"Move not found"},{status:404});const rows=await sbUpdate("radar_moves",`id=eq.${id}`,{status,updated_at:new Date().toISOString()});return NextResponse.json(rows[0]);}
  catch(error){if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});return NextResponse.json({error:error instanceof Error?error.message:"Could not update Move"},{status:500})}
}
