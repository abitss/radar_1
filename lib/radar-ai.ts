type RadarAIInput = {
  question: string;
  workspace: any;
  competitors: any[];
  signals: any[];
  recommendations: any[];
  evidence: any[];
};

const GROQ_BASE = "https://api.groq.com/openai/v1";
const GROQ_MODEL = "openai/gpt-oss-20b";

function cfg() {
  const baseUrl = String(process.env.RADAR_AI_BASE_URL || GROQ_BASE).replace(/\/$/, "");
  const apiKey = String(process.env.RADAR_AI_API_KEY || process.env.GROQ_API_KEY || "");
  const model = String(process.env.RADAR_AI_MODEL || GROQ_MODEL);
  return { baseUrl, apiKey, model };
}

export function radarAIConfigured() {
  const { apiKey } = cfg();
  return Boolean(apiKey);
}

export function radarAIProvider() {
  const { baseUrl, model } = cfg();
  return {
    provider: baseUrl.includes("api.groq.com") ? "groq" : "openai-compatible",
    model,
    configured: radarAIConfigured(),
  };
}

function compact(value: unknown, max = 8500) {
  const text = JSON.stringify(value, null, 2);
  return text.length > max ? `${text.slice(0, max)}\n...[truncated]` : text;
}

export async function generateRadarAnswer(input: RadarAIInput): Promise<string | null> {
  const { baseUrl, apiKey, model } = cfg();
  if (!apiKey) return null;

  const system = `You are RADAR, a founder competitive-intelligence analyst.
Use ONLY the supplied workspace data, competitors, signals, recommendations and public evidence.
Never invent a competitor fact, funding event, launch, customer, metric or market claim.
When useful, explicitly separate FACT, INFERENCE and PREDICTION.
If evidence is insufficient, say so clearly instead of guessing.
Prefer concise, decision-oriented answers. Explain why something matters to the founder.
Do not claim whole-internet coverage. Say public/indexable sources or RADAR's current evidence.
Never expose internal IDs, secrets, implementation details, API keys or raw database metadata.`;

  const context = {
    company: {
      name: input.workspace?.name,
      website: input.workspace?.website,
      description: input.workspace?.description,
      problem_statement: input.workspace?.problem_statement,
      target_customers: input.workspace?.target_customers,
      buyer: input.workspace?.buyer,
      business_model: input.workspace?.business_model,
      geography: input.workspace?.geography,
      product_keywords: input.workspace?.product_keywords,
      capability_keywords: input.workspace?.capability_keywords,
      technology_keywords: input.workspace?.technology_keywords,
    },
    competitors: input.competitors.slice(0, 18).map(c => ({
      name: c.name,
      website: c.website,
      category: c.category,
      similarity_score: c.similarity_score,
      threat_score: c.threat_score,
      momentum_score: c.momentum_score,
      movement: c.movement,
      why_it_matters: c.why_it_matters,
      last_scanned_at: c.last_scanned_at,
    })),
    signals: input.signals.slice(0, 12).map(s => ({
      title: s.title,
      summary: s.summary,
      signal_type: s.signal_type,
      impact_score: s.impact_score,
      confidence: s.confidence,
      observed_at: s.observed_at,
    })),
    recommendations: input.recommendations.slice(0, 12).map(r => ({
      title: r.title,
      priority: r.priority,
      rationale: r.rationale,
      action: r.action,
      status: r.status,
      created_at: r.created_at,
    })),
    evidence: input.evidence.slice(0, 24).map(e => ({
      title: e.title,
      source_url: e.source_url,
      fact: e.fact,
      confidence: e.confidence,
      observed_at: e.observed_at,
    })),
  };

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 700,
      reasoning_effort: "low",
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Founder question:\n${input.question}\n\nRADAR evidence context:\n${compact(context)}` },
      ],
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(25000),
  });

  const text = await response.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
  if (!response.ok) throw new Error(data?.error?.message || data?.message || `AI request failed with HTTP ${response.status}`);

  const answer = data?.choices?.[0]?.message?.content;
  return typeof answer === "string" && answer.trim() ? answer.trim() : null;
}
