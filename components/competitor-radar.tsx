"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Activity, GitBranch, Layers3, Plus, Radar, Search, ShieldCheck, Sparkles } from "lucide-react";

type Competitor = {
  id: string;
  name: string;
  website: string;
  similarity_score: number;
  threat_score: number;
  category: "direct" | "adjacent" | "micro" | "emerging";
  movement: "closer" | "stable" | "away";
  why_it_matters?: string;
  last_scanned_at?: string;
};

type Workspace = {
  id: string;
  name: string;
  product_keywords: string[];
  capability_keywords: string[];
  technology_keywords: string[];
  target_customers?: string;
  buyer?: string;
  problem_statement?: string;
  geography?: string;
  business_model?: string;
};

function positionFor(c: Competitor, index: number) {
  const score = Number(c.similarity_score || 0);
  const radius = 8 + (100 - score) * 0.34;
  const angle = ((index * 137.5) % 360) * Math.PI / 180;
  return { x: 50 + Math.cos(angle) * radius, y: 50 + Math.sin(angle) * radius };
}

function movementText(movement: Competitor["movement"]) {
  if (movement === "closer") return "Moving closer";
  if (movement === "away") return "Moving away";
  return "Stable";
}

export function CompetitorRadar() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState<"all" | Competitor["category"]>("all");
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const [w, c] = await Promise.all([
      fetch("/api/radar/workspace", { cache: "no-store" }).then(r => r.json()),
      fetch("/api/radar/competitors", { cache: "no-store" }).then(r => r.json()),
    ]);
    setWorkspace(w);
    setCompetitors(c);
    if (!selectedId && c[0]?.id) setSelectedId(c[0].id);
  }

  useEffect(() => { load(); }, []);

  const visible = useMemo(() => competitors.filter((c) => filter === "all" || c.category === filter), [competitors, filter]);
  const selected = competitors.find((c) => c.id === selectedId) ?? competitors[0];

  async function addCompetitor(e: FormEvent) {
    e.preventDefault();
    if (!website.trim()) return;
    setBusy(true); setMessage("Adding competitor...");
    const res = await fetch("/api/radar/competitors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, website }) });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error || "Could not add competitor"); setBusy(false); return; }
    setName(""); setWebsite(""); setSelectedId(data.id); await load(); setMessage("Competitor added. Run Deep scan to calculate distance."); setBusy(false);
  }

  async function deepScan() {
    if (!selected) return;
    setBusy(true); setMessage(`Scanning ${selected.name}...`);
    const res = await fetch("/api/radar/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ competitorId: selected.id }) });
    const data = await res.json();
    if (!res.ok) setMessage(data.error || "Scan failed");
    else setMessage(`Scan complete: ${data.similarity}% similarity, ${data.threat}% threat. ${data.matched?.length || 0} overlap terms found.`);
    await load(); setBusy(false);
  }

  return (
    <section className="competition-command">
      <div className="competition-toolbar">
        <div>
          <span className="competition-kicker">LIVE COMPETITION RADAR</span>
          <h2>{workspace?.name || "Your company"} at the center.</h2>
          <p>Competitors are pulled closer as strategic similarity rises. Every deep scan stores evidence, updates distance, and creates signals and recommendations.</p>
        </div>
        <div className="competition-filters" aria-label="Competition filters">
          {(["all","direct","adjacent","micro","emerging"] as const).map((item) => (
            <button key={item} onClick={() => setFilter(item)} className={filter === item ? "active" : ""}>{item === "all" ? "All" : item}</button>
          ))}
        </div>
      </div>

      <form className="competition-add" onSubmit={addCompetitor}>
        <div><Plus size={15}/><strong>Add a competitor or possible competitor</strong></div>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Company name (optional)" />
        <input value={website} onChange={e=>setWebsite(e.target.value)} placeholder="company.com" required />
        <button disabled={busy} type="submit">Add to RADAR</button>
      </form>
      {message ? <div className="competition-live-message">{message}</div> : null}

      <div className="competition-grid">
        <article className="competition-radar-card">
          <div className="radar-stage">
            <div className="radar-crosshair horizontal" /><div className="radar-crosshair vertical" />
            {[1,2,3,4].map((ring) => <div key={ring} className={`competition-ring ring-${ring}`} />)}
            <div className="radar-sweep" />
            <button className="company-core" aria-label="Your company"><span>YOU</span><strong>{(workspace?.name || "YOUR COMPANY").slice(0,18)}</strong></button>
            {visible.map((company, index) => {
              const p = positionFor(company, index);
              return <button key={company.id} className={`competitor-node ${company.category} ${selectedId === company.id ? "selected" : ""}`} style={{ left:`${p.x}%`, top:`${p.y}%` }} onClick={() => setSelectedId(company.id)} aria-label={`${company.name}, ${company.similarity_score}% similarity`}><span className="node-dot"/><strong>{company.name}</strong><small>{Math.round(Number(company.similarity_score || 0))}%</small></button>
            })}
            {competitors.length === 0 ? <div className="radar-empty-state"><Radar size={30}/><strong>Your competitive universe is empty.</strong><span>Add a company above, then run a scan.</span></div> : null}
          </div>
          <footer className="competition-legend"><span>CORE 80–100%</span><span>ADJACENT 55–79%</span><span>MICRO 30–54%</span><span>WATCH &lt;30%</span></footer>
        </article>

        <aside className="competition-detail panel">
          {selected ? <>
            <div className="competition-detail-head"><div><span>SELECTED ENTITY</span><h3>{selected.name}</h3></div><span className={`movement-chip ${selected.movement}`}>{movementText(selected.movement)}</span></div>
            <div className="competition-score-row"><div><span>Similarity</span><strong>{Math.round(Number(selected.similarity_score || 0))}%</strong><i><b style={{width:`${selected.similarity_score || 0}%`}}/></i></div><div><span>Threat</span><strong>{Math.round(Number(selected.threat_score || 0))}%</strong><i><b style={{width:`${selected.threat_score || 0}%`}}/></i></div></div>
            <div className="competition-why"><span>WHY RADAR PLACED IT HERE</span><p>{selected.why_it_matters || "Run a deep scan to calculate strategic overlap from public evidence."}</p></div>
            <div className="overlap-stack"><span>STATUS</span><div><ShieldCheck size={13}/><strong>{selected.category} competitor</strong></div><div><Activity size={13}/><strong>{selected.last_scanned_at ? `Scanned ${new Date(selected.last_scanned_at).toLocaleString()}` : "Not scanned yet"}</strong></div></div>
            <div className="competition-actions"><button onClick={deepScan} disabled={busy}><Search size={14}/>{busy ? "Scanning..." : "Deep scan"}</button><a href={selected.website} target="_blank" rel="noreferrer"><GitBranch size={14}/>Open source</a></div>
          </> : <div className="competition-empty-detail"><Layers3 size={24}/><strong>Select or add a company</strong><p>RADAR will show evidence-backed similarity and threat here.</p></div>}
        </aside>
      </div>

      <div className="surveillance-strip"><div className="surveillance-copy"><Radar size={17}/><div><span>PUBLIC-SIGNAL SURVEILLANCE</span><strong>Current functional loop</strong></div></div><div className="surveillance-sources">{["Website scan","Evidence store","Similarity score","Threat score","Movement","Signals","Recommendations"].map((source)=><span key={source}>{source}</span>)}</div></div>

      <div className="micro-intelligence-grid">
        <article className="panel micro-intel-card"><div className="micro-intel-icon"><Layers3 size={18}/></div><span>MICRO-COMPETITION</span><h3>Feature-level overlap is first-class.</h3><p>Configure product, capability and technology keywords in the startup profile. A company can become relevant even when it only overlaps with one strategically important layer.</p></article>
        <article className="panel micro-intel-card"><div className="micro-intel-icon"><Activity size={18}/></div><span>CONVERGENCE</span><h3>Distance changes with every scan.</h3><p>RADAR compares the new similarity score to the previous one and marks the company as moving closer, stable, or moving away.</p></article>
        <article className="panel micro-intel-card"><div className="micro-intel-icon"><Sparkles size={18}/></div><span>DECISION MEMORY</span><h3>Important scans create recommendations.</h3><p>High-overlap or converging companies automatically create founder-review actions in the database instead of disappearing into a feed.</p></article>
      </div>
    </section>
  );
}
