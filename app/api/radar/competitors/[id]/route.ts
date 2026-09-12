import { NextResponse } from "next/server";
import { sbDelete, sbSelect, sbUpdate } from "@/lib/radar-db";
import { workspaceForRequest } from "@/lib/radar-workspace";

const categories=new Set(["direct","adjacent","substitute","emerging","incumbent","watchlist","micro"]);

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { workspace } = await workspaceForRequest(req, true);
    const { id } = await context.params;
    const rows = await sbSelect(`radar_competitors?id=eq.${encodeURIComponent(id)}&workspace_id=eq.${workspace.id}&select=*&limit=1`);
    const competitor = rows[0];
    if (!competitor) return NextResponse.json({ error: "Competitor not found" }, { status: 404 });
    const [dimensions,evidence,signals,recommendations,monitors] = await Promise.all([
      sbSelect(`radar_similarity_dimensions?competitor_id=eq.${competitor.id}&select=*&limit=1`),
      sbSelect(`radar_evidence?workspace_id=eq.${workspace.id}&competitor_id=eq.${competitor.id}&select=*&order=observed_at.desc&limit=50`),
      sbSelect(`radar_signals?workspace_id=eq.${workspace.id}&competitor_id=eq.${competitor.id}&select=*&order=observed_at.desc&limit=30`),
      sbSelect(`radar_recommendations?workspace_id=eq.${workspace.id}&competitor_id=eq.${competitor.id}&select=*&order=created_at.desc&limit=20`),
      sbSelect(`radar_monitors?workspace_id=eq.${workspace.id}&competitor_id=eq.${competitor.id}&select=*&order=created_at.desc&limit=10`),
    ]);
    return NextResponse.json({ competitor, dimensions: dimensions[0] || null, evidence, signals, recommendations, monitors });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error:"Unauthorized" },{status:401});
    return NextResponse.json({ error:error instanceof Error?error.message:"Dossier failed" },{status:500});
  }
}

export async function PATCH(req:Request,context:{params:Promise<{id:string}>}){
  try{
    const {workspace}=await workspaceForRequest(req,true);
    const {id}=await context.params;
    const rows=await sbSelect(`radar_competitors?id=eq.${encodeURIComponent(id)}&workspace_id=eq.${workspace.id}&select=id&limit=1`);
    if(!rows[0])return NextResponse.json({error:"Competitor not found"},{status:404});
    const body=await req.json();
    const patch:any={updated_at:new Date().toISOString()};
    if(body.category){const category=String(body.category);if(!categories.has(category))return NextResponse.json({error:"Invalid category"},{status:400});patch.category=category;}
    if(body.monitoring_preference){const pref=String(body.monitoring_preference);if(!["monitor","ignore","neutral"].includes(pref))return NextResponse.json({error:"Invalid monitoring preference"},{status:400});patch.monitoring_preference=pref;}
    if(body.user_feedback)patch.user_feedback=String(body.user_feedback).slice(0,80);
    const updated=await sbUpdate("radar_competitors",`id=eq.${id}&workspace_id=eq.${workspace.id}`,patch);
    return NextResponse.json(updated[0]||null);
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});
    return NextResponse.json({error:error instanceof Error?error.message:"Competitor update failed"},{status:500});
  }
}

export async function DELETE(req:Request,context:{params:Promise<{id:string}>}){
  try{
    const {workspace}=await workspaceForRequest(req,true);
    const {id}=await context.params;
    const rows=await sbSelect(`radar_competitors?id=eq.${encodeURIComponent(id)}&workspace_id=eq.${workspace.id}&select=id&limit=1`);
    if(!rows[0])return NextResponse.json({error:"Competitor not found"},{status:404});
    await Promise.all([
      sbDelete("radar_monitors",`workspace_id=eq.${workspace.id}&competitor_id=eq.${id}`),
      sbDelete("radar_similarity_dimensions",`competitor_id=eq.${id}`),
      sbDelete("radar_recommendations",`workspace_id=eq.${workspace.id}&competitor_id=eq.${id}`),
      sbDelete("radar_signals",`workspace_id=eq.${workspace.id}&competitor_id=eq.${id}`),
      sbDelete("radar_evidence",`workspace_id=eq.${workspace.id}&competitor_id=eq.${id}`),
    ]);
    await sbDelete("radar_competitors",`id=eq.${id}&workspace_id=eq.${workspace.id}`);
    return NextResponse.json({ok:true});
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});
    return NextResponse.json({error:error instanceof Error?error.message:"Competitor removal failed"},{status:500});
  }
}
