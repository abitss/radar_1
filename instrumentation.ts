function normalizeTerms(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).flatMap((x) => x.split(/[,;|]/)).map((x) => x.trim()).filter((x) => x.length > 2);
  return String(value || "").split(/[,;|\n]/).map((x) => x.trim()).filter((x) => x.length > 2);
}

function buildQueries(workspace: any) {
  const product = normalizeTerms(workspace.product_keywords).slice(0, 5);
  const caps = normalizeTerms(workspace.capability_keywords).slice(0, 5);
  const tech = normalizeTerms(workspace.technology_keywords).slice(0, 3);
  const customer = normalizeTerms(`${workspace.target_customers || ""},${workspace.buyer || ""}`).slice(0, 4);
  const problem = normalizeTerms(workspace.problem_statement).slice(0, 5);
  const q = new Set<string>();
  if (product.length) q.add(`${product.slice(0,3).join(" ")} startup competitor`);
  if (product.length && customer.length) q.add(`${product.slice(0,2).join(" ")} ${customer.slice(0,2).join(" ")} company`);
  if (problem.length) q.add(`startup solving ${problem.slice(0,4).join(" ")}`);
  for (const cap of caps.slice(0,4)) q.add(`${cap} ${customer.slice(0,2).join(" ") || "startup company"}`);
  for (const t of tech.slice(0,2)) q.add(`${t} ${product[0] || caps[0] || "startup"} company`);
  if (workspace.name) q.add(`${workspace.name} alternatives competitors`);
  return [...q].filter(Boolean).slice(0, 12);
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const [{ createMonitor, firecrawlConfigured }, { sbInsert, sbSelect }] = await Promise.all([
      import("@/lib/firecrawl"),
      import("@/lib/radar-db"),
    ]);

    if (!firecrawlConfigured()) {
      console.warn("[RADAR] FIRECRAWL_API_KEY is not configured; continuous discovery was not activated.");
      return;
    }

    const workspaces = await sbSelect("radar_workspaces?select=*&order=created_at.asc&limit=1");
    const workspace = workspaces[0];
    if (!workspace) {
      console.warn("[RADAR] No Company Brain found; continuous discovery will activate after workspace setup.");
      return;
    }

    const current = await sbSelect(`radar_monitors?workspace_id=eq.${workspace.id}&monitor_type=eq.web_discovery&status=eq.active&select=*&limit=1`);
    if (current[0]) {
      console.log(`[RADAR] Continuous discovery already active: ${current[0].provider_monitor_id || current[0].id}`);
      return;
    }

    const queries = buildQueries(workspace);
    if (!queries.length) {
      console.warn("[RADAR] Company Brain lacks enough detail to generate discovery queries.");
      return;
    }

    const publicOrigin = process.env.RENDER_EXTERNAL_URL || process.env.NEXT_PUBLIC_APP_URL || "https://radar-v1-preview.onrender.com";
    const webhookUrl = `${publicOrigin.replace(/\/$/, "")}/api/radar/firecrawl-webhook`;
    const secret = process.env.RADAR_API_SECRET || "";
    const goal = `Detect new companies, products, technologies, partnerships, launches, funding, pricing, hiring, positioning or market activity that could compete with, substitute for, enable, or converge toward ${workspace.name}. Focus on the same problem, customer, buyer, workflow, capabilities, technologies, geography or business model. Ignore generic news and irrelevant matches.`;

    const created = await createMonitor({
      name: `RADAR · ${workspace.name} · continuous competitive discovery`,
      schedule: { text: "every 6 hours", timezone: "UTC" },
      targets: [{ type: "search", queries, searchWindow: "7d", maxResults: 20 }],
      goal,
      judgeEnabled: true,
      webhook: {
        url: webhookUrl,
        events: ["monitor.page", "monitor.check.completed"],
        headers: secret ? { "x-radar-webhook-secret": secret } : undefined,
      },
    });

    const providerId = created?.id || created?.data?.id || created?.monitor?.id;
    const rows = await sbInsert("radar_monitors", {
      workspace_id: workspace.id,
      provider: "firecrawl",
      provider_monitor_id: providerId || null,
      monitor_type: "web_discovery",
      name: `Continuous competitive discovery for ${workspace.name}`,
      schedule_text: "every 6 hours",
      goal,
      status: "active",
    });

    console.log(`[RADAR] Continuous discovery activated: ${providerId || rows?.[0]?.id || "created"}`);
  } catch (error) {
    console.error("[RADAR] Continuous discovery startup activation failed:", error);
  }
}
