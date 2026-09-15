import Link from "next/link";
import { ArrowRight, Banknote, CircleAlert, Gauge, Landmark } from "lucide-react";
import { PageIntro, StatTile } from "@/components/intelligence-ui";

export default function MoneyPage(){
  return <div className="content">
    <PageIntro eyebrow="MONEY" title="How long can the company survive?" description="Runway, burn, revenue efficiency and fundraising readiness in one founder view. Numbers here are demo data until finance integrations are connected." />
    <section className="metrics-grid">
      <StatTile label="Runway" value="11.4 mo" note="At current net burn" />
      <StatTile label="Monthly burn" value="₹8.2L" note="3-month average" />
      <StatTile label="Monthly revenue" value="₹3.1L" note="+12% vs prior month" />
      <StatTile label="Fundraise window" value="5 mo" note="Start before runway gets tight" />
    </section>

    <section className="founder-two-col">
      <article className="panel founder-panel founder-dark-panel">
        <div className="founder-panel-head"><div><span>SURVIVAL CLOCK</span><h2>11.4 months of runway</h2></div><Gauge size={21}/></div>
        <div className="runway-track"><span style={{width:"57%"}} /></div>
        <div className="runway-scale"><span>Now</span><span>6 mo</span><span>12 mo</span><span>18 mo</span></div>
        <p>If growth stalls and burn stays unchanged, the company reaches a high-risk financing zone in roughly five months.</p>
      </article>
      <article className="panel founder-panel founder-warning">
        <div className="founder-panel-head"><div><span>CAPITAL RISK</span><h2>Fundraising cannot start at zero runway.</h2></div><CircleAlert size={21}/></div>
        <p>RADAR should warn founders early enough to choose between raising, cutting burn, increasing revenue, or changing plan before cash becomes the only decision.</p>
        <div className="founder-action-block"><span>NEXT ACTION</span><strong>Build a 12-month scenario with base, downside and raise cases.</strong></div>
      </article>
    </section>

    <section className="founder-three-col">
      <article className="panel founder-link-card"><Banknote/><span>UNIT ECONOMICS</span><h3>Is growth buying value?</h3><p>Track acquisition cost, gross margin and payback before scaling spend.</p></article>
      <article className="panel founder-link-card"><Landmark/><span>FUNDRAISING</span><h3>Are you raise-ready?</h3><p>Traction, narrative, milestones and runway translated into a raise timeline.</p></article>
      <Link href="/ask" className="panel founder-link-card"><ArrowRight/><span>SCENARIO</span><h3>Ask RADAR what happens if…</h3><p>Model burn cuts, hiring, pricing and fundraising choices.</p></Link>
    </section>
  </div>
}
