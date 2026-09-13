import { NextResponse } from "next/server";
import { sbInsert, sbSelect, sbUpdate } from "@/lib/radar-db";
import { generateRadarAnswer } from "@/lib/radar-ai";
import { workspaceForRequest } from "@/lib/radar-workspace";

function optionsFor(move:any){return[
  {label:"Monitor",action:"Increase monitoring around the strongest confirming indicators before committing resources.",upside:"Preserves optionality while gathering more evidence.",downside:"You may react later than a fast-moving competitor.",when_to_choose:"Confidence is still forming or the move is not yet strategically urgent."},
  {label:"Differentiate",action:"Sharpen product positioning and roadmap around the areas where your advantage is hardest to copy.",upside:"Creates a clearer reason for customers to choose you.",downside:"Can distract the team if the threat is overestimated.",when_to_choose:"Overlap is high and customers can easily compare the products."},
  {label:"Counter-move",action:"Run a focused response experiment in product, pricing, distribution or partnerships tied to this Move.",upside:"Tests a response quickly without a large irreversible bet.",downside:"Consumes execution bandwidth.",when_to_choose:"Impact is high and evidence is already strong."},
  {label:"Ignore",action:"Keep the evidence archived but take no strategic action now.",upside:"Protects focus.",downside:"Risk compounds if the Move accelerates.",when_to_choose:"The Move is weakly relevant to your customer, geography or business model."},
]}

export async function GET(req:Request){
  try{
    const {workspace}=await workspaceForRequest(req,true);
    const [decisions,moves,competitors,outcomes]=await Promise.all([
      sbSelect(`radar_decisions?workspace_id=eq.${workspace.id}&select=*&order=updated_at.desc&limit=100`),
      sbSelect(`radar_moves?workspace_id=eq.${workspace.id}&select=id,competitor_id,title,move_type,impact_score,confidence,status`),
      sbSelect(`radar_competitors?workspace_id=eq.${workspace.id}&select=id,name,website`),
      sbSelect(`radar_outcomes?workspace_id=eq.${workspace.id}&select=id,decision_id&limit=1000`),
    ]);
    const moveMap=new Map(moves.map((m:any)=>[m.id,m])),companyMap=new Map(competitors.map((c:any)=>[c.id,c]));
    const outcomeCount=new Map<string,number>();for(const o of outcomes)if(o.decision_id)outcomeCount.set(o.decision_id,(outcomeCount.get(o.decision_id)||0)+1);
    return NextResponse.json(decisions.map((d:any)=>{const m:any=d.move_id?moveMap.get(d.move_id):null;return{...d,move:m||null,competitor:m?companyMap.get(m.competitor_id)||null:null,outcome_count:outcomeCount.get(d.id)||0}}));
  }catch(error){if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});return NextResponse.json({error:error instanceof Error?error.message:"Could not load decisions"},{status:500})}
}

export async function POST(req:Request){
  try{
    const {workspace}=await workspaceForRequest(req,true);const {moveId}=await req.json();if(!moveId)return NextResponse.json({error:"Move is required"},{status:400});
    const existing=await sbSelect(`radar_decisions?workspace_id=eq.${workspace.id}&move_id=eq.${encodeURIComponent(moveId)}&status=in.(open,decided)&select=*&order=created_at.desc&limit=1`);if(existing[0])return NextResponse.json(existing[0]);
    const moves=await sbSelect(`radar_moves?id=eq.${encodeURIComponent(moveId)}&workspace_id=eq.${workspace.id}&select=*&limit=1`);const move=moves[0];if(!move)return NextResponse.json({error:"Move not found"},{status:404});
    const [competitor,signals,recommendations,evidence]=await Promise.all([
      sbSelect(`radar_competitors?id=eq.${move.competitor_id}&workspace_id=eq.${workspace.id}&select=*&limit=1`),
      sbSelect(`radar_signals?workspace_id=eq.${workspace.id}&competitor_id=eq.${move.competitor_id}&select=*&order=impact_score.desc,observed_at.desc&limit=20`),
      sbSelect(`radar_recommendations?workspace_id=eq.${workspace.id}&competitor_id=eq.${move.competitor_id}&select=*&order=created_at.desc&limit=12`),
      sbSelect(`radar_evidence?workspace_id=eq.${workspace.id}&competitor_id=eq.${move.competitor_id}&select=*&order=observed_at.desc&limit=30`),
    ]);
    const question=`Create a concise decision memo for this strategic Move: ${move.title}. State what is happening, why it matters to ${workspace.name}, the strongest uncertainty, and the most reversible response to test first. Use only stored evidence.`;
    const memo=await generateRadarAnswer({question,workspace,competitors:competitor,signals,recommendations,evidence});
    const recommendation={summary:memo||move.recommended_action||"Review the supporting evidence before acting.",expected_outcome:"Validate whether the market move materially affects your product, customer or go-to-market position.",assumptions:["The stored evidence remains current.","The competitor remains strategically relevant to this workspace."],review_days:30,evidence_that_changes_this:["A contradictory pricing, launch, customer or positioning signal.","A material shift in competitive overlap or threat score."]};
    const rows=await sbInsert("radar_decisions",{workspace_id:workspace.id,move_id:move.id,title:`Decision: ${move.title}`.slice(0,240),question:"How should we respond to this strategic move?",context:move.summary||move.rationale||"",options:optionsFor(move),recommendation,confidence:Math.max(40,Math.min(100,Number(move.confidence||60))),status:"open"});
    return NextResponse.json(rows[0],{status:201});
  }catch(error){if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});return NextResponse.json({error:error instanceof Error?error.message:"Could not generate decision"},{status:500})}
}

export async function PATCH(req:Request){
  try{
    const {workspace}=await workspaceForRequest(req,true);const {id,status,decision}=await req.json();if(!id||!["open","decided","dismissed"].includes(status))return NextResponse.json({error:"Invalid decision update"},{status:400});
    const rows=await sbSelect(`radar_decisions?id=eq.${encodeURIComponent(id)}&workspace_id=eq.${workspace.id}&select=*&limit=1`);const current=rows[0];if(!current)return NextResponse.json({error:"Decision not found"},{status:404});
    const updated=await sbUpdate("radar_decisions",`id=eq.${id}`,{status,decided_option:decision||null,decided_at:status==="decided"?new Date().toISOString():current.decided_at,updated_at:new Date().toISOString()});
    if(status==="decided"){
      const existingAction=await sbSelect(`radar_actions?decision_id=eq.${id}&workspace_id=eq.${workspace.id}&select=id&limit=1`);
      if(!existingAction[0])await sbInsert("radar_actions",{workspace_id:workspace.id,decision_id:id,move_id:current.move_id,title:`Execute: ${String(current.title||"Strategic response").replace(/^Decision:\s*/,"")}`.slice(0,240),description:String(current?.recommendation?.summary||current.context||"Execute the chosen response and record what happens.").slice(0,3000),status:"draft",priority:Math.max(50,Number(current.confidence||60)),metadata:{decision:decision||null}});
    }
    return NextResponse.json(updated[0]);
  }catch(error){if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});return NextResponse.json({error:error instanceof Error?error.message:"Could not update decision"},{status:500})}
}
