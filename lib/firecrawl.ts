const FIRECRAWL_BASE = "https://api.firecrawl.dev/v2";

export function firecrawlConfigured() {
  return Boolean(process.env.FIRECRAWL_API_KEY);
}

function apiKey() {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("FIRECRAWL_API_KEY is not configured.");
  return key;
}

async function firecrawlRequest(path: string, body: unknown, timeoutMs = 30000) {
  const response = await fetch(`${FIRECRAWL_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await response.text();
  let data: any;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!response.ok) throw new Error(data?.error || data?.message || `Firecrawl request failed with HTTP ${response.status}`);
  return data;
}

export type FirecrawlSearchResult = {
  title?: string;
  description?: string;
  url: string;
  markdown?: string;
};

function searchRows(payload: any): FirecrawlSearchResult[] {
  const rows = payload?.data?.web || payload?.web || [];
  return Array.isArray(rows) ? rows.filter((row) => row?.url) : [];
}

export async function searchWebFast(query: string, limit = 5): Promise<FirecrawlSearchResult[]> {
  const payload = await firecrawlRequest("/search", {
    query,
    limit,
    sources: ["web"],
    ignoreInvalidURLs: true,
  }, 18000);
  return searchRows(payload);
}

export async function searchWeb(query: string, limit = 6): Promise<FirecrawlSearchResult[]> {
  const payload = await firecrawlRequest("/search", {
    query,
    limit,
    sources: ["web"],
    ignoreInvalidURLs: true,
    scrapeOptions: {
      formats: ["markdown"],
      onlyMainContent: true,
      maxAge: 21600000,
    },
  }, 30000);
  return searchRows(payload);
}

export async function scrapeCompanyProfile(url: string) {
  const schema = {
    type: "object",
    properties: {
      company_name: { type: "string" },
      one_line_description: { type: "string" },
      industry: { type: "string" },
      sub_category: { type: "string" },
      problem_statement: { type: "string" },
      target_customers: { type: "string" },
      buyer: { type: "string" },
      product_keywords: { type: "array", items: { type: "string" } },
      capability_keywords: { type: "array", items: { type: "string" } },
      technology_keywords: { type: "array", items: { type: "string" } },
      major_features: { type: "array", items: { type: "string" } },
      geography: { type: "string" },
      business_model: { type: "string" },
      pricing_context: { type: "string" },
      positioning: { type: "string" },
      public_team_facts: { type: "string" },
    },
    required: [
      "company_name","one_line_description","industry","sub_category","problem_statement","target_customers","buyer",
      "product_keywords","capability_keywords","technology_keywords","major_features","geography","business_model",
      "pricing_context","positioning","public_team_facts"
    ],
  };

  const payload = await firecrawlRequest("/scrape", {
    url,
    formats: [
      "markdown",
      {
        type: "json",
        schema,
        prompt: "Build an evidence-grounded company profile for competitive intelligence. Extract only claims supported by this public page. Identify industry, sub-category, products/services, problem/use case, target customers, likely buyer only when supported, geography, business model, pricing or price-band evidence, technologies, major features, positioning/messaging and relevant public team/company facts. Use concise phrases. Do not invent missing facts. Return empty strings or arrays when uncertain."
      }
    ],
    onlyMainContent: true,
    timeout: 70000,
  }, 80000);

  return payload?.data || payload;
}

export async function createMonitor(body: unknown) {
  return firecrawlRequest("/monitor", body, 25000);
}
