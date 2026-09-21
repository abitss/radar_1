import { NextResponse } from "next/server";
import { sbSelect, sbUpdate } from "@/lib/radar-db";
import { workspaceForRequest } from "@/lib/radar-workspace";

export async function GET(req:Request){
  try{const {workspace}=await workspaceForRequest(req,true);const [actions,decisions,moves]=await Promise.all([
    sbSelect(`radar_actions?workspace_id=eq.${workspace.id}&select=*&order=priority.desc,created_at.desc&limit=100`),
    sbSelect(`radar_decisions?workspace_id=eq.${workspace.id}&select=id,title,status`),
    sbSelect(`radar_moves?workspace_id=eq.${workspace.id}&select=id,title,move_type,impact_score`),
  ]);const dm=new Map(decisions.map((d:any)=>[d.id,d])),mm=new Map(moves.map((m:any)=>[m.id,m]));return NextResponse.json(actions.map((a:any)=>({...a,decision:a.decision_id?dm.get(a.decision_id)||null:null,move:a.move_id?mm.get(a.move_id)||null:null})));}
  catch(error){if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});return NextResponse.json({error:error instanceof Error?error.message:"Could not load actions"},{status:500})}
}

export async function PATCH(req:Request){
  try{const {workspace}=await workspaceForRequest(req,true);const {id,status,owner,due_at}=await req.json();if(!id)return NextResponse.json({error:"Action is required"},{status:400});if(status&&!["draft","active","completed","cancelled"].includes(status))return NextResponse.json({error:"Invalid action status"},{status:400});const current=await sbSelect(`radar_actions?id=eq.${encodeURIComponent(id)}&workspace_id=eq.${workspace.id}&select=*&limit=1`);if(!current[0])return NextResponse.json({error:"Action not found"},{status:404});const patch:any={updated_at:new Date().toISOString()};if(status){patch.status=status;if(status==="completed")patch.completed_at=new Date().toISOString()}if(owner!==undefined)patch.owner=owner||null;if(due_at!==undefined)patch.due_at=due_at||null;const rows=await sbUpdate("radar_actions",`id=eq.${id}`,patch);return NextResponse.json(rows[0]);}
  catch(error){if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});return NextResponse.json({error:error instanceof Error?error.message:"Could not update action"},{status:500})}
}
