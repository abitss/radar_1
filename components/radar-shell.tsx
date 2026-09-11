"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Bell, Building2, LogOut, Radar, Search, Settings, Signal, Sparkles, Target, Home } from "lucide-react";
import { RadarLogo } from "@/components/radar-logo";

type MainKey = "today" | "radar" | "competitors" | "signals" | "decisions" | "settings";
type NavItem = { label: string; href: string; icon: LucideIcon; key: MainKey; hint: string };

const primaryNav: NavItem[] = [
  { label: "Today", href: "/", icon: Home, key: "today", hint: "What changed and what deserves founder attention." },
  { label: "RADAR", href: "/market", icon: Radar, key: "radar", hint: "Your living competitive map." },
  { label: "Competitors", href: "/companies", icon: Building2, key: "competitors", hint: "Every direct, adjacent, micro and emerging competitor." },
  { label: "Signals", href: "/signals", icon: Signal, key: "signals", hint: "Evidence-backed changes detected across the market." },
  { label: "Decisions", href: "/decisions", icon: Target, key: "decisions", hint: "What the evidence means and what to do next." },
];

const settingsNav: NavItem = { label: "Settings", href: "/settings", icon: Settings, key: "settings", hint: "Company Brain, monitoring and workspace controls." };

function activeSection(pathname: string): MainKey | null {
  if (pathname === "/") return "today";
  if (["/market", "/discover", "/moves", "/market-map", "/watch-graph", "/monitor", "/intelligence"].some(p => pathname === p || pathname.startsWith(`${p}/`))) return "radar";
  if (pathname === "/companies" || pathname.startsWith("/companies/")) return "competitors";
  if (pathname === "/signals" || pathname.startsWith("/signals/")) return "signals";
  if (["/decisions", "/actions", "/outcomes"].some(p => pathname === p || pathname.startsWith(`${p}/`))) return "decisions";
  if (["/settings", "/brain", "/onboarding", "/sources", "/system-health"].some(p => pathname === p || pathname.startsWith(`${p}/`))) return "settings";
  return null;
}

function NavLink({ item, current }: { item: NavItem; current: MainKey | null }) {
  const Icon = item.icon;
  return <Link href={item.href} className={`nav-item ${current === item.key ? "active" : ""}`} title={item.hint}><Icon size={17} strokeWidth={1.8}/><span>{item.label}</span></Link>;
}

export function RadarShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  if (pathname === "/login") return <>{children}</>;
  const current = activeSection(pathname);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <main className="app-shell radar-reference-shell">
      <aside className="sidebar radar-reference-sidebar">
        <div className="brand-row radar-reference-brand"><Link href="/" aria-label="RADAR home" className="radar-logo-link"><RadarLogo/></Link></div>
        <nav className="nav-list radar-reference-nav radar-simple-nav" aria-label="RADAR main navigation">{primaryNav.map(item => <NavLink key={item.href} item={item} current={current}/>)}</nav>
        <div className="radar-sidebar-divider"/>
        <nav className="nav-list radar-reference-nav secondary radar-simple-nav" aria-label="Workspace navigation"><NavLink item={settingsNav} current={current}/></nav>
        <div className="radar-sidebar-promo founder-promo">
          <div className="radar-promo-copy">Know sooner.<br/>Decide better.</div>
          <div className="radar-mountain-mini" aria-hidden="true"><span className="peak p1"/><span className="peak p2"/><span className="peak p3"/></div>
          <div className="radar-promo-footer"><strong>RADAR</strong><span>CONTINUOUS COMPETITIVE<br/>INTELLIGENCE FOR FOUNDERS.</span></div>
        </div>
      </aside>

      <section className="main-panel radar-reference-main">
        <header className="topbar radar-reference-topbar">
          <Link href="/signals" className="command-search radar-reference-search founder-search" aria-label="Search RADAR"><Search size={18} strokeWidth={1.8}/><span>Search competitors, signals and evidence...</span><kbd>⌘ K</kbd></Link>
          <div className="top-actions radar-reference-actions">
            <Link href="/signals" className="icon-button radar-bell" aria-label="New signals"><Bell size={18} strokeWidth={1.8}/><span className="notification-dot"/></Link>
            <div className="radar-top-divider"/>
            <button onClick={logout} className="profile-button radar-profile" title="Sign out"><span>F</span><div><strong>Founder</strong><small>Private workspace</small></div><LogOut size={15} strokeWidth={1.8}/></button>
          </div>
        </header>
        {children}
        <Link href="/ask" className={`radar-ai-fab ${pathname === "/ask" ? "active" : ""}`} aria-label="Ask RADAR" title="Ask RADAR"><span className="radar-ai-fab-glyph"><Sparkles size={27} strokeWidth={1.8}/></span></Link>
      </section>
    </main>
  );
}
