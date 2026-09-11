import { NextResponse } from "next/server";
import { sbInsert, sbSelect } from "@/lib/radar-db";
import { firecrawlConfigured, searchWeb } from "@/lib/firecrawl";

function normalizeTerms(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).flatMap((x) => x.split(/[,;|]/)).map((x) => x.trim()).filter((x) => x.length > 2);
  return String(value || "").split(/[,;|\n]/).map((x) => x.trim()).filter((x) => x.length > 2);
}

function domainOf(raw: string) {
  try { return new URL(raw).hostname.replace(/^www\./, "").toLowerCase(); }
  catch { return ""; }
}

function scoreCandidate(text: string, terms: string[]) {
  const lower = text.toLowerCase();
  const unique = [...new Set(terms.map((t) => t.toLowerCase()))].filter(Boolean);
  if (!unique.length) return 0;
  const hits = unique.filter((term) => lower.includes(term)).length;
  return Math.min(100, Math.round((hits / Math.min(unique.length, 16)) * 100));
}

function buildQueries(workspace: any) {
  const product = normalizeTerms(workspace.product_keywords).slice(0, 6);
  const capabilities = normalizeTerms(workspace.capability_keywords).slice(0, 8);
  const tech = normalizeTerms(workspace.technology_keywords).slice(0, 5);
  const customers = normalizeTerms(workspace.target_customers).slice(0, 4);
  const buyer = normalizeTerms(workspace.buyer).slice(0, 3);
  const problem = normalizeTerms(workspace.problem_statement).slice(0, 6);
  const geography = String(workspace.geography || "").trim();

  const q = new Set<string>();
  const productPhrase = product.slice(0, 3).join(" ");
  const problemPhrase = problem.slice(0, 4).join(" ");
  const customerPhrase = [...customers, ...buyer].slice(0, 3).join(" ");

  if (productPhrase) q.add(`${productPhrase} startup competitors`);
  if (productPhrase && customerPhrase) q.add(`${productPhrase} for ${customerPhrase} company`);
  if (problemPhrase) q.add(`startup solving ${problemPhrase}`);
  for (const capability of capabilities.slice(0, 6)) {
    q.add(`${capability} startup company ${customerPhrase || "software"}`);
  }
  for (const technology of tech.slice(0, 3)) {
    q.add(`${technology} startup ${product[0] || problem[0] || "platform"}`);
  }
  if (geography && productPhrase) q.add(`${productPhrase} startup ${geography}`);

  return [...q].slice(0, 14);
}

export async function POST() {
  try {
    const workspaces = await sbSelect("radar_workspaces?select=*&order=created_at.asc&limit=1");
    const workspace = workspaces[0];
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    if (!firecrawlConfigured()) {
      return NextResponse.json({ error: "Continuous web discovery is ready, but FIRECRAWL_API_KEY is not configured." }, { status: 503 });
    }

    const queries = buildQueries(workspace);
    if (!queries.length) return NextResponse.json({ error: "Add more Company Brain details before discovery." }, { status: 400 });

    for (const query of queries) {
      try {
        await sbInsert("radar_discovery_queries", { workspace_id: workspace.id, query, query_type: "generated", enabled: true });
      } catch {}
    }

    const allTerms = [
      ...normalizeTerms(workspace.product_keywords),
      ...normalizeTerms(workspace.capability_keywords),
      ...normalizeTerms(workspace.technology_keywords),
      ...normalizeTerms(workspace.target_customers),
      ...normalizeTerms(workspace.buyer),
      ...normalizeTerms(workspace.problem_statement),
    ];

    const ownDomain = domainOf(workspace.website || "");
    const existingCompetitors = await sbSelect(`radar_competitors?workspace_id=eq.${workspace.id}&select=website`);
    const existingDomains = new Set(existingCompetitors.map((x: any) => domainOf(x.website || "")).filter(Boolean));
    const candidates: any[] = [];
    const seen = new Set<string>();

    for (const query of queries.slice(0, 10)) {
      const results = await searchWeb(query, 5);
      for (const result of results) {
        const domain = domainOf(result.url);
        if (!domain || domain === ownDomain || existingDomains.has(domain) || seen.has(domain)) continue;
        seen.add(domain);
        const text = `${result.title || ""} ${result.description || ""} ${result.markdown || ""}`;
        const provisional = scoreCandidate(text, allTerms);
        const row = {
          workspace_id: workspace.id,
          source_query: query,
          title: result.title || domain,
          url: result.url,
          domain,
          description: result.description || null,
          provisional_score: provisional,
          status: "new",
          updated_at: new Date().toISOString(),
        };
        try {
          const inserted = await sbInsert("radar_candidates", row);
          if (inserted?.[0]) candidates.push(inserted[0]);
        } catch {
          candidates.push(row);
        }
      }
    }

    return NextResponse.json({
      queries_generated: queries.length,
      candidates_found: candidates.length,
      candidates: candidates.sort((a,b) => Number(b.provisional_score || 0) - Number(a.provisional_score || 0)).slice(0, 50),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Discovery failed" }, { status: 500 });
  }
}
