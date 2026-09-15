"use client";

import { FormEvent, useEffect, useState } from "react";
import { Save, ShieldCheck } from "lucide-react";

type Workspace = {
  name: string;
  website?: string;
  description?: string;
  industry?: string;
  sub_category?: string;
  problem_statement?: string;
  target_customers?: string;
  buyer?: string;
  product_keywords?: string[];
  capability_keywords?: string[];
  technology_keywords?: string[];
  major_features?: string[];
  geography?: string;
  business_model?: string;
  pricing_context?: string;
  positioning?: string;
  public_team_facts?: string;
};

const empty: Workspace = { name: "Your Company", product_keywords: [], capability_keywords: [], technology_keywords: [], major_features: [] };

export function StartupProfileForm() {
  const [form, setForm] = useState<Workspace>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/radar/workspace", { cache: "no-store" }).then(r=>r.json()).then(data => {
      if (data) setForm(data);
      setLoading(false);
    });
  }, []);

  function set<K extends keyof Workspace>(key: K, value: Workspace[K]) { setForm(prev => ({ ...prev, [key]: value })); }
  function csv(value?: string[]) { return (value || []).join(", "); }
  function split(value: string) { return value.split(",").map(v=>v.trim()).filter(Boolean); }

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true); setMessage("Saving company brain...");
    const res = await fetch("/api/radar/workspace", { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify(form) });
    setMessage(res.ok ? "Saved. Discovery, scoring and briefings will use this Company Brain." : "Could not save profile.");
    setSaving(false);
  }

  if (loading) return <div className="panel founder-panel">Loading startup profile...</div>;

  return <form className="panel startup-profile-form" onSubmit={save}>
    <div className="startup-profile-head"><div><span>COMPANY BRAIN</span><h2>Teach RADAR exactly what your company is trying to win.</h2><p>This profile drives discovery, classification, similarity scoring, monitoring and AI interpretation.</p></div><ShieldCheck size={22}/></div>
    <div className="startup-form-grid">
      <label><span>Company name</span><input value={form.name || ""} onChange={e=>set("name",e.target.value)} /></label>
      <label><span>Website</span><input value={form.website || ""} onChange={e=>set("website",e.target.value)} placeholder="https://..." /></label>
      <label><span>Industry</span><input value={form.industry || ""} onChange={e=>set("industry",e.target.value)} placeholder="Education, Drone, SaaS..." /></label>
      <label><span>Sub-category</span><input value={form.sub_category || ""} onChange={e=>set("sub_category",e.target.value)} placeholder="Foundational literacy, creator drones..." /></label>
      <label className="wide"><span>One-line description</span><textarea value={form.description || ""} onChange={e=>set("description",e.target.value)} placeholder="What do you build?" /></label>
      <label className="wide"><span>Problem / use case</span><textarea value={form.problem_statement || ""} onChange={e=>set("problem_statement",e.target.value)} placeholder="Describe the customer job and pain in concrete language." /></label>
      <label><span>Target customers</span><input value={form.target_customers || ""} onChange={e=>set("target_customers",e.target.value)} placeholder="schools, creators, CFOs..." /></label>
      <label><span>Buyer / decision maker</span><input value={form.buyer || ""} onChange={e=>set("buyer",e.target.value)} placeholder="principal, founder, ops head..." /></label>
      <label className="wide"><span>Products / services</span><input value={csv(form.product_keywords)} onChange={e=>set("product_keywords",split(e.target.value))} placeholder="reading assessment, drone, analytics platform" /></label>
      <label className="wide"><span>Major features</span><input value={csv(form.major_features)} onChange={e=>set("major_features",split(e.target.value))} placeholder="speech analysis, pricing intelligence, autonomous follow" /></label>
      <label className="wide"><span>Capabilities</span><input value={csv(form.capability_keywords)} onChange={e=>set("capability_keywords",split(e.target.value))} placeholder="semantic monitoring, computer vision, competitor discovery" /></label>
      <label className="wide"><span>Core technologies</span><input value={csv(form.technology_keywords)} onChange={e=>set("technology_keywords",split(e.target.value))} placeholder="LLM, computer vision, edge AI..." /></label>
      <label><span>Business model</span><input value={form.business_model || ""} onChange={e=>set("business_model",e.target.value)} placeholder="B2B SaaS, D2C hardware..." /></label>
      <label><span>Pricing / price band</span><input value={form.pricing_context || ""} onChange={e=>set("pricing_context",e.target.value)} placeholder="₹499/mo, premium prosumer..." /></label>
      <label><span>Geography</span><input value={form.geography || ""} onChange={e=>set("geography",e.target.value)} placeholder="India, US, global..." /></label>
      <label className="wide"><span>Positioning & messaging</span><textarea value={form.positioning || ""} onChange={e=>set("positioning",e.target.value)} placeholder="How should customers understand you?" /></label>
      <label className="wide"><span>Relevant public team/company facts</span><textarea value={form.public_team_facts || ""} onChange={e=>set("public_team_facts",e.target.value)} placeholder="Public facts that matter to competitive interpretation." /></label>
    </div>
    <div className="startup-profile-actions"><span>{message || "Keep this precise. Specific context improves discovery quality and reduces noise."}</span><button type="submit" disabled={saving}><Save size={14}/>{saving ? "Saving..." : "Save company brain"}</button></div>
  </form>;
}
