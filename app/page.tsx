"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Activity, ArrowUpRight, BrainCircuit, CircleDot, Radar, ShieldCheck, Sparkles, Target, TrendingUp, Zap } from "lucide-react";
import { Confidence, PageIntro } from "@/components/intelligence-ui";

type Metric = { label: string; value: string; note: string; icon: LucideIcon };
type FormingMove = { move: string; company: string; score: number };

const metrics: Metric[] = [
  { label: "Actionable signals", value: "12", note: "+4 today", icon: Activity },
  { label: "RADAR Moves", value: "4", note: "2 forming", icon: Radar },
  { label: "Open decisions", value: "3", note: "1 urgent", icon: BrainCircuit },
  { label: "Sensor coverage", value: "87%", note: "+6% this week", icon: ShieldCheck },
];

const formingMoves: FormingMove[] = [
  { move: "Enterprise expansion", company: "LearnSphere", score: 89 },
  { move: "AI product push", company: "SkillForge", score: 81 },
  { move: "New geography", company: "EduNova", score: 72 },
];

const bars = [28, 36, 31, 49, 41, 56, 52, 71, 63, 81, 76, 92];

function IntelligenceGraph() {
  return (
    <div className="graph-wrap">
      <div className="graph-grid" />
      <svg viewBox="0 0 780 255" preserveAspectRatio="none" className="line-graph" aria-label="Intelligence velocity rising over seven days">
        <defs><linearGradient id="home-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity=".22" /><stop offset="100%" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs>
        <path className="area-path" d="M0 211 C65 210 78 176 130 181 S205 150 257 159 S339 120 388 132 S466 94 522 105 S604 61 654 74 S728 34 780 43 L780 255 L0 255 Z" fill="url(#home-area)" />
        <motion.path d="M0 211 C65 210 78 176 130 181 S205 150 257 159 S339 120 388 132 S466 94 522 105 S604 61 654 74 S728 34 780 43" fill="none" className="trend-path" strokeWidth="2.3" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 1.4 }} />
      </svg>
      <div className="graph-labels"><span>04 SEP</span><span>05 SEP</span><span>06 SEP</span><span>07 SEP</span><span>08 SEP</span><span>TODAY</span></div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="content">
      <PageIntro eyebrow="LIVE INTELLIGENCE · 09 SEP 2026" title="Good evening, Dipanshu." description="Your market moved today. RADAR found 4 developments worth your attention." action={<Link href="/ask" className="primary-button"><Sparkles size={16} /> Ask RADAR</Link>} />

      <section className="hero-grid">
        <motion.article className="priority-card" initial={{ opacity: 0, scale: .98 }} animate={{ opacity: 1, scale: 1 }}>
          <div className="priority-topline"><span className="priority-label"><Zap size={14} /> HIGH PRIORITY MOVE</span><span className="confidence">91% confidence</span></div>
          <h2>A competitor appears to be preparing an enterprise expansion.</h2>
          <p>Hiring, pricing, compliance and product changes now point in the same direction. This is no longer a weak signal.</p>
          <div className="evidence-row"><div><strong>5</strong><span>corroborating changes</span></div><div><strong>High</strong><span>potential impact</span></div><div><strong>3d</strong><span>pattern forming</span></div></div>
          <div className="recommendation"><div className="recommendation-icon"><Target size={18} /></div><div><span>RADAR RECOMMENDS</span><p>Accelerate school-pilot case studies before enterprise competitors establish institutional proof.</p></div><Link href="/moves/enterprise-expansion"><ArrowUpRight size={17} /></Link></div>
        </motion.article>

        <article className="brain-card">
          <div className="card-heading"><div><span className="card-icon"><BrainCircuit size={17} /></span><div><strong>Company Brain</strong><small>Understanding ReadRight</small></div></div><span className="status-chip">HEALTHY</span></div>
          <div className="brain-score"><Confidence value={94} /><div><strong>Deep context</strong><span>RADAR has high confidence in your company model.</span></div></div>
          <div className="brain-stats"><div><span>Tracked entities</span><strong>37</strong></div><div><span>Watch targets</span><strong>24</strong></div><div><span>Evidence sources</span><strong>68</strong></div></div>
          <Link href="/brain" className="text-button">Open Company Brain <ArrowUpRight size={14} /></Link>
        </article>
      </section>

      <section className="metrics-grid">
        {metrics.map(({ label, value, note, icon: Icon }) => <article className="metric-card" key={label}><div className="metric-icon"><Icon size={17} /></div><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}
      </section>

      <section className="dashboard-grid">
        <article className="panel trend-panel"><div className="panel-heading"><div><h3>Intelligence velocity</h3><p>Meaningful market change detected over time</p></div></div><div className="trend-number"><strong>+38%</strong><span><TrendingUp size={13} /> vs previous period</span></div><IntelligenceGraph /></article>
        <article className="panel moves-panel"><div className="panel-heading"><div><h3>Moves forming</h3><p>Patterns RADAR is connecting now</p></div><Link href="/moves" className="ghost-link">View all</Link></div><div className="move-list">{formingMoves.map(({ move, company, score }) => <Link href="/moves/enterprise-expansion" className="move-row" key={move}><div className="move-orbit"><span /></div><div className="move-copy"><strong>{move}</strong><span>{company}</span></div><div className="move-score">{score}%</div></Link>)}</div></article>
      </section>

      <section className="panel market-strip"><div className="market-title"><CircleDot size={17} /><div><strong>Market pulse</strong><span>12 meaningful signals detected in the last 24 hours</span></div></div><div className="micro-bars">{bars.map((h, i) => <motion.span key={i} initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ delay: .25 + i * .03 }} />)}</div><Link href="/market-map" className="secondary-button">Open market map <ArrowUpRight size={14} /></Link></section>
    </div>
  );
}
