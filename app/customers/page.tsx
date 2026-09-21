import Link from "next/link";
import { ArrowRight, CircleAlert, MessageSquareText, Repeat2, Users } from "lucide-react";
import { PageIntro, StatTile } from "@/components/intelligence-ui";

const truth = [
  { label: "Problem intensity", value: "Strong", note: "7/10 recent conversations describe the pain without prompting" },
  { label: "Usage retention", value: "62%", note: "Weekly active retention after 4 weeks" },
  { label: "Willingness to pay", value: "6/10", note: "Qualified users who accepted the current price range" },
  { label: "Referral pull", value: "3", note: "Customers who introduced another buyer this month" },
];

export default function CustomersPage(){
  return <div className="content">
    <PageIntro eyebrow="CUSTOMER TRUTH" title="Do customers actually want this?" description="RADAR should answer this before you hire, scale spend or convince yourself that activity equals product-market fit." />
    <section className="metrics-grid">
      <StatTile label="Customer conversations" value="18" note="This month" />
      <StatTile label="Strong pain signals" value="11" note="Unaided problem mentions" />
      <StatTile label="4-week retention" value="62%" note="Needs improvement" />
      <StatTile label="Revenue retained" value="91%" note="Last 30 days" />
    </section>

    <section id="truth" className="founder-two-col">
      <article className="panel founder-panel">
        <div className="founder-panel-head"><div><span>CUSTOMER TRUTH</span><h2>What the market is telling you</h2></div><MessageSquareText size={21}/></div>
        <div className="founder-truth-list">{truth.map((x)=><div key={x.label}><span>{x.label}</span><strong>{x.value}</strong><small>{x.note}</small></div>)}</div>
      </article>
      <article className="panel founder-panel founder-warning">
        <div className="founder-panel-head"><div><span>FOUNDER RISK</span><h2>Do not scale yet</h2></div><CircleAlert size={21}/></div>
        <p>Your retention and referral pull are not strong enough to treat demand as proven. RADAR would keep acquisition spend conservative until the product creates stronger repeat behavior.</p>
        <div className="founder-action-block"><span>THIS WEEK</span><strong>Interview 5 churned or inactive users and identify the first moment they stopped receiving value.</strong></div>
      </article>
    </section>

    <section id="pmf" className="panel founder-panel founder-wide-panel">
      <div className="founder-panel-head"><div><span>PMF EVIDENCE</span><h2>Product-market fit is a pattern, not a badge.</h2></div><Repeat2 size={21}/></div>
      <div className="founder-score-row"><div><span>Retention</span><strong>62%</strong></div><div><span>Organic / referral growth</span><strong>18%</strong></div><div><span>Expansion</span><strong>9%</strong></div><div><span>Churn pressure</span><strong>Medium</strong></div></div>
    </section>

    <section id="pipeline" className="panel founder-panel founder-wide-panel">
      <div className="founder-panel-head"><div><span>PIPELINE</span><h2>Revenue reality</h2></div><Users size={21}/></div>
      <div className="founder-pipeline-row"><div><span>Qualified</span><strong>14</strong></div><ArrowRight/><div><span>Demo / trial</span><strong>8</strong></div><ArrowRight/><div><span>Decision</span><strong>5</strong></div><ArrowRight/><div><span>Won</span><strong>2</strong></div></div>
      <Link className="secondary-button" href="/ask">Ask RADAR what is blocking conversion</Link>
    </section>
  </div>
}
