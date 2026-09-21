"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  BrainCircuit,
  CheckCircle2,
  CircleDot,
  Clock3,
  Database,
  ExternalLink,
  GitBranch,
  MessageSquareText,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";

export function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return (
    <motion.div className="section-intro" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .4 }}>
      <div>
        <div className="eyebrow"><span className="live-dot" />{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </motion.div>
  );
}

export function StatTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return <div className="stat-tile"><span>{label}</span><strong>{value}</strong>{note ? <small>{note}</small> : null}</div>;
}

export function Confidence({ value }: { value: number }) {
  return <span className="confidence-pill"><span style={{ width: `${value}%` }} />{value}%</span>;
}

export function BrainBootstrap() {
  const steps = [
    ["Website verified", "readright.ai", 100],
    ["Company understood", "Learning intelligence · India", 100],
    ["Competitors discovered", "9 high-confidence candidates", 92],
    ["Market universe", "24 watch targets mapped", 88],
    ["Strategic briefing", "Ready for review", 100],
  ] as const;

  return (
    <div className="brain-layout">
      <article className="panel brain-hero">
        <div className="brain-orb-wrap">
          <div className="brain-orb"><BrainCircuit size={38} /><span className="brain-ring ring-1" /><span className="brain-ring ring-2" /><span className="brain-ring ring-3" /></div>
          <div><span className="tiny-label">COMPANY BRAIN</span><h2>ReadRight</h2><p>RADAR has built a high-confidence strategic model of your company and the market around it.</p></div>
        </div>
        <div className="brain-profile-grid">
          <div><span>Category</span><strong>EdTech / Learning Intelligence</strong></div>
          <div><span>Primary customer</span><strong>Schools & educators</strong></div>
          <div><span>Initial market</span><strong>Grades 2–3 · India</strong></div>
          <div><span>Core differentiation</span><strong>Foundational skill diagnosis</strong></div>
        </div>
      </article>

      <article className="panel bootstrap-panel">
        <div className="panel-heading"><div><h3>Bootstrap integrity</h3><p>How RADAR formed this Company Brain</p></div><span className="status-chip">94% CONFIDENCE</span></div>
        <div className="bootstrap-list">
          {steps.map(([label, detail, value]) => (
            <div className="bootstrap-row" key={label}>
              <div><strong>{label}</strong><span>{detail}</span></div>
              <div className="bootstrap-progress"><span style={{ width: `${value}%` }} /></div>
              <em>{value}%</em>
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}

export function WatchGraphVisual() {
  const nodes = [
    { label: "ReadRight", x: 50, y: 50, kind: "core" },
    { label: "LearnSphere", x: 24, y: 28, kind: "competitor" },
    { label: "SkillForge", x: 78, y: 25, kind: "competitor" },
    { label: "K-12 EdTech", x: 18, y: 68, kind: "market" },
    { label: "Speech AI", x: 80, y: 70, kind: "tech" },
    { label: "Schools", x: 50, y: 84, kind: "buyer" },
    { label: "Assessment", x: 50, y: 15, kind: "theme" },
  ];
  return (
    <div className="watch-canvas">
      <svg className="watch-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
        {nodes.slice(1).map((node) => <line key={node.label} x1="50" y1="50" x2={node.x} y2={node.y} />)}
      </svg>
      {nodes.map((node, i) => (
        <motion.div key={node.label} className={`watch-node ${node.kind}`} style={{ left: `${node.x}%`, top: `${node.y}%` }} initial={{ opacity: 0, scale: .7 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * .06 }}>
          <span className="node-pulse" /><strong>{node.label}</strong><small>{node.kind}</small>
        </motion.div>
      ))}
    </div>
  );
}

export function SignalTable() {
  const rows = [
    { company: "LearnSphere", type: "GTM", title: "Enterprise hiring accelerated across sales and customer success", impact: 91, confidence: 88, time: "18m" },
    { company: "SkillForge AI", type: "Product", title: "Institutional assessment landing page launched", impact: 86, confidence: 94, time: "47m" },
    { company: "EduNova", type: "Expansion", title: "New north India school partnerships detected", impact: 79, confidence: 81, time: "1h" },
    { company: "Market", type: "Theme", title: "Foundational learning diagnosis is becoming a distinct category", impact: 76, confidence: 74, time: "2h" },
    { company: "LearnSphere", type: "Compliance", title: "SOC 2 messaging added to enterprise pages", impact: 72, confidence: 97, time: "4h" },
  ];

  return (
    <div className="intel-table-wrap">
      <div className="intel-table-head"><span>Signal</span><span>Impact</span><span>Confidence</span><span>Age</span></div>
      {rows.map((row) => (
        <Link href="/signals/enterprise-hiring" className="intel-table-row" key={`${row.company}-${row.title}`}>
          <div className="signal-main"><div><span className="signal-company">{row.company}</span><span className="signal-type">{row.type}</span></div><strong>{row.title}</strong></div>
          <strong className="impact-score">{row.impact}</strong>
          <Confidence value={row.confidence} />
          <span className="age-cell">{row.time}<ArrowUpRight size={14} /></span>
        </Link>
      ))}
    </div>
  );
}

export function SignalDetail() {
  return (
    <div className="detail-layout">
      <article className="panel detail-primary">
        <div className="detail-kicker"><span className="signal-type">GTM</span><span>LearnSphere</span><span>18 min ago</span></div>
        <h2>Enterprise hiring accelerated across sales and customer success.</h2>
        <p className="detail-summary">RADAR detected a 41% increase in enterprise-facing roles over three weeks, concentrated in sales, implementation and customer success.</p>
        <div className="detail-score-grid"><StatTile label="Impact" value="91" note="High" /><StatTile label="Confidence" value="88%" note="Strong evidence" /><StatTile label="Novelty" value="84" note="New pattern" /></div>
        <div className="evidence-block">
          <div className="evidence-title"><Database size={16} /><div><strong>Evidence</strong><span>First-party and corroborating sources</span></div></div>
          {[
            ["Careers page", "14 enterprise roles added across India and Singapore", "First-party"],
            ["LinkedIn jobs", "Sales hiring velocity increased materially", "Corroborating"],
            ["Product pages", "Enterprise language strengthened across navigation", "First-party"],
          ].map(([source, claim, tag]) => <div className="evidence-item" key={source}><div><strong>{source}</strong><span>{claim}</span></div><em>{tag}</em><ExternalLink size={14} /></div>)}
        </div>
      </article>
      <aside className="detail-side">
        <article className="panel interpretation-card"><span className="tiny-label">INTERPRETATION</span><h3>Likely enterprise GTM acceleration</h3><p>The hiring pattern matters because it appears alongside pricing and compliance changes. On its own this would be weak. In combination it contributes to a stronger strategic Move.</p><Link href="/moves/enterprise-expansion" className="text-button">Open connected Move <ArrowUpRight size={14} /></Link></article>
        <article className="panel fact-card"><span className="tiny-label">CLASSIFICATION</span><div><span>Fact</span><strong>14 roles added</strong></div><div><span>Inference</span><strong>Enterprise expansion</strong></div><div><span>Prediction</span><strong>Institutional launch likely</strong></div></article>
      </aside>
    </div>
  );
}

export function MovesBoard() {
  const moves = [
    { title: "Enterprise expansion", company: "LearnSphere", confidence: 89, signals: 5, impact: "High", status: "Confirmed" },
    { title: "AI product push", company: "SkillForge AI", confidence: 81, signals: 4, impact: "High", status: "Forming" },
    { title: "New geography", company: "EduNova", confidence: 72, signals: 3, impact: "Medium", status: "Forming" },
  ];
  return <div className="moves-board">{moves.map((move, i) => <motion.article className="move-card panel" key={move.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .08 }}><div className="move-card-top"><div className="move-orbit large"><span /></div><span className={`move-status ${move.status.toLowerCase()}`}>{move.status}</span></div><span className="signal-company">{move.company}</span><h3>{move.title}</h3><p>{move.signals} independent signals now support this pattern.</p><div className="move-meta"><div><span>Confidence</span><strong>{move.confidence}%</strong></div><div><span>Impact</span><strong>{move.impact}</strong></div></div><Link href="/moves/enterprise-expansion" className="secondary-button">Review Move <ArrowUpRight size={14} /></Link></motion.article>)}</div>;
}

export function MoveDetail() {
  const timeline = [
    ["3 days ago", "Enterprise sales leader hired", "People"],
    ["2 days ago", "Enterprise pricing page appeared", "Pricing"],
    ["Yesterday", "SOC 2 messaging added", "Compliance"],
    ["Today", "Implementation hiring accelerated", "GTM"],
  ];
  return (
    <div className="detail-layout move-detail-layout">
      <article className="panel detail-primary">
        <div className="detail-kicker"><span className="priority-label"><Radar size={14} /> RADAR MOVE</span><span>LearnSphere</span><span>89% confidence</span></div>
        <h2>LearnSphere appears to be moving upmarket toward enterprise customers.</h2>
        <p className="detail-summary">Four independent categories of change now point in the same strategic direction. RADAR considers this a coherent Move, not a collection of isolated updates.</p>
        <div className="move-timeline">{timeline.map(([time, event, type], i) => <div className="timeline-item" key={event}><span className="timeline-dot" /><div><small>{time} · {type}</small><strong>{event}</strong></div>{i < timeline.length - 1 ? <span className="timeline-line" /> : null}</div>)}</div>
      </article>
      <aside className="detail-side">
        <article className="panel recommendation-card"><div className="recommendation-icon"><Target size={18} /></div><span className="tiny-label">RECOMMENDED RESPONSE</span><h3>Build institutional proof faster than they build institutional distribution.</h3><p>Prioritize 2–3 school pilots with measurable outcomes, then turn those results into procurement-friendly case studies.</p><Link href="/decisions" className="primary-button small-button">Create Decision <ArrowUpRight size={14} /></Link></article>
        <article className="panel"><div className="panel-heading"><div><h3>Connected evidence</h3><p>5 signals · 4 categories</p></div></div><div className="compact-list"><span><Zap size={14} />Hiring acceleration</span><span><CircleDot size={14} />Pricing change</span><span><ShieldCheck size={14} />Compliance shift</span><span><TrendingUp size={14} />Enterprise messaging</span></div></article>
      </aside>
    </div>
  );
}

export function DecisionBoard() {
  const decisions = [
    { title: "How should we respond to LearnSphere's enterprise push?", urgency: "Urgent", options: 4, updated: "18 min ago" },
    { title: "Should ReadRight create a lightweight entry assessment?", urgency: "Review", options: 3, updated: "Yesterday" },
    { title: "Which school segment should receive the next pilot?", urgency: "Open", options: 3, updated: "2 days ago" },
  ];
  return <div className="decision-stack">{decisions.map((item, i) => <motion.article className="panel decision-card" key={item.title} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * .06 }}><div className="decision-icon"><BrainCircuit size={18} /></div><div><span className={`decision-urgency ${item.urgency.toLowerCase()}`}>{item.urgency}</span><h3>{item.title}</h3><p>{item.options} response paths prepared · Updated {item.updated}</p></div><button className="secondary-button">Review <ArrowUpRight size={14} /></button></motion.article>)}</div>;
}

export function AskRadar() {
  const prompts = ["What changed around us this week?", "Who is our biggest emerging competitor?", "Why do you think LearnSphere is moving enterprise?", "What should we focus on next month?"];
  return (
    <div className="ask-layout">
      <div className="ask-hero">
        <div className="ask-orb"><Sparkles size={28} /></div>
        <span className="tiny-label">ASK YOUR STRATEGIC MEMORY</span>
        <h2>Ask RADAR anything about your market.</h2>
        <p>Answers are grounded in your Company Brain, evidence, Signals, Moves, Decisions and outcomes.</p>
        <div className="ask-box"><MessageSquareText size={18} /><input aria-label="Ask RADAR" placeholder="What changed around us this week?" /><button><ArrowUpRight size={18} /></button></div>
        <div className="prompt-grid">{prompts.map((prompt) => <button key={prompt}><Sparkles size={13} />{prompt}</button>)}</div>
      </div>
      <article className="panel context-panel"><div className="panel-heading"><div><h3>Context RADAR will use</h3><p>Live strategic memory for this workspace</p></div><span className="live-chip">LIVE</span></div><div className="context-list"><div><BrainCircuit size={16} /><span><strong>Company Brain</strong><small>94% confidence</small></span></div><div><GitBranch size={16} /><span><strong>Watch Graph</strong><small>24 targets</small></span></div><div><Radar size={16} /><span><strong>RADAR Moves</strong><small>4 active</small></span></div><div><CheckCircle2 size={16} /><span><strong>Decision memory</strong><small>12 recorded</small></span></div></div></article>
    </div>
  );
}

export function SimpleCollection({ kind }: { kind: "companies" | "discover" | "briefings" | "actions" | "sources" | "system" | "market" | "settings" }) {
  const data = {
    companies: ["LearnSphere", "SkillForge AI", "EduNova", "BrightPath Learning"],
    discover: ["FoundryLearn", "SkillPulse", "NimbleClass", "Rooted AI"],
    briefings: ["Founder Daily Brief · 09 Sep", "Weekly Intelligence Brief · Week 36", "Competitive Landscape Brief · August"],
    actions: ["Prepare school-pilot case study", "Validate institutional pricing", "Map procurement objections"],
    sources: ["ReadRight website", "LearnSphere careers", "SkillForge product pages", "India EdTech news"],
    system: ["Web application", "Background worker", "AI gateway", "Search provider", "Durable queue"],
    market: ["Foundational diagnostics", "AI assessment", "Teacher workflow", "School procurement"],
    settings: ["Workspace profile", "Intelligence preferences", "Notifications", "Team access"],
  }[kind];
  return <div className="collection-grid">{data.map((item, i) => <motion.article className="panel collection-card" key={item} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .05 }}><div className="collection-index">0{i + 1}</div><div><strong>{item}</strong><span>Open intelligence surface</span></div><ArrowUpRight size={15} /></motion.article>)}</div>;
}
