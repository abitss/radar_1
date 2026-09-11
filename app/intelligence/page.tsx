import Link from "next/link";
import { ArrowUpRight, Crosshair, Radar, Signal, Sparkles } from "lucide-react";
import { PageIntro } from "@/components/intelligence-ui";

const layers = [
  {
    title: "Signals",
    description: "A Signal is one verified external change that matters to your company. Start here when you want the evidence.",
    href: "/signals",
    icon: Signal,
    meta: "ONE MEANINGFUL CHANGE",
  },
  {
    title: "Moves",
    description: "A Move connects several Signals into one strategic pattern, such as a competitor entering a new market.",
    href: "/moves",
    icon: Radar,
    meta: "A PATTERN FORMING",
  },
  {
    title: "Opportunities",
    description: "Potential openings RADAR identifies from market movement. Review them before turning them into decisions.",
    href: "/discover",
    icon: Sparkles,
    meta: "A POSSIBLE OPENING",
  },
  {
    title: "Market Map",
    description: "See the wider landscape around your company so individual Signals and Moves have the right strategic context.",
    href: "/market-map",
    icon: Crosshair,
    meta: "THE BIGGER PICTURE",
  },
];

export default function IntelligencePage() {
  return (
    <div className="content">
      <PageIntro
        eyebrow="INTELLIGENCE"
        title="Understand what is changing."
        description="RADAR turns raw monitoring into a small number of things worth understanding. Each layer answers a different question."
      />

      <div className="radar-hub-question">
        <div>
          <span>THE JOB OF INTELLIGENCE</span>
          <strong>Turn noise into meaning before you make a decision.</strong>
        </div>
        <small>You do not need to read everything. Signals are evidence, Moves are patterns, Opportunities are openings, and the Market Map gives context.</small>
      </div>

      <section className="radar-hub-grid">
        {layers.map(({ title, description, href, icon: Icon, meta }) => (
          <Link className="radar-hub-card" href={href} key={title}>
            <div className="radar-hub-card-top">
              <span className="radar-hub-icon"><Icon size={18} strokeWidth={1.7} /></span>
              <span>{meta}</span>
            </div>
            <h2>{title}</h2>
            <p>{description}</p>
            <footer>Open {title} <ArrowUpRight size={13} /></footer>
          </Link>
        ))}
      </section>

      <div className="radar-flow-strip" aria-label="RADAR intelligence flow">
        <div className="radar-flow-step"><span>01</span><strong>Evidence appears</strong></div>
        <div className="radar-flow-step"><span>02</span><strong>Signal is created</strong></div>
        <div className="radar-flow-step"><span>03</span><strong>Signals form a Move</strong></div>
        <div className="radar-flow-step"><span>04</span><strong>Decision becomes clear</strong></div>
      </div>
    </div>
  );
}
