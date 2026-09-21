# Free-first intelligence upgrade

The existing Company Brain → discovery → evidence → Signals → Moves routes remain in place. SearXNG and GDELT provide discovery; direct HTTP and RSS/Atom provide monitoring; the existing OpenRouter/DeepSeek routing handles reasoning. Existing workspace authorization and database tables are reused.

## Changes

- Legacy search wrappers now use the engine first. A Firecrawl API key alone cannot enable search, scraping, or monitor creation. The explicit `FIRECRAWL_FALLBACK_ENABLED=true` flag is required.
- Provider calls fail independently, URLs are canonicalized, GDELT metadata survives, repeated queries coalesce/cache, and GDELT requests are spaced at least 5.1 seconds apart within a process.
- Paid OpenRouter live-web search is an explicit optional fallback. Normal OpenRouter reasoning is independent of this flag.
- Source registration uses existing unique indexes to ignore duplicate URLs and tasks. Source/task checks claim rows with compare-and-set updates before execution.
- Direct crawling discovers strategic pages and feeds. Feed snapshots retain article links and normalize item ordering. Bodies are bounded at 2 MB.
- Unchanged snapshots are not inserted repeatedly. If semantic analysis fails, the previous baseline survives so the change can be retried. Inferences retain their classification.
- Funding fields require verbatim support from fetched evidence; unsupported fields become null/unknown. Upsert writes omit founder pipeline state, notes, owner, and first-seen date.
- System Health uses real provider observations and recent task completions instead of static success metrics. Its route no longer redirects to Settings.
- The Next.js instrumentation driver invokes the existing system-maintenance API every five minutes while the process is awake. Middleware admits secret-authenticated workers; route authorization remains in place.

## Database

No migration is required or applied. Inspected the existing source-health columns, unique `(workspace_id,url)`, `(workspace_id,task_key)`, and `(workspace_id,fingerprint)` indexes, and funding defaults. No tables or existing workspace data were reset.

## Environment

See `.env.example`. Retain existing production Supabase and RADAR secrets. Set `SEARCH_PROVIDER=searxng`, `SEARXNG_BASE_URL=https://radar-searxng.onrender.com`, `GDELT_ENABLED=true`, `FIRECRAWL_FALLBACK_ENABLED=false`. `OPENROUTER_LIVE_WEB_ENABLED=true` permits a paid fallback; default is false. Maintenance defaults on when the server secret exists; `RADAR_MAINTENANCE_ENABLED=false` disables the in-process driver.

## Verification and limits

`npm run build` and the regression suite cover compilation, independent provider failure, malformed JSON, coalescing, premium gating, feeds, unchanged snapshots, concurrent source claims, and worker middleware authentication.

Live checks on 2026-09-21: default SearXNG search returned JSON with zero results and upstream CAPTCHA/rate-limit failures. An explicit Bing diagnostic returned unrelated Google Maps results and was not accepted as a working discovery source. GDELT returned HTTP 429 twice, including a spaced retry. These are unresolved live-provider failures, not successful acceptance tests.

The browser reached RADAR's sign-in page; authenticated discovery, funding persistence, semantic-change → Move production acceptance, and UI verification require an authenticated session. No claim is made that the full end-to-end acceptance flow passed.

Free Render services may sleep. The in-process maintenance driver cannot run while asleep. An external authenticated POST to `/api/radar/system-maintenance` is needed to wake it for continuous operation, or an always-on plan. No paid service was created.

Search cache, GDELT pacing, and feed-discovery cooldown are process-local. Multi-instance deployment needs shared coordination. Existing Move synthesis remains heuristic; this change adds recency/confidence filtering, not AI-based synthesis. The broader legacy app has not received a complete authorization or transaction audit. Provider health reflects recent checks by the current process; it is not a historical uptime metric.
