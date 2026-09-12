import { requireRadarUser } from "@/lib/radar-auth";
import { sbInsert, sbSelect } from "@/lib/radar-db";

export async function workspaceForRequest(req: Request, create = true) {
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
