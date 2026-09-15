import Link from "next/link";
import { ArrowUpRight, BrainCircuit, Building2, Database, Star } from "lucide-react";
import { PageIntro } from "@/components/intelligence-ui";

const areas = [
  {
    title: "Companies",
    description: "Track competitors and other organizations that matter to your market. See who changed and why it matters.",
    href: "/companies",
    icon: Building2,
    meta: "WHO YOU WATCH",
  },
  {
    title: "Watchlists",
    description: "Choose the companies, themes, technologies and relationships RADAR should keep watching continuously.",
    href: "/watch-graph",
    icon: Star,
    meta: "WHAT YOU WATCH",
  },
  {
    title: "Sources",
    description: "See where evidence comes from, check monitoring coverage and control which sources deserve attention.",
    href: "/sources",
    icon: Database,
    meta: "WHERE RADAR LOOKS",
  },
  {
    title: "Company Brain",
    description: "Review the company context RADAR uses to decide what is relevant to you and what can safely be ignored.",
    href: "/brain",
    icon: BrainCircuit,
    meta: "WHY IT MATTERS TO YOU",
  },
];

export default function MonitorPage() {
  return (
    <div className="content">
      <PageIntro
        eyebrow="MONITOR"
        title="Choose what RADAR watches."
        description="All monitoring controls live here. You should not need to think about Signals, Moves or Decisions until RADAR has something meaningful to show you."
      />

      <div className="radar-hub-question">
        <div>
          <span>THE JOB OF MONITOR</span>
          <strong>Keep RADAR pointed at the right parts of your world.</strong>
        </div>
        <small>Set the universe once. RADAR keeps checking it in the background and sends meaningful changes into Intelligence.</small>
      </div>

      <section className="radar-hub-grid">
        {areas.map(({ title, description, href, icon: Icon, meta }) => (
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
    </div>
  );
}
