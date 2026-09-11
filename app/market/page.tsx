import Link from "next/link";
import { ArrowUpRight, Radar, ScanSearch, ShieldAlert, Sparkles } from "lucide-react";
import { CompetitorRadar } from "@/components/competitor-radar";
import { PageIntro, StatTile } from "@/components/intelligence-ui";

export default function MarketPage(){
  return <div className="content">
    <PageIntro
      eyebrow="COMPETITIVE INTELLIGENCE"
      title="See every company that can become your competitor."
      description="RADAR maps direct, adjacent, emerging and micro-level competitors around your startup. Distance represents strategic similarity, and movement shows who is converging toward you."
      action={<Link href="/discover" className="primary-button"><ScanSearch size={14}/>Discover competitors</Link>}
    />

    <section className="metrics-grid">
      <StatTile label="Competitive universe" value="84" note="Companies discovered" />
      <StatTile label="Core competitors" value="7" note="Similarity ≥ 80%" />
      <StatTile label="Micro overlaps" value="23" note="Feature or capability level" />
      <StatTile label="Moved closer" value="5" note="Last 30 days" />
    </section>

    <CompetitorRadar />

    <section className="founder-two-col competition-bottom-grid">
      <article className="panel founder-panel founder-dark-panel">
        <div className="founder-panel-head"><div><span>EARLY WARNING</span><h2>Detect convergence before it becomes obvious.</h2></div><Radar size={21}/></div>
        <p>A company does not need to call itself your competitor. RADAR watches changes in product, buyer, pricing, hiring, technology and positioning, then recalculates competitive proximity automatically.</p>
        <Link href="/moves" className="founder-dark-link">See strategic moves <ArrowUpRight size={14}/></Link>
      </article>

      <article className="panel founder-panel">
        <div className="founder-panel-head"><div><span>FOUNDER ATTENTION</span><h2>What deserves action</h2></div><ShieldAlert size={21}/></div>
        <div className="founder-list-rows">
          <div><strong>One direct competitor is moving inward</strong><span>Buyer and workflow overlap increased this month.</span></div>
          <div><strong>Three micro-competitors matter</strong><span>They overlap with capabilities that could become your wedge or dependency.</span></div>
          <div><strong>One emerging entrant is worth watching</strong><span>Low similarity today, but trajectory is toward your category.</span></div>
        </div>
      </article>
    </section>

    <section className="panel competition-decision-banner">
      <div><Sparkles size={18}/><span>RADAR PRINCIPLE</span><strong>Never show a founder a change without explaining what it means and what to do next.</strong></div>
      <Link href="/decisions">Open decision engine <ArrowUpRight size={14}/></Link>
    </section>
  </div>
}
