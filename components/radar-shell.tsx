"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Bell, Building2, Compass, FileText, LogOut, Radar, Search, Settings, Signal, Sparkles, Target, Home, Activity, LoaderCircle } from "lucide-react";
import { RadarLogo } from "@/components/radar-logo";
import { RadarAutoSetup } from "@/components/radar-auto-setup";

type MainKey = "dashboard" | "discover" | "radar" | "competitors" | "signals" | "decisions" | "briefings" | "sources" | "settings";
type NavItem = { label: string; href: string; icon: LucideIcon; key: MainKey; hint: string };

const primaryNav: NavItem[] = [
  { label: "Dashboard", href: "/", icon: Home, key: "dashboard", hint: "What changed and what deserves founder attention." },
  { label: "Discover", href: "/discover", icon: Compass, key: "discover", hint: "Unknown competitors and emerging players RADAR found." },
  { label: "RADAR", href: "/market", icon: Radar, key: "radar", hint: "Your living competitive map." },
  { label: "Competitors", href: "/companies", icon: Building2, key: "competitors", hint: "Every direct, adjacent, substitute and emerging competitor." },
  { label: "Signals", href: "/signals", icon: Signal, key: "signals", hint: "Evidence-backed changes detected across the market." },
  { label: "Decisions", href: "/decisions", icon: Target, key: "decisions", hint: "What the evidence means and what to do next." },
  { label: "Briefings", href: "/briefings", icon: FileText, key: "briefings", hint: "Daily, weekly and monthly founder intelligence summaries." },
];

const sourcesNav: NavItem = { label: "Sources & Alerts", href: "/sources", icon: Activity, key: "sources", hint: "Source coverage, monitor health and alert readiness." };
const settingsNav: NavItem = { label: "Settings", href: "/settings", icon: Settings, key: "settings", hint: "Company Brain, monitoring, sources and workspace controls." };

function activeSection(pathname: string): MainKey | null {
  if (pathname === "/") return "dashboard";
  if (pathname === "/discover" || pathname.startsWith("/discover/")) return "discover";
  if (["/market", "/moves", "/market-map", "/watch-graph", "/monitor", "/intelligence"].some(p => pathname === p || pathname.startsWith(`${p}/`))) return "radar";
  if (pathname === "/companies" || pathname.startsWith("/companies/")) return "competitors";
  if (pathname === "/signals" || pathname.startsWith("/signals/")) return "signals";
  if (["/decisions", "/actions", "/outcomes"].some(p => pathname === p || pathname.startsWith(`${p}/`))) return "decisions";
  if (pathname === "/briefings" || pathname.startsWith("/briefings/")) return "briefings";
  if (pathname === "/sources" || pathname.startsWith("/sources/")) return "sources";
  if (["/settings", "/brain", "/system-health"].some(p => pathname === p || pathname.startsWith(`${p}/`))) return "settings";
  return null;
}

function NavLink({ item, current }: { item: NavItem; current: MainKey | null }) {
  const Icon = item.icon;
  return <Link href={item.href} style={{textDecoration:"none"}} className={`nav-item ${current === item.key ? "active" : ""}`} title={item.hint}><Icon size={17} strokeWidth={1.8}/><span>{item.label}</span></Link>;
}

export function RadarShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checking,setChecking]=useState(pathname!=="/login"&&pathname!=="/onboarding");
  const publicRoute=pathname === "/login" || pathname === "/onboarding";

  useEffect(()=>{
    if(publicRoute){setChecking(false);return;}
    let alive=true;
    fetch("/api/radar/workspace",{cache:"no-store"})
      .then(async r=>({ok:r.ok,data:await r.json().catch(()=>({}))}))
      .then(({ok,data})=>{
        if(!alive)return;
        if(!ok){router.replace("/login");return;}
        if(!data?.onboarding_completed || !data?.website){router.replace("/onboarding");return;}
        setChecking(false);
      })
      .catch(()=>{if(alive)setChecking(false)});
    return()=>{alive=false};
  },[pathname,publicRoute,router]);

  if (publicRoute) return <>{children}</>;
  if(checking) return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#e9ebed",color:"#5f666b",fontFamily:'"Avenir Next","Segoe UI",system-ui,sans-serif'}}><div style={{display:"flex",gap:10,alignItems:"center",fontSize:13}}><LoaderCircle size={18}/>Opening your RADAR workspace...</div></main>;

  const current = activeSection(pathname);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <main className="app-shell radar-reference-shell">
      <style>{`
        .radar-reference-shell a,
        .radar-reference-shell a:link,
        .radar-reference-shell a:visited,
        .radar-reference-shell a:hover,
        .radar-reference-shell a:active,
        .radar-reference-shell a *,
        .radar-logo-link,
        .radar-logo-link * {
          text-decoration: none !important;
          text-decoration-line: none !important;
        }
      `}</style>
      <aside className="sidebar radar-reference-sidebar">
        <div className="brand-row radar-reference-brand"><Link href="/" aria-label="RADAR home" style={{textDecoration:"none"}} className="radar-logo-link"><RadarLogo/></Link></div>
        <nav className="nav-list radar-reference-nav radar-simple-nav" aria-label="RADAR main navigation">{primaryNav.map(item => <NavLink key={item.href} item={item} current={current}/>)}</nav>
        <div className="radar-sidebar-divider"/>
        <nav className="nav-list radar-reference-nav secondary radar-simple-nav" aria-label="Workspace navigation"><NavLink item={sourcesNav} current={current}/><NavLink item={settingsNav} current={current}/></nav>
        <div className="radar-sidebar-promo founder-promo">
          <div className="radar-promo-copy">Know sooner.<br/>Decide better.</div>
          <div className="radar-mountain-mini" aria-hidden="true"><span className="peak p1"/><span className="peak p2"/><span className="peak p3"/></div>
          <div className="radar-promo-footer"><strong>RADAR</strong><span>CONTINUOUS COMPETITIVE<br/>INTELLIGENCE FOR FOUNDERS.</span></div>
        </div>
      </aside>

      <section className="main-panel radar-reference-main">
        <header className="topbar radar-reference-topbar">
          <Link href="/ask" style={{textDecoration:"none"}} className="command-search radar-reference-search founder-search" aria-label="Ask RADAR"><Search size={18} strokeWidth={1.8}/><span>Ask RADAR about competitors, signals or decisions...</span><kbd>⌘ K</kbd></Link>
          <div className="top-actions radar-reference-actions">
            <Link href="/signals" style={{textDecoration:"none"}} className="icon-button radar-bell" aria-label="New signals"><Bell size={18} strokeWidth={1.8}/><span className="notification-dot"/></Link>
            <div className="radar-top-divider"/>
            <button onClick={logout} className="profile-button radar-profile" title="Sign out"><span>F</span><div><strong>Founder</strong><small>Private workspace</small></div><LogOut size={15} strokeWidth={1.8}/></button>
          </div>
        </header>
        <RadarAutoSetup/>
        {children}
        <Link href="/ask" style={{textDecoration:"none"}} className={`radar-ai-fab ${pathname === "/ask" ? "active" : ""}`} aria-label="Ask RADAR" title="Ask RADAR"><span className="radar-ai-fab-glyph"><Sparkles size={27} strokeWidth={1.8}/></span></Link>
      </section>
    </main>
  );
}
