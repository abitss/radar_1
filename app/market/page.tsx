import Link from "next/link";
import { ArrowUpRight, Building2, Radar, ShieldAlert, Sparkles } from "lucide-react";
import { PageIntro, StatTile } from "@/components/intelligence-ui";

export default function MarketPage(){
  return <div className="content">
    <PageIntro eyebrow="MARKET" title="What changed outside your company?" description="Competitors, category movement, regulation, technology and buyer behavior distilled into what can change your strategy." />
    <section className="metrics-grid">
      <StatTile label="New signals" value="12" note="4 high impact" />
      <StatTile label="Active Moves" value="4" note="2 confirmed" />
      <StatTile label="Competitors changed" value="5" note="Last 24 hours" />
      <StatTile label="Open opportunities" value="3" note="Needs founder review" />
    </section>

    <section className="founder-two-col">
      <article className="panel founder-panel founder-dark-panel">
        <div className="founder-panel-head"><div><span>MOST IMPORTANT CHANGE</span><h2>A competitor is moving upstream.</h2></div><Radar size={21}/></div>
        <p>Multiple signals suggest a direct competitor is repositioning toward larger institutional buyers. This matters because it may change pricing expectations, procurement cycles and your differentiation story.</p>
        <Link href="/moves" className="founder-dark-link">See the evidence <ArrowUpRight size={14}/></Link>
      </article>
      <article className="panel founder-panel">
        <div className="founder-panel-head"><div><span>THREAT</span><h2>What can hurt you</h2></div><ShieldAlert size={21}/></div>
        <div className="founder-list-rows"><div><strong>Pricing compression</strong><span>Two players reduced entry pricing this month.</span></div><div><strong>Distribution advantage</strong><span>A competitor added a channel partnership in your target segment.</span></div></div>
      </article>
    </section>

    <section className="founder-three-col">
      <Link href="/signals" className="panel founder-link-card"><Radar/><span>SIGNALS</span><h3>See verified changes</h3><p>Evidence before interpretation.</p></Link>
      <Link href="/companies" className="panel founder-link-card"><Building2/><span>COMPETITORS</span><h3>Know who is moving</h3><p>Track only companies that can actually affect you.</p></Link>
      <Link href="/discover" className="panel founder-link-card"><Sparkles/><span>OPPORTUNITIES</span><h3>Find openings early</h3><p>Potential whitespace created by market movement.</p></Link>
    </section>
  </div>
}
