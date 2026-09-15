import { PageIntro, StatTile, WatchGraphVisual } from "@/components/intelligence-ui";

export default function WatchGraphPage() {
  return <div className="content"><PageIntro eyebrow="INTELLIGENCE PERIMETER" title="Watch Graph" description="The live universe RADAR watches around ReadRight, from competitors to markets, technologies and buyers." /><section className="metrics-grid"><StatTile label="Tracked entities" value="37" note="7 added this month" /><StatTile label="Watch targets" value="24" note="22 healthy" /><StatTile label="Relationships" value="86" note="Cross-linked" /><StatTile label="Coverage" value="87%" note="Across priority themes" /></section><article className="panel watch-panel"><WatchGraphVisual /></article></div>;
}
