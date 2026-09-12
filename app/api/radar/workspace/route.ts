import { NextResponse } from "next/server";
import { sbInsert, sbSelect, sbUpdate } from "@/lib/radar-db";
import { workspaceForRequest } from "@/lib/radar-workspace";

export async function GET(req: Request) {
  try {
    const { workspace } = await workspaceForRequest(req, true);
    const jobs = await sbSelect(`radar_jobs?workspace_id=eq.${workspace.id}&select=*&order=created_at.desc&limit=5`);
    return NextResponse.json({...workspace, jobs});
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
      "name","website","description","industry","sub_category","problem_statement","target_customers","buyer",
      "geography","business_model","pricing_context","positioning","public_team_facts","founder_name","founder_role",
      "founder_phone","founder_country","founder_goal",
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
        allowed[key] = Array.isArray(body[key]) ? body[key].map((value: unknown) => String(value).trim()).filter(Boolean).slice(0, 40) : [];
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, "onboarding_completed")) allowed.onboarding_completed = Boolean(body.onboarding_completed);

    const incomingWebsite = typeof allowed.website === "string" ? allowed.website : workspace.website;
    const websiteChanged = Boolean(incomingWebsite && incomingWebsite !== workspace.website);
    const onboardingCompletedNow = Boolean(allowed.onboarding_completed && !workspace.onboarding_completed);
    if (websiteChanged || onboardingCompletedNow) {
      allowed.initial_scan_status = "pending";
      allowed.initial_scan_started_at = null;
      allowed.initial_scan_completed_at = null;
      allowed.initial_scan_error = null;
    }

    if (!Object.keys(allowed).length) return NextResponse.json(workspace);
    allowed.updated_at = new Date().toISOString();
    const updated = await sbUpdate("radar_workspaces", `id=eq.${workspace.id}`, allowed);
    const next = updated[0] || workspace;

    if ((websiteChanged || onboardingCompletedNow) && next.website) {
      const active = await sbSelect(`radar_jobs?workspace_id=eq.${workspace.id}&job_type=eq.initial_intelligence&status=in.(queued,running)&select=id&limit=1`);
      if (!active[0]) {
        await sbInsert("radar_jobs", {
          workspace_id: workspace.id,
          job_type: "initial_intelligence",
          status: "queued",
          priority: 100,
          payload: { website: next.website, reason: onboardingCompletedNow ? "onboarding_completed" : "website_changed" },
          current_step: "queued",
          progress: 0,
        });
      }
    }

    const jobs = await sbSelect(`radar_jobs?workspace_id=eq.${workspace.id}&select=*&order=created_at.desc&limit=5`);
    return NextResponse.json({...next, jobs});
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Workspace update failed" }, { status: 500 });
  }
}
