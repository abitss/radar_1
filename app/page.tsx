"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowUp,
  ArrowUpRight,
  BarChart3,
  Building2,
  ChevronRight,
  Globe2,
  Layers3,
  ShieldCheck,
  Users,
} from "lucide-react";

const signalBars = [72, 84, 95, 132, 108, 118, 102, 122, 138, 145, 178, 164, 128, 138, 165, 156, 205, 244, 188, 174, 205, 240, 212, 198, 220, 238, 257, 287];

const topSignals = [
  ["Anthropic expands enterprise footprint with new industry verticals", "AI", "2 hours ago", "High"],
  ["EU advances AI regulatory framework with new oversight body", "Regulation", "4 hours ago", "Medium"],
  ["Microsoft deepens semiconductor supply partnerships in Asia", "Supply Chain", "6 hours ago", "High"],
  ["Surge in defense tech funding across Europe", "Venture Capital", "9 hours ago", "Medium"],
];

const opportunities = [
  ["AI Infrastructure Consolidation", "Increase in strategic M&A activity creates partnership and acquisition opportunities.", "High", BarChart3],
  ["Vertical AI in Healthcare", "Regulatory clarity is accelerating adoption across care providers.", "High", Layers3],
  ["European Defense Tech Expansion", "Significant funding and policy tailwinds across EU markets.", "Medium", ShieldCheck],
  ["AI Governance & Risk Tools", "Growing demand for compliance and monitoring solutions.", "Medium", Building2],
] as const;

const decisions = [
  ["Evaluate partnership opportunity with Anthropic", "Based on 12 relevant signals"],
  ["Assess market entry in European defense tech", "Based on 8 relevant signals"],
  ["Review AI governance tool landscape", "Based on 6 relevant signals"],
];

function MetricCard({ label, value, change, note, icon: Icon }: { label: string; value: string; change?: string; note?: string; icon: typeof BarChart3 }) {
  return (
    <article className="ref-metric-card">
      <div>
        <span className="ref-label">{label}</span>
        <div className="ref-metric-line">
          <strong>{value}</strong>
          {change ? <span className="ref-change"><ArrowUp size={12} /> {change}</span> : null}
        </div>
        {note ? <small>{note}</small> : <small>vs. last 30 days</small>}
      </div>
      <Icon size={33} strokeWidth={1.45} />
    </article>
  );
}

export default function Home() {
  return (
    <div className="content radar-reference-content">
      <section className="ref-heading-row">
        <div>
          <h1>Good evening, Dipanshu.</h1>
          <p>Actionable intelligence for what’s next.</p>
        </div>
        <div className="ref-heading-meta">
          <span>PEOPLE</span><i>/</i><span>SIGNALS</span><i>/</i><span>INSIGHTS</span><i>/</i><span>ACTION</span>
          <b />
          <em>A<br />CLEARER<br />TOMORROW</em>
        </div>
      </section>

      <section className="ref-metric-grid">
        <MetricCard label="TOTAL SIGNALS" value="1,248" change="12%" icon={BarChart3} />
        <MetricCard label="KEY OPPORTUNITIES" value="24" change="33%" icon={Layers3} />
        <MetricCard label="COMPETITORS TRACKED" value="87" change="6%" icon={Users} />
        <MetricCard label="MARKETS MONITORED" value="12" note="No change" icon={Globe2} />
      </section>

      <section className="ref-middle-grid">
        <article className="ref-hero-card">
          <div className="ref-hero-overlay">
            <span className="ref-kicker">MARKET INTELLIGENCE</span>
            <h2>Change before<br />it’s obvious.</h2>
            <p>Real-time signals. Deeper context.<br />A clearer edge.</p>
            <Link href="/signals" className="ref-hero-button">Explore Insights <ArrowUpRight size={15} /></Link>
          </div>
          <div className="ref-hero-signal"><span>SIGNALS TODAY</span><strong>+42%</strong><i /><b /></div>
          <div className="ref-mountain-scene" aria-hidden="true">
            <span className="ridge r1" /><span className="ridge r2" /><span className="ridge r3" /><span className="ridge r4" />
          </div>
          <span className="ref-hero-tag">A CLEARER<br />TOMORROW</span>
        </article>

        <article className="ref-chart-card">
          <div className="ref-card-title-row"><strong>SIGNAL VOLUME</strong><span>Last 30 days⌄</span></div>
          <div className="ref-chart">
            <div className="ref-chart-y"><span>300</span><span>200</span><span>100</span><span>0</span></div>
            <div className="ref-chart-grid-lines"><i /><i /><i /><i /></div>
            <div className="ref-bars">
              {signalBars.map((v, i) => <motion.span key={i} initial={{ height: 0 }} animate={{ height: `${Math.max(8, v / 3)}%` }} transition={{ delay: i * .018 }} className={i === signalBars.length - 1 ? "active" : ""} />)}
            </div>
            <div className="ref-tooltip"><strong>Sep 9, 2026</strong><span>287 signals</span></div>
          </div>
          <div className="ref-chart-x"><span>Aug 13</span><span>Aug 20</span><span>Aug 27</span><span>Sep 3</span><span>Sep 9</span></div>
        </article>
      </section>

      <section className="ref-bottom-grid">
        <article className="ref-list-card">
          <div className="ref-card-title-row"><strong>TOP SIGNALS</strong><Link href="/signals">View all <ArrowUpRight size={13} /></Link></div>
          <div className="ref-signal-list">
            {topSignals.map(([title, type, time, level], i) => (
              <Link href="/signals/enterprise-hiring" className="ref-signal-item" key={title}>
                <div className="ref-thumb"><span className={`thumb-line t${i + 1}`} /></div>
                <div><strong>{title}</strong><span>{type} <i>•</i> {time}</span></div>
                <em>{level}</em>
              </Link>
            ))}
          </div>
        </article>

        <article className="ref-list-card">
          <div className="ref-card-title-row"><strong>KEY OPPORTUNITIES</strong><Link href="/discover">View all <ArrowUpRight size={13} /></Link></div>
          <div className="ref-opportunity-list">
            {opportunities.map(([title, desc, level, Icon]) => (
              <Link href="/discover" className="ref-opportunity-item" key={title}>
                <span className="ref-op-icon"><Icon size={17} /></span>
                <div><strong>{title}</strong><p>{desc}</p></div>
                <em>{level}</em>
              </Link>
            ))}
          </div>
        </article>

        <article className="ref-decision-card">
          <div className="ref-card-title-row"><strong>STRATEGIC DECISIONS</strong><span className="ref-new-badge">3 NEW</span></div>
          <div className="ref-decision-list">
            {decisions.map(([title, note], i) => (
              <Link href="/decisions" className="ref-decision-item" key={title}>
                <span>{i + 1}</span>
                <div><strong>{title}</strong><small>{note}</small></div>
                <ChevronRight size={17} />
              </Link>
            ))}
          </div>
          <Link href="/decisions" className="ref-decision-button">View Decision Brief <ArrowUpRight size={14} /></Link>
        </article>
      </section>
    </div>
  );
}
