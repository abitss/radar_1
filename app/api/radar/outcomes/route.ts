import { NextResponse } from "next/server";
import { sbInsert, sbSelect, sbUpdate } from "@/lib/radar-db";
import { workspaceForRequest } from "@/lib/radar-workspace";

export async function GET(req:Request){
  try{const {workspace}=await workspaceForRequest(req,true);const [outcomes,actions,decisions]=await Promise.all([
    sbSelect(`radar_outcomes?workspace_id=eq.${workspace.id}&select=*&order=measured_at.desc&limit=100`),
    sbSelect(`radar_actions?workspace_id=eq.${workspace.id}&select=id,title,status`),
    sbSelect(`radar_decisions?workspace_id=eq.${workspace.id}&select=id,title,status`),
  ]);const am=new Map(actions.map((a:any)=>[a.id,a])),dm=new Map(decisions.map((d:any)=>[d.id,d]));return NextResponse.json(outcomes.map((o:any)=>({...o,action:o.action_id?am.get(o.action_id)||null:null,decision:o.decision_id?dm.get(o.decision_id)||null:null})));}
  catch(error){if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});return NextResponse.json({error:error instanceof Error?error.message:"Could not load outcomes"},{status:500})}
}

export async function POST(req:Request){
  try{const {workspace}=await workspaceForRequest(req,true);const {decisionId,actionId,result,impact,assessment}=await req.json();if(!decisionId||!result)return NextResponse.json({error:"Decision and result are required"},{status:400});const decision=await sbSelect(`radar_decisions?id=eq.${encodeURIComponent(decisionId)}&workspace_id=eq.${workspace.id}&select=id&limit=1`);if(!decision[0])return NextResponse.json({error:"Decision not found"},{status:404});if(actionId){const action=await sbSelect(`radar_actions?id=eq.${encodeURIComponent(actionId)}&workspace_id=eq.${workspace.id}&select=id&limit=1`);if(!action[0])return NextResponse.json({error:"Action not found"},{status:404});}
    const rows=await sbInsert("radar_outcomes",{workspace_id:workspace.id,action_id:actionId||null,decision_id:decisionId,result:String(result).slice(0,1500),impact:impact==null?null:Math.max(0,Math.min(100,Number(impact))),assessment:assessment?String(assessment).slice(0,2000):null});
    await sbUpdate("radar_decisions",`id=eq.${decisionId}`,{status:"decided",updated_at:new Date().toISOString()});
    if(actionId)await sbUpdate("radar_actions",`id=eq.${actionId}`,{status:"completed",completed_at:new Date().toISOString(),updated_at:new Date().toISOString()});
    return NextResponse.json(rows[0],{status:201});}
  catch(error){if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});return NextResponse.json({error:error instanceof Error?error.message:"Could not record outcome"},{status:500})}
}
