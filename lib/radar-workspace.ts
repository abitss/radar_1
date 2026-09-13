import { timingSafeEqual } from "crypto";
import { requireRadarUser } from "@/lib/radar-auth";
import { sbInsert, sbSelect } from "@/lib/radar-db";

function safeEqual(a:string,b:string){
  if(!a||!b)return false;
  const aa=Buffer.from(a),bb=Buffer.from(b);
  return aa.length===bb.length&&timingSafeEqual(aa,bb);
}

export async function workspaceForRequest(req: Request, create = true) {
  const systemWorkspaceId=req.headers.get("x-radar-system-workspace")||"";
  const suppliedSecret=req.headers.get("x-radar-api-key")||"";
  const expectedSecret=process.env.RADAR_API_SECRET||"";

  if(systemWorkspaceId&&safeEqual(suppliedSecret,expectedSecret)){
    const rows=await sbSelect(`radar_workspaces?id=eq.${encodeURIComponent(systemWorkspaceId)}&select=*&limit=1`);
    const workspace=rows[0]||null;
    if(!workspace)throw new Error("WORKSPACE_NOT_FOUND");
    return {user:{id:workspace.owner_id,email:null,system:true},workspace};
  }

  const user = await requireRadarUser(req);
  const rows = await sbSelect(`radar_workspaces?owner_id=eq.${encodeURIComponent(user.id)}&select=*&order=created_at.asc&limit=1`);
  if (rows[0] || !create) return { user, workspace: rows[0] || null };

  const created = await sbInsert("radar_workspaces", {
    owner_id: user.id,
    name: "My startup",
    product_keywords: [],
    capability_keywords: [],
    technology_keywords: [],
  });
  return { user, workspace: created[0] };
}
