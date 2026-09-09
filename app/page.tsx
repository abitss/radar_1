"use client";

import { motion } from "framer-motion";
import {
  Activity,
  ArrowUpRight,
  Bell,
  BrainCircuit,
  Building2,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Compass,
  Crosshair,
  Database,
  FileText,
  Gauge,
  GitBranch,
  LayoutDashboard,
  MessageSquareText,
  Radar,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { RadarLogo } from "@/components/radar-logo";

const nav = [
  ["Today", LayoutDashboard],
  ["Discover", Compass],
  ["Companies", Building2],
  ["Signals", Activity],
  ["RADAR Moves", Radar],
  ["Decisions", BrainCircuit],
  ["Actions", CheckCircle2],
  ["Watch Graph", GitBranch],
  ["Market Map", Crosshair],
  ["Briefings", FileText],
  ["Ask RADAR", MessageSquareText],
  ["Sources & Alerts", Bell],
  ["System Health", Gauge],
];

const signals = [
  {
    company: "LearnSphere",
    title: "Enterprise hiring accelerated across sales and customer success",
    type: "GTM",
    score: 91,
    time: "18 min ago",
  },
  {
    company: "SkillForge AI",
    title: "New assessment product page detected with institutional positioning",
    type: "Product",
    score: 86,
    time: "47 min ago",
  },
  {
    company: "Market",
    title: "Three emerging players are converging on foundational learning diagnostics",
    type: "Market",
    score: 78,
    time: "2 hr ago",
  },
];

const bars = [28, 36, 31, 49, 41, 56, 52, 71, 63, 81, 76, 92];

function ScoreRing({ value }: { value: number }) {
  const circumference = 2 * Math.PI * 18;
  const dash = (value / 100) * circumference;
  return (
    <div className="score-ring" aria-label={`${value} percent`}>
      <svg viewBox="0 0 44 44">
        <circle className="score-track" cx="22" cy="22" r="18" />
        <circle
          className="score-progress"
          cx="22"
          cy="22"
          r="18"
          strokeDasharray={`${dash} ${circumference - dash}`}
        />
      </svg>
      <span>{value}</span>
    </div>
  );
}

function IntelligenceGraph() {
  return (
    <div className="graph-wrap">
      <div className="graph-grid" />
      <svg viewBox="0 0 780 255" preserveAspectRatio="none" className="line-graph">
        <defs>
          <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          className="area-path"
          d="M0 211 C65 210 78 176 130 181 S205 150 257 159 S339 120 388 132 S466 94 522 105 S604 61 654 74 S728 34 780 43 L780 255 L0 255 Z"
          fill="url(#area)"
        />
        <motion.path
          d="M0 211 C65 210 78 176 130 181 S205 150 257 159 S339 120 388 132 S466 94 522 105 S604 61 654 74 S728 34 780 43"
          fill="none"
          className="trend-path"
          strokeWidth="2.3"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.6, ease: "easeInOut" }}
        />
        <circle cx="780" cy="43" r="5" className="graph-dot" />
      </svg>
      <div className="graph-labels">
        <span>04 SEP</span><span>05 SEP</span><span>06 SEP</span><span>07 SEP</span><span>08 SEP</span><span>TODAY</span>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <RadarLogo />
          <span className="brand-badge">BETA</span>
        </div>

        <button className="workspace-switcher">
          <div className="workspace-avatar">R</div>
          <div>
            <strong>ReadRight</strong>
            <span>Primary workspace</span>
          </div>
          <ChevronDown size={15} />
        </button>

        <nav className="nav-list">
          {nav.map(([label, Icon], index) => (
            <button className={`nav-item ${index === 0 ? "active" : ""}`} key={label as string}>
              <Icon size={17} />
              <span>{label as string}</span>
              {label === "Signals" && <em>12</em>}
              {label === "Decisions" && <em>3</em>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button className="nav-item"><Settings size={17} /><span>Settings</span></button>
          <div className="system-pill"><span className="live-dot" />All systems operational</div>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div className="command-search">
            <Search size={16} />
            <span>Search intelligence...</span>
            <kbd>⌘ K</kbd>
          </div>
          <div className="top-actions">
            <button className="icon-button"><Bell size={17} /><span className="notification-dot" /></button>
            <button className="profile-button"><span>DS</span><ChevronDown size={14} /></button>
          </div>
        </header>

        <div className="content">
          <motion.div
            className="page-heading"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            <div>
              <div className="eyebrow"><span className="live-dot" /> LIVE INTELLIGENCE · 09 SEP 2026</div>
              <h1>Good evening, Dipanshu.</h1>
              <p>Your market moved today. RADAR found <strong>4 developments</strong> worth your attention.</p>
            </div>
            <button className="primary-button"><Sparkles size={16} /> Ask RADAR</button>
          </motion.div>

          <section className="hero-grid">
            <motion.article className="priority-card" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.12 }}>
              <div className="priority-topline">
                <span className="priority-label"><Zap size={14} /> HIGH PRIORITY MOVE</span>
                <span className="confidence">91% confidence</span>
              </div>
              <h2>A competitor appears to be preparing an enterprise expansion.</h2>
              <p>Hiring, pricing, compliance and product changes now point in the same direction. This is no longer a weak signal.</p>
              <div className="evidence-row">
                <div><strong>5</strong><span>corroborating changes</span></div>
                <div><strong>High</strong><span>potential impact</span></div>
                <div><strong>3d</strong><span>pattern forming</span></div>
              </div>
              <div className="recommendation">
                <div className="recommendation-icon"><Target size={18} /></div>
                <div>
                  <span>RADAR RECOMMENDS</span>
                  <p>Accelerate school-pilot case studies before enterprise competitors establish institutional proof.</p>
                </div>
                <button><ArrowUpRight size={17} /></button>
              </div>
            </motion.article>

            <motion.article className="brain-card" initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
              <div className="card-heading">
                <div><span className="card-icon"><BrainCircuit size={17} /></span><div><strong>Company Brain</strong><small>Understanding ReadRight</small></div></div>
                <span className="status-chip">HEALTHY</span>
              </div>
              <div className="brain-score">
                <ScoreRing value={94} />
                <div><strong>Deep context</strong><span>RADAR has high confidence in your company model.</span></div>
              </div>
              <div className="brain-stats">
                <div><span>Tracked entities</span><strong>37</strong></div>
                <div><span>Watch targets</span><strong>24</strong></div>
                <div><span>Evidence sources</span><strong>68</strong></div>
              </div>
              <button className="text-button">Open Company Brain <ArrowUpRight size={14} /></button>
            </motion.article>
          </section>

          <section className="metrics-grid">
            {[
              ["Actionable signals", "12", "+4 today", Activity],
              ["RADAR Moves", "4", "2 forming", Radar],
              ["Open decisions", "3", "1 urgent", BrainCircuit],
              ["Sensor coverage", "87%", "+6% this week", ShieldCheck],
            ].map(([label, value, note, Icon], i) => (
              <motion.article className="metric-card" key={label as string} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + i * 0.06 }}>
                <div className="metric-icon"><Icon size={17} /></div>
                <span>{label as string}</span>
                <strong>{value as string}</strong>
                <small>{note as string}</small>
              </motion.article>
            ))}
          </section>

          <section className="dashboard-grid">
            <article className="panel trend-panel">
              <div className="panel-heading">
                <div><h3>Intelligence velocity</h3><p>Meaningful market change detected over time</p></div>
                <button className="range-button">7 days <ChevronDown size={13} /></button>
              </div>
              <div className="trend-number"><strong>+38%</strong><span><TrendingUp size={13} /> vs previous period</span></div>
              <IntelligenceGraph />
            </article>

            <article className="panel moves-panel">
              <div className="panel-heading">
                <div><h3>Moves forming</h3><p>Patterns RADAR is connecting now</p></div>
                <button className="ghost-link">View all</button>
              </div>
              <div className="move-list">
                {[
                  ["Enterprise expansion", "LearnSphere", 89],
                  ["AI product push", "SkillForge", 81],
                  ["New geography", "EduNova", 72],
                ].map(([move, company, confidence]) => (
                  <div className="move-row" key={move as string}>
                    <div className="move-orbit"><span /></div>
                    <div className="move-copy"><strong>{move as string}</strong><span>{company as string}</span></div>
                    <div className="move-score">{confidence as number}%</div>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="lower-grid">
            <article className="panel signals-panel">
              <div className="panel-heading">
                <div><h3>Evidence-backed signals</h3><p>What changed and why RADAR thinks it matters</p></div>
                <button className="ghost-link">Open Signals</button>
              </div>
              <div className="signal-list">
                {signals.map((signal) => (
                  <button className="signal-row" key={signal.title}>
                    <ScoreRing value={signal.score} />
                    <div className="signal-copy">
                      <div><span className="signal-company">{signal.company}</span><span className="signal-type">{signal.type}</span><span className="signal-time">{signal.time}</span></div>
                      <strong>{signal.title}</strong>
                    </div>
                    <ArrowUpRight size={16} />
                  </button>
                ))}
              </div>
            </article>

            <article className="panel sensor-panel">
              <div className="panel-heading"><div><h3>Sensor health</h3><p>Intelligence perimeter status</p></div><span className="live-chip">LIVE</span></div>
              <div className="sensor-visual">
                <div className="radar-scope"><div className="sweep" /><span className="ping ping-a" /><span className="ping ping-b" /><span className="ping ping-c" /><div className="scope-center" /></div>
              </div>
              <div className="sensor-stats">
                <div><span>Sources online</span><strong>68 / 72</strong></div>
                <div><span>Last scan</span><strong>2m ago</strong></div>
                <div><span>Queue</span><strong>Healthy</strong></div>
              </div>
            </article>
          </section>

          <section className="panel market-strip">
            <div className="market-title"><CircleDot size={17} /><div><strong>Market pulse</strong><span>12 meaningful signals detected in the last 24 hours</span></div></div>
            <div className="micro-bars">
              {bars.map((h, i) => <motion.span key={i} initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ delay: 0.45 + i * 0.035 }} />)}
            </div>
            <button className="secondary-button">Open market map <ArrowUpRight size={14} /></button>
          </section>
        </div>
      </section>
    </main>
  );
}
