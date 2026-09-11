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

export async function createMonitor(body: unknown) {
  return firecrawlRequest("/monitor", body);
}
