import { BrainBootstrap, PageIntro, StatTile } from "@/components/intelligence-ui";

export default function BrainPage() {
  return (
    <div className="content">
      <PageIntro eyebrow="COMPANY BRAIN · VERIFIED" title="RADAR understands what your company is trying to win." description="This is the strategic context engine behind every signal, Move, recommendation and briefing." />
      <section className="metrics-grid brain-metrics">
        <StatTile label="Brain confidence" value="94%" note="High-context model" />
        <StatTile label="Tracked entities" value="37" note="Across market universe" />
        <StatTile label="Watch targets" value="24" note="Continuously monitored" />
        <StatTile label="Evidence sources" value="68" note="First-party prioritized" />
      </section>
      <BrainBootstrap />
    </div>
  );
}
