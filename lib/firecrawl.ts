const FIRECRAWL_BASE = "https://api.firecrawl.dev/v2";

export function firecrawlConfigured() {
  return Boolean(process.env.FIRECRAWL_API_KEY);
}

function apiKey() {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("FIRECRAWL_API_KEY is not configured.");
  return key;
}

async function firecrawlRequest(path: string, body: unknown) {
  const response = await fetch(`${FIRECRAWL_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
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
  });
  const rows = payload?.data?.web || payload?.web || [];
  return Array.isArray(rows) ? rows.filter((row) => row?.url) : [];
}

export async function scrapeCompanyProfile(url: string) {
  const schema = {
    type: "object",
    properties: {
      company_name: { type: "string" },
      one_line_description: { type: "string" },
      problem_statement: { type: "string" },
      target_customers: { type: "string" },
      buyer: { type: "string" },
      product_keywords: { type: "array", items: { type: "string" } },
      capability_keywords: { type: "array", items: { type: "string" } },
      technology_keywords: { type: "array", items: { type: "string" } },
      geography: { type: "string" },
      business_model: { type: "string" },
    },
    required: ["company_name","one_line_description","problem_statement","target_customers","buyer","product_keywords","capability_keywords","technology_keywords","geography","business_model"],
  };

  const payload = await firecrawlRequest("/scrape", {
    url,
    formats: [
      "markdown",
      {
        type: "json",
        schema,
        prompt: "Understand this startup for competitive intelligence. Extract only claims supported by the public page. Use concise phrases. Product keywords should describe products/categories, capability keywords should describe features/workflows, and technology keywords should describe explicit or strongly evidenced technology. Do not invent missing facts; use empty strings or arrays when uncertain."
      }
    ],
    onlyMainContent: true,
    timeout: 120000,
  });

  return payload?.data || payload;
}

export async function createMonitor(body: unknown) {
  return firecrawlRequest("/monitor", body);
}
