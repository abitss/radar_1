import { PageIntro, SignalTable, StatTile } from "@/components/intelligence-ui";

export default function SignalsPage() {
  return <div className="content"><PageIntro eyebrow="EVIDENCE LAYER" title="Signals" description="Meaningful external changes filtered for relevance, confidence, novelty and strategic impact." /><section className="metrics-grid"><StatTile label="Actionable" value="12" note="4 new today" /><StatTile label="High impact" value="5" note="Impact ≥ 80" /><StatTile label="Verified" value="91%" note="Evidence attached" /><StatTile label="Noise removed" value="143" note="Last 24 hours" /></section><article className="panel table-panel"><SignalTable /></article></div>;
}
