import { NextResponse } from "next/server";
import { sbInsert, sbSelect, sbUpdate } from "@/lib/radar-db";
import { workspaceForRequest } from "@/lib/radar-workspace";

const allowed=new Set(["useful","not_useful","not_competitor","reclassify","monitor","ignore","more_like_this","too_noisy","wrong_interpretation","wrong_fact"]);

export async function POST(req:Request){
  try{
    const {workspace}=await workspaceForRequest(req,true);
    const body=await req.json();
    const targetType=String(body.target_type||"");
    const targetId=body.target_id?String(body.target_id):null;
    const feedbackType=String(body.feedback_type||"");
    if(!allowed.has(feedbackType))return NextResponse.json({error:"Unsupported feedback"},{status:400});
    if(!["competitor","signal","recommendation","evidence"].includes(targetType))return NextResponse.json({error:"Unsupported target"},{status:400});

    if(targetId){
      const map:any={competitor:"radar_competitors",signal:"radar_signals",recommendation:"radar_recommendations",evidence:"radar_evidence"};
      const rows=await sbSelect(`${map[targetType]}?id=eq.${encodeURIComponent(targetId)}&workspace_id=eq.${workspace.id}&select=id&limit=1`);
      if(!rows[0])return NextResponse.json({error:"Feedback target not found"},{status:404});
    }

    const inserted=await sbInsert("radar_feedback",{workspace_id:workspace.id,target_type:targetType,target_id:targetId,feedback_type:feedbackType,note:body.note?String(body.note).slice(0,1000):null});

    if(targetType==="competitor"&&targetId){
      const patch:any={updated_at:new Date().toISOString()};
      if(["useful","not_useful","not_competitor","more_like_this","ignore"].includes(feedbackType))patch.user_feedback=feedbackType;
      if(feedbackType==="monitor")patch.monitoring_preference="monitor";
      if(feedbackType==="ignore"||feedbackType==="not_competitor")patch.monitoring_preference="ignore";
      if(feedbackType==="reclassify"&&body.category)patch.category=String(body.category);
      await sbUpdate("radar_competitors",`id=eq.${targetId}`,patch);
    }

    if(targetType==="signal"&&targetId&&["useful","not_useful","too_noisy","wrong_interpretation","wrong_fact"].includes(feedbackType)){
      await sbUpdate("radar_signals",`id=eq.${targetId}`,{user_feedback:feedbackType});
    }

    return NextResponse.json({ok:true,feedback:inserted[0]||null});
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});
    return NextResponse.json({error:error instanceof Error?error.message:"Feedback failed"},{status:500});
  }
}
