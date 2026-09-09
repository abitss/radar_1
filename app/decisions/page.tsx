import { DecisionBoard, PageIntro, StatTile } from "@/components/intelligence-ui";

export default function DecisionsPage() {
  return <div className="content"><PageIntro eyebrow="DECISION INTELLIGENCE" title="Decisions" description="Translate market change into concrete strategic choices, with options, assumptions and expected outcomes." /><section className="metrics-grid"><StatTile label="Open decisions" value="3" note="1 urgent" /><StatTile label="Accepted" value="8" note="This quarter" /><StatTile label="Outcomes logged" value="6" note="Learning enabled" /><StatTile label="Avg confidence" value="84%" note="Evidence-weighted" /></section><DecisionBoard /></div>;
}
