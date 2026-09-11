import { NextResponse } from "next/server";
import { sbUpdate } from "@/lib/radar-db";
import { workspaceForRequest } from "@/lib/radar-workspace";

export async function GET(req: Request) {
  try {
    const { workspace } = await workspaceForRequest(req, true);
    return NextResponse.json(workspace);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Workspace load failed" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { workspace } = await workspaceForRequest(req, true);
    const allowed = {
      name: body.name,
      website: body.website,
      description: body.description,
      problem_statement: body.problem_statement,
      target_customers: body.target_customers,
      buyer: body.buyer,
      product_keywords: Array.isArray(body.product_keywords) ? body.product_keywords : [],
      capability_keywords: Array.isArray(body.capability_keywords) ? body.capability_keywords : [],
      technology_keywords: Array.isArray(body.technology_keywords) ? body.technology_keywords : [],
      geography: body.geography,
      business_model: body.business_model,
      updated_at: new Date().toISOString(),
    };
    const updated = await sbUpdate("radar_workspaces", `id=eq.${workspace.id}`, allowed);
    return NextResponse.json(updated[0]);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Workspace update failed" }, { status: 500 });
  }
}
