import { NextResponse } from "next/server";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { sbInsert, sbSelect, sbUpdate } from "@/lib/radar-db";

function isPrivateIp(ip: string) {
  return /^127\./.test(ip) || /^10\./.test(ip) || /^192\.168\./.test(ip) || /^169\.254\./.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip) || ip === "::1" || /^fc/i.test(ip) || /^fd/i.test(ip) || /^fe80:/i.test(ip);
}

async function safePublicUrl(raw: string) {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only public HTTP(S) websites can be scanned.');
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local')) throw new Error('Private hosts are blocked.');
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new Error('Private network addresses are blocked.');
  } else {
    const addresses = await lookup(host, { all: true });
    if (!addresses.length || addresses.some((entry) => isPrivateIp(entry.address))) throw new Error('Private network targets are blocked.');
  }
  return url;
}

function cleanHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80000);
}

function normalizeTerms(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).flatMap((x) => x.split(/[,;|]/)).map((x) => x.trim().toLowerCase()).filter((x) => x.length > 2);
  return String(value || '').split(/[,;|\n]/).map((x) => x.trim().toLowerCase()).filter((x) => x.length > 2);
}

function termScore(text: string, terms: string[]) {
  const unique = [...new Set(terms)];
  if (!unique.length) return 0;
  const hits = unique.filter((term) => text.includes(term));
  return Math.round((hits.length / unique.length) * 100);
}

function classify(score: number) {
  if (score >= 80) return 'direct';
  if (score >= 55) return 'adjacent';
  if (score >= 30) return 'micro';
  return 'emerging';
}

export async function POST(req: Request) {
  try {
    const { competitorId } = await req.json();
    const competitors = await sbSelect(`radar_competitors?id=eq.${encodeURIComponent(competitorId)}&select=*`);
    const competitor = competitors[0];
    if (!competitor?.website) return NextResponse.json({ error: 'Competitor not found or has no website.' }, { status: 404 });

    const workspaces = await sbSelect(`radar_workspaces?id=eq.${competitor.workspace_id}&select=*`);
    const workspace = workspaces[0];
    if (!workspace) return NextResponse.json({ error: 'Workspace not found.' }, { status: 404 });

    const run = (await sbInsert('radar_scan_runs', { workspace_id: workspace.id, competitor_id: competitor.id, run_type: 'website_scan', status: 'running' }))[0];

    const url = await safePublicUrl(competitor.website);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'RADAR-Competitive-Intelligence/1.0 (+public-web-analysis)' },
    });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`Website returned HTTP ${response.status}`);
    const type = response.headers.get('content-type') || '';
    if (!type.includes('text/html') && !type.includes('text/plain')) throw new Error('Website did not return readable HTML/text.');
    const text = cleanHtml(await response.text());
    const lower = text.toLowerCase();

    const productTerms = normalizeTerms(workspace.product_keywords);
    const capabilityTerms = normalizeTerms(workspace.capability_keywords);
    const techTerms = normalizeTerms(workspace.technology_keywords);
    const customerTerms = normalizeTerms(`${workspace.target_customers || ''},${workspace.buyer || ''}`);
    const problemTerms = normalizeTerms(workspace.problem_statement);
    const modelTerms = normalizeTerms(workspace.business_model);
    const geoTerms = normalizeTerms(workspace.geography);

    const product = termScore(lower, productTerms);
    const feature = termScore(lower, capabilityTerms);
    const technology = termScore(lower, techTerms);
    const customer = termScore(lower, customerTerms);
    const problem = termScore(lower, problemTerms);
    const business = termScore(lower, modelTerms);
    const geography = termScore(lower, geoTerms);
    const buyer = customer;
    const workflow = Math.round((product + feature + problem) / 3);
    const distribution = Math.round((customer + business) / 2);

    const weighted = Math.round(
      problem * .16 + customer * .17 + buyer * .10 + product * .18 + workflow * .12 + feature * .12 + technology * .06 + business * .04 + distribution * .03 + geography * .02
    );
    const previous = Number(competitor.similarity_score || 0);
    const movement = previous === 0 ? 'stable' : weighted >= previous + 5 ? 'closer' : weighted <= previous - 5 ? 'away' : 'stable';
    const threat = Math.min(100, Math.round(weighted * .72 + Math.max(product, customer, feature) * .28));
    const category = classify(weighted);

    const matched = [...new Set([...productTerms, ...capabilityTerms, ...techTerms, ...customerTerms, ...problemTerms])].filter((term) => lower.includes(term)).slice(0, 12);
    const title = text.slice(0, 120) || competitor.name;
    const why = matched.length
      ? `Detected overlap across ${matched.slice(0, 6).join(', ')}. Current weighted strategic similarity is ${weighted}%.`
      : 'No strong keyword overlap was detected from the current startup profile and public homepage. Add richer startup keywords or scan more pages.';

    await sbInsert('radar_evidence', {
      workspace_id: workspace.id,
      competitor_id: competitor.id,
      source_url: url.toString(),
      source_type: 'website',
      title: `${competitor.name} public website`,
      fact: `Public website scan detected ${matched.length} configured overlap terms.`,
      summary: matched.length ? `Matched: ${matched.join(', ')}` : 'No configured overlap terms matched.',
      confidence: response.ok ? 88 : 60,
    });

    const dims = { problem_overlap: problem, customer_overlap: customer, buyer_overlap: buyer, product_overlap: product, workflow_overlap: workflow, feature_overlap: feature, technology_overlap: technology, business_model_overlap: business, distribution_overlap: distribution, geography_overlap: geography, updated_at: new Date().toISOString() };
    const existingDims = await sbSelect(`radar_similarity_dimensions?competitor_id=eq.${competitor.id}&select=id`);
    if (existingDims[0]) await sbUpdate('radar_similarity_dimensions', `id=eq.${existingDims[0].id}`, dims);
    else await sbInsert('radar_similarity_dimensions', { competitor_id: competitor.id, ...dims });

    await sbUpdate('radar_competitors', `id=eq.${competitor.id}`, {
      previous_similarity_score: previous,
      similarity_score: weighted,
      threat_score: threat,
      momentum_score: movement === 'closer' ? Math.min(100, 65 + Math.abs(weighted - previous)) : movement === 'away' ? 25 : 45,
      movement,
      category,
      why_it_matters: why,
      last_scanned_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await sbInsert('radar_signals', {
      workspace_id: workspace.id,
      competitor_id: competitor.id,
      signal_type: 'website_scan',
      title: `${competitor.name}: competitive proximity ${weighted}%`,
      summary: why,
      impact_score: threat,
      confidence: 88,
      status: 'new',
    });

    if (weighted >= 55 || movement === 'closer') {
      await sbInsert('radar_recommendations', {
        workspace_id: workspace.id,
        competitor_id: competitor.id,
        priority: weighted >= 80 ? 'high' : 'medium',
        title: weighted >= 80 ? `Review ${competitor.name} as a core competitor` : `Validate ${competitor.name}'s overlap`,
        rationale: why,
        action: weighted >= 80 ? 'Compare positioning, pricing, buyer, product workflow and differentiation before the next GTM decision.' : 'Review the matched capabilities and decide whether this company belongs on the active watchlist.',
      });
    }

    await sbUpdate('radar_scan_runs', `id=eq.${run.id}`, { status: 'completed', pages_scanned: 1, findings: matched.length, finished_at: new Date().toISOString() });

    return NextResponse.json({ similarity: weighted, threat, movement, category, matched, dimensions: dims, why });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Scan failed' }, { status: 500 });
  }
}
