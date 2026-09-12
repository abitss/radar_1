import { PageIntro, StatTile } from "@/components/intelligence-ui";

const outcomes = [
  ["Pricing test", "Higher conversion in the mid-market segment after reducing setup friction.", "+18% conversion"],
  ["Competitor response", "A tracked competitor matched the new feature bundle within three weeks.", "Observed"],
  ["Channel experiment", "Founder-led outbound produced stronger quality than paid acquisition for this segment.", "2.1× qualified"],
];

export default function OutcomesPage() {
  return (
    <div className="content">
      <PageIntro
        eyebrow="LEARNING LOOP"
        title="Outcomes"
        description="Close the loop on decisions. Record what actually happened so RADAR can learn what works for your company."
      />
      <section className="metrics-grid">
        <StatTile label="Logged" value="6" note="This quarter" />
        <StatTile label="Positive" value="4" note="Clear upside" />
        <StatTile label="Mixed" value="1" note="Needs context" />
        <StatTile label="Negative" value="1" note="Useful learning" />
      </section>
      <section className="radar-outcome-list">
        {outcomes.map(([title, summary, result]) => (
          <div className="radar-outcome-row" key={title}>
            <span>{title}</span>
            <strong>{summary}</strong>
            <em>{result}</em>
          </div>
        ))}
      </section>
    </div>
  );
}
