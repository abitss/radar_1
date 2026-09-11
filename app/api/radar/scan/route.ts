import { NextResponse } from "next/server";
import { sbInsert, sbSelect, sbUpdate } from "@/lib/radar-db";
import { searchWeb } from "@/lib/firecrawl";
import { workspaceForRequest } from "@/lib/radar-workspace";

function normalizeTerms(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).flatMap(x => x.split(/[,;|]/)).map(x => x.trim().toLowerCase()).filter(x => x.length > 2);
  return String(value || "").split(/[,;|\n]/).map(x => x.trim().toLowerCase()).filter(x => x.length > 2);
}
function termScore(text: string, terms: string[]) {
  const unique = [...new Set(terms)];
  if (!unique.length) return 0;
  return Math.round((unique.filter(term => text.includes(term)).length / unique.length) * 100);
}
function classify(score: number) {
  if (score >= 80) return "direct";
  if (score >= 55) return "adjacent";
  if (score >= 30) return "micro";
  return "emerging";
}
function domainOf(raw: string) {
  try { return new URL(raw).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; }
}

export async function POST(req: Request) {
  try {
    const { workspace } = await workspaceForRequest(req, true);
    const { competitorId } = await req.json();
    const competitors = await sbSelect(`radar_competitors?id=eq.${encodeURIComponent(competitorId)}&workspace_id=eq.${workspace.id}&select=*`);
    const competitor = competitors[0];
    if (!competitor?.website) return NextResponse.json({ error: "Competitor not found in this workspace." }, { status: 404 });
    const domain = domainOf(competitor.website);
    if (!domain) return NextResponse.json({ error: "Competitor website is invalid." }, { status: 400 });

    const run = (await sbInsert("radar_scan_runs", { workspace_id: workspace.id, competitor_id: competitor.id, run_type: "deep_public_scan", status: "running" }))[0];
    const pageQueries = [
      `site:${domain} product OR platform OR solution`,
      `site:${domain} pricing OR plans`,
      `site:${domain} careers OR jobs OR hiring`,
      `site:${domain} docs OR documentation OR changelog OR release`,
      `site:${domain} customers OR case studies OR integrations OR partners`,
    ];

    const pages: any[] = [];
    const seen = new Set<string>();
    for (const query of pageQueries) {
      const rows = await searchWeb(query, 4);
      for (const row of rows) {
        if (!row?.url || seen.has(row.url)) continue;
        seen.add(row.url); pages.push(row);
      }
      if (pages.length >= 15) break;
    }
    if (!pages.length) pages.push(...await searchWeb(`${competitor.name} ${domain}`, 6));

    const corpus = pages.map(p => `${p.title || ""}\n${p.description || ""}\n${p.markdown || ""}`).join("\n\n").toLowerCase().slice(0, 180000);
    const productTerms = normalizeTerms(workspace.product_keywords);
    const capabilityTerms = normalizeTerms(workspace.capability_keywords);
    const techTerms = normalizeTerms(workspace.technology_keywords);
    const customerTerms = normalizeTerms(`${workspace.target_customers || ""},${workspace.buyer || ""}`);
    const problemTerms = normalizeTerms(workspace.problem_statement);
    const modelTerms = normalizeTerms(workspace.business_model);
    const geoTerms = normalizeTerms(workspace.geography);

    const product = termScore(corpus, productTerms);
    const feature = termScore(corpus, capabilityTerms);
    const technology = termScore(corpus, techTerms);
    const customer = termScore(corpus, customerTerms);
    const problem = termScore(corpus, problemTerms);
    const business = termScore(corpus, modelTerms);
    const geography = termScore(corpus, geoTerms);
    const buyer = customer;
    const workflow = Math.round((product + feature + problem) / 3);
    const distribution = Math.round((customer + business) / 2);
    const weighted = Math.round(problem * .20 + customer * .15 + buyer * .05 + product * .16 + workflow * .14 + feature * .15 + technology * .08 + business * .03 + distribution * .02 + geography * .02);
    const previous = Number(competitor.similarity_score || 0);
    const movement = previous === 0 ? "stable" : weighted >= previous + 5 ? "closer" : weighted <= previous - 5 ? "away" : "stable";
    const threat = Math.min(100, Math.round(weighted * .72 + Math.max(product, customer, feature, technology) * .28));
    const category = classify(weighted);
    const matched = [...new Set([...productTerms, ...capabilityTerms, ...techTerms, ...customerTerms, ...problemTerms])].filter(term => corpus.includes(term)).slice(0, 18);
    const why = matched.length ? `Public evidence overlaps on ${matched.slice(0, 8).join(", ")}. Weighted strategic similarity is ${weighted}%.` : "No strong configured overlap terms were detected across the public pages found. Improve the Company Brain or keep this entity in emerging watch.";

    for (const page of pages.slice(0, 8)) {
      await sbInsert("radar_evidence", { workspace_id: workspace.id, competitor_id: competitor.id, source_url: page.url, source_type: "deep_public_scan", title: String(page.title || `${competitor.name} public page`).slice(0, 200), fact: String(page.description || "Public competitor page discovered during deep scan.").slice(0, 1000), summary: String(page.markdown || page.description || "").replace(/\s+/g, " ").slice(0, 2000), confidence: 86 });
    }

    const dims = { problem_overlap: problem, customer_overlap: customer, buyer_overlap: buyer, product_overlap: product, workflow_overlap: workflow, feature_overlap: feature, technology_overlap: technology, business_model_overlap: business, distribution_overlap: distribution, geography_overlap: geography, updated_at: new Date().toISOString() };
    const existingDims = await sbSelect(`radar_similarity_dimensions?competitor_id=eq.${competitor.id}&select=id`);
    if (existingDims[0]) await sbUpdate("radar_similarity_dimensions", `id=eq.${existingDims[0].id}`, dims); else await sbInsert("radar_similarity_dimensions", { competitor_id: competitor.id, ...dims });

    await sbUpdate("radar_competitors", `id=eq.${competitor.id}`, { previous_similarity_score: previous, similarity_score: weighted, threat_score: threat, momentum_score: movement === "closer" ? Math.min(100, 65 + Math.abs(weighted - previous)) : movement === "away" ? 25 : 45, movement, category, why_it_matters: why, last_scanned_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    await sbInsert("radar_signals", { workspace_id: workspace.id, competitor_id: competitor.id, signal_type: movement === "closer" ? "competitive_convergence" : "deep_scan", title: movement === "closer" ? `${competitor.name} moved closer to your competitive core` : `${competitor.name}: competitive proximity ${weighted}%`, summary: why, impact_score: threat, confidence: pages.length >= 5 ? 90 : 78, status: "new" });

    if (weighted >= 45 || movement === "closer") await sbInsert("radar_recommendations", { workspace_id: workspace.id, competitor_id: competitor.id, priority: weighted >= 80 || threat >= 80 ? "high" : weighted >= 55 ? "medium" : "low", title: movement === "closer" ? `Investigate why ${competitor.name} is moving closer` : `Review ${competitor.name}'s strategic overlap`, rationale: why, action: weighted >= 80 ? "Compare positioning, buyer, pricing, workflow and differentiation before the next roadmap or GTM decision." : "Review the strongest overlap dimensions and decide whether this company belongs in active surveillance." });

    await sbUpdate("radar_scan_runs", `id=eq.${run.id}`, { status: "completed", pages_scanned: pages.length, findings: matched.length, finished_at: new Date().toISOString() });
    return NextResponse.json({ similarity: weighted, threat, movement, category, matched, dimensions: dims, why, pages_scanned: pages.length });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Scan failed" }, { status: 500 });
  }
}
