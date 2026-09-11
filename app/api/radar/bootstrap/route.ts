import { NextResponse } from "next/server";
import { scrapeCompanyProfile } from "@/lib/firecrawl";
import { sbUpdate } from "@/lib/radar-db";
import { workspaceForRequest } from "@/lib/radar-workspace";

function normalizeUrl(raw: string) {
  const input = raw.trim();
  const value = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Use a public website URL.");
  return url.origin;
}

export async function POST(req: Request) {
  try {
    const { workspace } = await workspaceForRequest(req, true);
    const body = await req.json();
    const website = normalizeUrl(String(body.website || ""));
    const scraped = await scrapeCompanyProfile(website);
    const profile = scraped?.json || scraped?.data?.json || {};
    const name = String(profile.company_name || new URL(website).hostname.replace(/^www\./, "").split(".")[0] || "My startup");
    const updated = await sbUpdate("radar_workspaces", `id=eq.${workspace.id}`, {
      name,
      website,
      description: profile.one_line_description || "",
      problem_statement: profile.problem_statement || "",
      target_customers: profile.target_customers || "",
      buyer: profile.buyer || "",
      product_keywords: Array.isArray(profile.product_keywords) ? profile.product_keywords.slice(0, 12) : [],
      capability_keywords: Array.isArray(profile.capability_keywords) ? profile.capability_keywords.slice(0, 16) : [],
      technology_keywords: Array.isArray(profile.technology_keywords) ? profile.technology_keywords.slice(0, 12) : [],
      geography: profile.geography || "",
      business_model: profile.business_model || "",
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, workspace: updated[0], source: website });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not understand startup website" }, { status: 500 });
  }
}
