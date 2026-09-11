"use client";

import { useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowUpRight, Building2, Crosshair, GitBranch, Layers3, Radar, Search, ShieldCheck, Sparkles } from "lucide-react";

type Competitor = {
  id: string;
  name: string;
  similarity: number;
  threat: number;
  x: number;
  y: number;
  kind: "direct" | "adjacent" | "micro" | "emerging";
  movement: "inward" | "stable" | "outward";
  shared: string[];
  why: string;
};

const competitors: Competitor[] = [
  { id:"c1", name:"LearnFlow", similarity:94, threat:91, x:55, y:43, kind:"direct", movement:"inward", shared:["Same buyer","Same workflow","AI assessment","Teacher dashboard"], why:"Competes for the same buyer and solves nearly the same core workflow." },
  { id:"c2", name:"SkillTrace", similarity:86, threat:82, x:44, y:48, kind:"direct", movement:"stable", shared:["Same buyer","Diagnostics","Progress tracking"], why:"Strong product and buyer overlap, but a narrower diagnostic workflow." },
  { id:"c3", name:"ClassPulse", similarity:73, threat:67, x:60, y:58, kind:"adjacent", movement:"inward", shared:["Schools","Teacher analytics","Reporting"], why:"Adjacent today, but moving toward the same school decision-maker." },
  { id:"c4", name:"TutorMesh", similarity:62, threat:54, x:37, y:35, kind:"adjacent", movement:"stable", shared:["Learning plans","Student progress","Tutor workflow"], why:"Overlaps on remediation workflow, but serves a different delivery model." },
  { id:"c5", name:"VoiceAssess", similarity:47, threat:63, x:72, y:35, kind:"micro", movement:"inward", shared:["Speech analysis","Reading audio","AI scoring"], why:"Not a full-product competitor. It competes at the speech-analysis capability layer." },
  { id:"c6", name:"EdVision", similarity:41, threat:48, x:27, y:60, kind:"micro", movement:"stable", shared:["Computer vision","Attention signal","Classroom analytics"], why:"Shares a sensing component that could become part of a competing assessment stack." },
  { id:"c7", name:"InsightOS", similarity:32, threat:38, x:77, y:66, kind:"micro", movement:"outward", shared:["Analytics","Decision support"], why:"Only analytics infrastructure overlaps today; low immediate substitution risk." },
  { id:"c8", name:"SpeechKit", similarity:25, threat:44, x:21, y:27, kind:"emerging", movement:"inward", shared:["Speech models","Voice API"], why:"Infrastructure player, not a direct competitor, but could enable many future entrants." },
];

const ringLabels = [
  { label:"CORE", sub:"80–100% similarity" },
  { label:"ADJACENT", sub:"55–79%" },
  { label:"MICRO", sub:"30–54%" },
  { label:"WATCH", sub:"<30%" },
];

function movementText(movement: Competitor["movement"]) {
  if (movement === "inward") return "Moving closer";
  if (movement === "outward") return "Moving away";
  return "Stable";
}

export function CompetitorRadar() {
  const [selectedId, setSelectedId] = useState("c1");
  const [filter, setFilter] = useState<"all" | Competitor["kind"]>("all");
  const selected = competitors.find((c) => c.id === selectedId) ?? competitors[0];
  const visible = useMemo(() => competitors.filter((c) => filter === "all" || c.kind === filter), [filter]);

  return (
    <section className="competition-command">
      <div className="competition-toolbar">
        <div>
          <span className="competition-kicker">COMPETITION RADAR</span>
          <h2>Your competitive universe, ranked by proximity.</h2>
          <p>Closer means more strategically similar. RADAR continuously recalculates distance as products, buyers and capabilities change.</p>
        </div>
        <div className="competition-filters" aria-label="Competition filters">
          {(["all","direct","adjacent","micro","emerging"] as const).map((item) => (
            <button key={item} onClick={() => setFilter(item)} className={filter === item ? "active" : ""}>{item === "all" ? "All" : item}</button>
          ))}
        </div>
      </div>

      <div className="competition-grid">
        <article className="competition-radar-card">
          <div className="radar-stage">
            <div className="radar-crosshair horizontal" />
            <div className="radar-crosshair vertical" />
            {[1,2,3,4].map((ring) => <div key={ring} className={`competition-ring ring-${ring}`} />)}
            <div className="radar-sweep" />

            <button className="company-core" aria-label="Your company">
              <span>YOU</span>
              <strong>YOUR<br/>COMPANY</strong>
            </button>

            {visible.map((company) => (
              <button
                key={company.id}
                className={`competitor-node ${company.kind} ${selectedId === company.id ? "selected" : ""}`}
                style={{ left:`${company.x}%`, top:`${company.y}%` }}
                onClick={() => setSelectedId(company.id)}
                aria-label={`${company.name}, ${company.similarity}% similarity`}
              >
                <span className="node-dot" />
                <strong>{company.name}</strong>
                <small>{company.similarity}%</small>
              </button>
            ))}

            <div className="radar-ring-labels">
              {ringLabels.map((ring) => <div key={ring.label}><strong>{ring.label}</strong><span>{ring.sub}</span></div>)}
            </div>
          </div>

          <footer className="competition-legend">
            <span><i className="legend-dot direct"/>Direct competitor</span>
            <span><i className="legend-dot adjacent"/>Adjacent</span>
            <span><i className="legend-dot micro"/>Micro-overlap</span>
            <span><i className="legend-dot emerging"/>Emerging/watch</span>
          </footer>
        </article>

        <aside className="competition-detail panel">
          <div className="competition-detail-head">
            <div><span>SELECTED ENTITY</span><h3>{selected.name}</h3></div>
            <span className={`movement-chip ${selected.movement}`}>{movementText(selected.movement)}</span>
          </div>

          <div className="competition-score-row">
            <div><span>Similarity</span><strong>{selected.similarity}%</strong><i><b style={{width:`${selected.similarity}%`}} /></i></div>
            <div><span>Threat</span><strong>{selected.threat}%</strong><i><b style={{width:`${selected.threat}%`}} /></i></div>
          </div>

          <div className="competition-why">
            <span>WHY RADAR PLACED IT HERE</span>
            <p>{selected.why}</p>
          </div>

          <div className="overlap-stack">
            <span>OVERLAP VECTOR</span>
            {selected.shared.map((item) => <div key={item}><ShieldCheck size={13}/><strong>{item}</strong></div>)}
          </div>

          <div className="competition-actions">
            <button><Search size={14}/>Deep scan</button>
            <button><GitBranch size={14}/>Compare</button>
          </div>
        </aside>
      </div>

      <div className="micro-intelligence-grid">
        <article className="panel micro-intel-card">
          <div className="micro-intel-icon"><Layers3 size={18}/></div>
          <span>MICRO-COMPETITION</span>
          <h3>Find competitors at the feature level.</h3>
          <p>A company does not need to sell your whole product to threaten you. RADAR decomposes your startup into capabilities, workflows, buyers and technologies, then finds companies overlapping with each piece.</p>
          <div className="micro-example"><small>Example</small><strong>VoiceAssess</strong><span>Only overlaps with speech analysis, but that capability is strategically important.</span></div>
        </article>

        <article className="panel micro-intel-card">
          <div className="micro-intel-icon"><Activity size={18}/></div>
          <span>CONVERGENCE</span>
          <h3>See who is moving toward you.</h3>
          <p>Distance is not static. New product pages, hiring, partnerships, pricing, positioning and customer reviews can pull a company inward before founders normally notice.</p>
          <div className="micro-example warning"><small>Detected</small><strong>ClassPulse moved 11 points closer</strong><span>New teacher-diagnostic positioning increased buyer and workflow overlap.</span></div>
        </article>

        <article className="panel micro-intel-card">
          <div className="micro-intel-icon"><Sparkles size={18}/></div>
          <span>DECISION ENGINE</span>
          <h3>Turn movement into a founder decision.</h3>
          <p>RADAR should never stop at “competitor changed.” It explains impact, shows evidence, proposes options and tracks what happened after you acted.</p>
          <div className="micro-example"><small>Recommended next move</small><strong>Interview 5 target buyers</strong><span>Validate whether the competitor’s new enterprise positioning changes your wedge.</span></div>
        </article>
      </div>

      <div className="surveillance-strip">
        <div className="surveillance-copy"><Crosshair size={17}/><div><span>PUBLIC-SIGNAL SURVEILLANCE</span><strong>What RADAR continuously watches</strong></div></div>
        <div className="surveillance-sources">
          {["Websites","Pricing","Changelogs","Docs","Job posts","Reviews","GitHub","Tech stack","Partnerships","News","Social","Patents"].map((source) => <span key={source}>{source}</span>)}
        </div>
      </div>
    </section>
  );
}
