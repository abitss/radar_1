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
    const allowed: Record<string, unknown> = {};

    const textFields = [
      "name",
      "website",
      "description",
      "industry",
      "sub_category",
      "problem_statement",
      "target_customers",
      "buyer",
      "geography",
      "business_model",
      "pricing_context",
      "positioning",
      "public_team_facts",
      "founder_name",
      "founder_role",
      "founder_phone",
      "founder_country",
      "founder_goal",
    ] as const;
    for (const key of textFields) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        const value = body[key] == null ? null : String(body[key]).trim();
        const max = key === "founder_goal" || key === "public_team_facts" ? 1000 : key === "problem_statement" || key === "positioning" ? 700 : 300;
        allowed[key] = typeof value === "string" ? value.slice(0, max) : value;
      }
    }

    const arrayFields = ["product_keywords", "capability_keywords", "technology_keywords", "major_features"] as const;
    for (const key of arrayFields) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        allowed[key] = Array.isArray(body[key])
          ? body[key].map((value: unknown) => String(value).trim()).filter(Boolean).slice(0, 40)
          : [];
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, "onboarding_completed")) {
      allowed.onboarding_completed = Boolean(body.onboarding_completed);
    }

    if (!Object.keys(allowed).length) return NextResponse.json(workspace);
    allowed.updated_at = new Date().toISOString();
    const updated = await sbUpdate("radar_workspaces", `id=eq.${workspace.id}`, allowed);
    return NextResponse.json(updated[0] || workspace);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Workspace update failed" }, { status: 500 });
  }
}
