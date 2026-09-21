const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const ts=require('typescript');
const original=Module._resolveFilename;
Module._resolveFilename=function(name,...args){return original.call(this,name.startsWith('@/')?path.join(process.cwd(),name.slice(2)):name,...args);};
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
process.env.SEARCH_PROVIDER='searxng';process.env.SEARXNG_BASE_URL='https://search.example.com';
process.env.GDELT_ENABLED='true';process.env.FIRECRAWL_API_KEY='test-key';delete process.env.FIRECRAWL_FALLBACK_ENABLED;delete process.env.OPENROUTER_API_KEY;
const search=require('../lib/radar-engine-search.ts');
const firecrawl=require('../lib/firecrawl.ts');
const crawl=require('../lib/radar-engine-crawl.ts');
const semantic=require('../lib/radar-semantic.ts');
const response=data=>new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
test('SearXNG failure continues through GDELT; metadata survives',async()=>{
 global.fetch=async url=>String(url).includes('search.example')?new Response('down',{status:503}):response({articles:[{title:'Funding',url:'https://news.example.com/story?utm_source=test',seendate:'20260921T120000Z',domain:'news.example.com',language:'English'}]});
 const rows=await search.engineSearchWeb('fallback test');assert.equal(rows.length,1);assert.equal(rows[0].provider,'gdelt');assert.equal(rows[0].publishedAt,'2026-09-21T12:00:00Z');assert.equal(rows[0].url,'https://news.example.com/story');assert.equal(search.searchProviderHealth().searxng.status,'degraded');
});
test('malformed GDELT does not discard working search results; concurrent queries coalesce',async()=>{
 let calls=0;global.fetch=async url=>{calls++;return String(url).includes('search.example')?response({results:[{title:'Company',url:'https://company.example.com'}]}):new Response('not json');};
 const [a,b]=await Promise.all([search.engineSearchWeb('coalesce test'),search.engineSearchWeb('coalesce test')]);assert.deepEqual(a,b);assert.equal(a.length,1);assert.equal(calls,2);await search.engineSearchWeb('coalesce test');assert.equal(calls,2);
});
test('Firecrawl key alone never enables premium calls',async()=>{
 const urls=[];global.fetch=async url=>{urls.push(String(url));return response(String(url).includes('search.example')?{results:[]}:{articles:[]});};
 assert.equal(firecrawl.firecrawlConfigured(),false);await firecrawl.searchWeb('no premium test');assert.ok(urls.every(url=>!url.includes('firecrawl')));await assert.rejects(()=>firecrawl.createMonitor({}),/disabled/);
});
test('SearXNG zero results with engine failures is degraded, not healthy',async()=>{
 global.fetch=async url=>response(String(url).includes('search.example')?{results:[],unresponsive_engines:[['engine','CAPTCHA']]}:{articles:[]});await search.engineSearchWeb('blocked engine test');assert.equal(search.searchProviderHealth().searxng.status,'degraded');
});
test('canonical URLs discard trackers and reject unsafe schemes and credentials',()=>{
 assert.equal(search.canonicalSearchUrl('https://company.example/p?utm_source=x&b=2#a'),'https://company.example/p?b=2');assert.equal(search.canonicalSearchUrl('javascript:alert(1)'),null);assert.equal(search.canonicalSearchUrl('https://user:secret@example.com'),null);
});
test('RSS and Atom retain evidence links and ignore feed ordering/timestamps',()=>{
 const first='<entry><title>New product</title><link href="https://example.com/product"/><summary>Now launched</summary><updated>today</updated></entry>';
 const second='<entry><title>Pricing</title><link href="https://example.com/pricing"/><summary>New plan</summary></entry>';
 assert.equal(crawl.feedToText(`<feed>${first}${second}</feed>`,'https://example.com'),crawl.feedToText(`<feed>${second}${first.replace('today','tomorrow')}</feed>`,'https://example.com'));assert.match(crawl.feedToText(`<feed>${first}</feed>`,'https://example.com'),/https:\/\/example.com\/product/);
 assert.deepEqual(crawl.extractFeeds('<link type="application/atom+xml" href="/feed" rel="alternate">','https://example.com'),['https://example.com/feed']);
});
test('snapshot normalization removes cosmetic copyright churn',()=>{assert.equal(semantic.normalizeSnapshotText('Product ©2025 plan'),semantic.normalizeSnapshotText('Product ©2026 plan'));});
test('source monitoring atomically claims work and does not save unchanged snapshots',async()=>{
 const db=require('../lib/radar-db.ts');
 const source={id:'source-1',competitor_id:'company-1',url:'https://company.example.com',next_check_at:'2026-01-01T00:00:00Z',check_frequency_minutes:60};let claimed=false,snapshots=0,fetches=0;
 db.sbSelect=async query=>{
  if(query.startsWith('radar_competitors?'))return [{id:'company-1',name:'Company',website:source.url,monitoring_preference:'auto'}];
  if(query.startsWith('radar_evidence?'))return [];
  if(query.startsWith('radar_workspaces?'))return [{id:'workspace-1',name:'Founder'}];
  if(query.startsWith('radar_snapshots?'))return [{content_text:'Stable product '.repeat(20),content_hash:'old'}];
  if(query.startsWith('radar_sources?')&&query.includes('or='))return [source];
  if(query.startsWith('radar_sources?'))return [{...source,source_type:'rss'}];
  return [];
 };
 db.sbUpdate=async (table,query)=>{assert.ok(query.includes('workspace_id=eq.workspace-1'));if(query.includes('next_check_at=eq.')){if(claimed)return [];claimed=true;}return [source];};
 db.sbInsert=async table=>{if(table==='radar_snapshots')snapshots++;return [];};db.sbUpsert=async()=>[];
 crawl.fetchSnapshotEngine=async()=>{fetches++;return {text:'Stable product '.repeat(20),title:'Company',url:source.url};};
 const monitor=require('../lib/radar-source-monitor.ts');
 const results=await Promise.all([monitor.runWorkspaceSourceMonitor('workspace-1'),monitor.runWorkspaceSourceMonitor('workspace-1')]);
 assert.equal(fetches,1);assert.equal(snapshots,0);assert.equal(results.reduce((n,r)=>n+r.checked,0),1);
});
test('middleware permits authenticated workers and preserves user authentication',()=>{
 const {NextRequest}=require('next/server');const {proxy}=require('../proxy.ts');process.env.RADAR_API_SECRET='worker-test-secret';
 const valid=proxy(new NextRequest('https://radar.example.com/api/radar/maintenance',{headers:{'x-radar-api-key':'worker-test-secret','x-radar-system-workspace':'workspace-1'}}));assert.equal(valid.headers.get('x-middleware-next'),'1');
 const invalid=proxy(new NextRequest('https://radar.example.com/api/radar/maintenance',{headers:{'x-radar-api-key':'incorrect','x-radar-system-workspace':'workspace-1'}}));assert.equal(invalid.status,307);
 const page=proxy(new NextRequest('https://radar.example.com/system-health'));assert.equal(page.status,307);
 const cron=proxy(new NextRequest('https://radar.example.com/api/radar/system-maintenance'));assert.equal(cron.headers.get('x-middleware-next'),'1');
});
