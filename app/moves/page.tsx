import { MovesBoard, PageIntro, StatTile } from "@/components/intelligence-ui";

export default function MovesPage() {
  return <div className="content"><PageIntro eyebrow="CORRELATION ENGINE" title="RADAR Moves" description="Strategic developments formed by connecting multiple independent signals into one coherent pattern." /><section className="metrics-grid"><StatTile label="Active Moves" value="4" note="2 confirmed" /><StatTile label="Forming" value="2" note="Needs more evidence" /><StatTile label="Avg confidence" value="81%" note="Across active Moves" /><StatTile label="High impact" value="2" note="Founder attention" /></section><MovesBoard /></div>;
}
