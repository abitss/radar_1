import { NextResponse } from "next/server";
import { sbInsert, sbSelect, sbUpdate } from "@/lib/radar-db";
import { workspaceForRequest } from "@/lib/radar-workspace";
import { isOfficialCompanyWebsite, radarDomain, radarOrigin } from "@/lib/radar-discovery-quality";

export async function PATCH(req:Request, context:{params:Promise<{id:string}>}){
  try{
    const {workspace}=await workspaceForRequest(req,true);
    const {id}=await context.params;
    const body=await req.json();
    const action=String(body.action||"");
    const rows=await sbSelect(`radar_candidates?id=eq.${encodeURIComponent(id)}&workspace_id=eq.${workspace.id}&select=*&limit=1`);
    const candidate=rows[0];
    if(!candidate)return NextResponse.json({error:"Candidate not found"},{status:404});

    if(action==="reject"||action==="ignore"){
      const updated=await sbUpdate("radar_candidates",`id=eq.${candidate.id}`,{status:action==="reject"?"rejected":"ignored",updated_at:new Date().toISOString()});
      return NextResponse.json({ok:true,candidate:updated[0]||candidate});
    }

    if(action==="approve"){
      if(candidate.entity_type==="source")return NextResponse.json({error:"This row is an evidence source, not a company. Resolve a real company before promotion."},{status:400});
      const rawWebsite=String(candidate.official_website||candidate.url||"");
      const website=radarOrigin(rawWebsite);
      const domain=radarDomain(website);
      if(!domain||!isOfficialCompanyWebsite(website,candidate.source_page_url||candidate.url||"","company"))return NextResponse.json({error:"A verified official company website is required before promotion."},{status:400});
      const ownDomain=radarDomain(workspace.website||"");
      if(ownDomain&&domain===ownDomain)return NextResponse.json({error:"Your own startup cannot be promoted as a competitor."},{status:400});

      const existing=await sbSelect(`radar_competitors?workspace_id=eq.${workspace.id}&website=eq.${encodeURIComponent(website)}&select=*&limit=1`);
      let competitor=existing[0]||null;
      const similarity=Math.max(0,Math.min(100,Math.round(Number(candidate.provisional_score||0))));
      const productOverlap=Math.max(0,Math.min(100,Math.round(Number(candidate.product_overlap_score||0))));
      const relationConfidence=Math.max(0,Math.min(100,Math.round(Number(candidate.relation_confidence||0))));
      const threat=Math.min(100,Math.round(productOverlap*.42+similarity*.43+35*.15));
      if(!competitor){
        try{
          const created=await sbInsert("radar_competitors",{
            workspace_id:workspace.id,
            name:String(candidate.title||domain).trim().slice(0,100),
            website,
            description:candidate.related_product||candidate.description||null,
            category:productOverlap>=75&&similarity>=60?"direct":productOverlap>=50||similarity>=50?"adjacent":productOverlap>=28||similarity>=28?"substitute":"emerging",
            similarity_score:similarity,
            product_overlap_score:productOverlap,
            relation_confidence:relationConfidence,
            threat_score:threat,
            momentum_score:35,
            movement:"stable",
            monitoring_preference:"monitor",
            related_product:candidate.related_product||null,
            relationship_reason:candidate.relationship_reason||candidate.description||null,
            discovery_source_url:candidate.source_page_url||candidate.url||null,
            why_it_matters:`Founder-approved competitor. ${candidate.related_product?`${candidate.title} makes ${candidate.related_product}. `:""}${candidate.relationship_reason||"RADAR found relevant product overlap."} Product overlap ${productOverlap}%; discovery confidence ${relationConfidence}%.`,
          });
          competitor=created[0]||null;
        }catch{
          const retry=await sbSelect(`radar_competitors?workspace_id=eq.${workspace.id}&website=eq.${encodeURIComponent(website)}&select=*&limit=1`).catch(()=>[]);
          competitor=retry[0]||null;
          if(!competitor)throw new Error("Competitor promotion failed.");
        }
      }
      if(competitor&&competitor.monitoring_preference!=="monitor"){
        const updated=await sbUpdate("radar_competitors",`id=eq.${competitor.id}`,{monitoring_preference:"monitor",updated_at:new Date().toISOString()});
        competitor=updated[0]||competitor;
      }
      const updatedCandidate=await sbUpdate("radar_candidates",`id=eq.${candidate.id}`,{status:"promoted",official_website:website,url:website,domain,updated_at:new Date().toISOString()});
      return NextResponse.json({ok:true,competitor,candidate:updatedCandidate[0]||candidate});
    }

    return NextResponse.json({error:"Unsupported candidate action"},{status:400});
  }catch(error){
    if(error instanceof Error&&error.message==="UNAUTHORIZED")return NextResponse.json({error:"Unauthorized"},{status:401});
    return NextResponse.json({error:error instanceof Error?error.message:"Candidate action failed"},{status:500});
  }
}
