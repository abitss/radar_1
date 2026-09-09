"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, BrainCircuit, CheckCircle2, Compass, Globe2, Radar, Search, Sparkles } from "lucide-react";

const steps = [
  { label: "Verify company", detail: "Reading website and first-party pages", icon: Globe2, progress: 100 },
  { label: "Understand company", detail: "Products, buyers, positioning and strategic themes", icon: BrainCircuit, progress: 100 },
  { label: "Discover competitors", detail: "Finding direct, adjacent and emerging players", icon: Search, progress: 92 },
  { label: "Build market universe", detail: "Connecting companies, markets, technologies and buyers", icon: Compass, progress: 88 },
  { label: "Create first briefing", detail: "Turning evidence into founder-level intelligence", icon: Sparkles, progress: 100 },
];

export default function OnboardingPage() {
  return (
    <div className="content onboarding-page">
      <div className="onboarding-shell">
        <motion.div className="onboarding-head" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="onboarding-radar"><Radar size={30} /><span className="scan-line" /></div>
          <span className="tiny-label">COMPANY BRAIN BOOTSTRAP</span>
          <h1>RADAR is learning how ReadRight sees the world.</h1>
          <p>We verify first-party evidence, understand your company, map competitors, build the Watch Graph and create the first strategic briefing.</p>
        </motion.div>

        <div className="onboarding-progress-card panel">
          <div className="onboarding-total"><div><span>Company Brain</span><strong>96%</strong></div><div className="total-progress"><motion.span initial={{ width: 0 }} animate={{ width: "96%" }} transition={{ duration: 1.6, ease: "easeOut" }} /></div></div>
          <div className="onboarding-steps">
            {steps.map(({ label, detail, icon: Icon, progress }, i) => (
              <motion.div className="onboarding-step" key={label} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .15 + i * .09 }}>
                <div className={`onboarding-icon ${progress === 100 ? "done" : "working"}`}>{progress === 100 ? <CheckCircle2 size={18} /> : <Icon size={18} />}</div>
                <div className="onboarding-copy"><strong>{label}</strong><span>{detail}</span></div>
                <div className="step-progress"><span style={{ width: `${progress}%` }} /></div>
                <em>{progress === 100 ? "Done" : `${progress}%`}</em>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="onboarding-evidence-grid">
          <article className="panel onboarding-mini"><span>Verified company</span><strong>ReadRight</strong><small>Learning Intelligence · India</small></article>
          <article className="panel onboarding-mini"><span>Competitor candidates</span><strong>9</strong><small>6 direct · 3 adjacent</small></article>
          <article className="panel onboarding-mini"><span>Watch targets created</span><strong>24</strong><small>Companies · markets · technologies</small></article>
        </div>

        <div className="onboarding-footer"><div><span className="live-dot" />Evidence protection is active. RADAR will not invent missing company facts.</div><Link href="/brain" className="primary-button">Open Company Brain <ArrowRight size={15} /></Link></div>
      </div>
    </div>
  );
}
