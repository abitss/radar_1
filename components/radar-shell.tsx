"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  ChevronDown,
  FileText,
  Home,
  Radar,
  Search,
  Settings,
  Sparkles,
  Target,
  Users,
  WalletCards,
} from "lucide-react";
import { RadarLogo } from "@/components/radar-logo";

type MainKey = "today" | "customers" | "market" | "money" | "decisions" | "reports" | "settings";
type NavItem = { label: string; href: string; icon: LucideIcon; key: MainKey; hint: string };
type TabItem = { label: string; href: string };

const primaryNav: NavItem[] = [
  { label: "Today", href: "/", icon: Home, key: "today", hint: "The few things that can change your company today." },
  { label: "Customers", href: "/customers", icon: Users, key: "customers", hint: "Know whether customers actually want what you are building." },
  { label: "Market", href: "/market", icon: Radar, key: "market", hint: "Competitors, signals, opportunities and market change." },
  { label: "Money", href: "/money", icon: WalletCards, key: "money", hint: "Runway, burn, fundraising readiness and capital risk." },
  { label: "Decisions", href: "/decisions", icon: Target, key: "decisions", hint: "Turn evidence into the next best move." },
  { label: "Reports", href: "/briefings", icon: FileText, key: "reports", hint: "Daily and weekly founder briefings." },
];

const settingsNav: NavItem = {
  label: "Settings",
  href: "/settings",
  icon: Settings,
  key: "settings",
  hint: "Company Brain, integrations, alerts and team access.",
};

const customerTabs: TabItem[] = [
  { label: "Overview", href: "/customers" },
  { label: "Customer Truth", href: "/customers#truth" },
  { label: "PMF", href: "/customers#pmf" },
  { label: "Pipeline", href: "/customers#pipeline" },
];

const marketTabs: TabItem[] = [
  { label: "Overview", href: "/market" },
  { label: "Signals", href: "/signals" },
  { label: "Moves", href: "/moves" },
  { label: "Competitors", href: "/companies" },
  { label: "Opportunities", href: "/discover" },
  { label: "Map", href: "/market-map" },
];

const decisionTabs: TabItem[] = [
  { label: "Recommendations", href: "/decisions" },
  { label: "Actions", href: "/actions" },
  { label: "Outcomes", href: "/outcomes" },
];

function activeSection(pathname: string): MainKey | null {
  if (pathname === "/") return "today";
  if (pathname === "/customers" || pathname.startsWith("/customers/")) return "customers";
  if (["/market", "/signals", "/moves", "/companies", "/discover", "/market-map", "/watch-graph", "/sources", "/monitor", "/intelligence"].some((p) => pathname === p || pathname.startsWith(`${p}/`))) return "market";
  if (pathname === "/money" || pathname.startsWith("/money/")) return "money";
  if (["/decisions", "/actions", "/outcomes"].some((p) => pathname === p || pathname.startsWith(`${p}/`))) return "decisions";
  if (pathname === "/briefings" || pathname.startsWith("/briefings/")) return "reports";
  if (["/settings", "/brain", "/onboarding"].some((p) => pathname === p || pathname.startsWith(`${p}/`))) return "settings";
  return null;
}

function contextualTabs(section: MainKey | null): TabItem[] {
  if (section === "customers") return customerTabs;
  if (section === "market") return marketTabs;
  if (section === "decisions") return decisionTabs;
  return [];
}

function tabIsActive(pathname: string, href: string) {
  const base = href.split("#")[0];
  if (href.includes("#")) return false;
  return pathname === base || pathname.startsWith(`${base}/`);
}

function NavLink({ item, current }: { item: NavItem; current: MainKey | null }) {
  const Icon = item.icon;
  return (
    <Link href={item.href} className={`nav-item ${current === item.key ? "active" : ""}`} title={item.hint}>
      <Icon size={17} strokeWidth={1.8} />
      <span>{item.label}</span>
    </Link>
  );
}

export function RadarShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const current = activeSection(pathname);
  const tabs = contextualTabs(current);

  return (
    <main className="app-shell radar-reference-shell">
      <aside className="sidebar radar-reference-sidebar">
        <div className="brand-row radar-reference-brand">
          <Link href="/" aria-label="RADAR home" className="radar-logo-link"><RadarLogo /></Link>
        </div>

        <nav className="nav-list radar-reference-nav radar-simple-nav" aria-label="RADAR main navigation">
          {primaryNav.map((item) => <NavLink key={item.href} item={item} current={current} />)}
        </nav>

        <div className="radar-sidebar-divider" />
        <nav className="nav-list radar-reference-nav secondary radar-simple-nav" aria-label="Workspace navigation">
          <NavLink item={settingsNav} current={current} />
        </nav>

        <div className="radar-sidebar-promo founder-promo">
          <div className="radar-promo-copy">Know sooner.<br />Decide better.</div>
          <div className="radar-mountain-mini" aria-hidden="true"><span className="peak p1" /><span className="peak p2" /><span className="peak p3" /></div>
          <div className="radar-promo-footer"><strong>RADAR</strong><span>FOUNDER INTELLIGENCE<br />BEFORE IT BECOMES URGENT.</span></div>
        </div>
      </aside>

      <section className="main-panel radar-reference-main">
        <header className="topbar radar-reference-topbar">
          <Link href="/ask" className="command-search radar-reference-search founder-search" aria-label="Ask or search RADAR">
            <Search size={18} strokeWidth={1.8} />
            <span>Ask or search your company, customers, market or money...</span>
            <kbd>⌘ K</kbd>
          </Link>
          <div className="top-actions radar-reference-actions">
            <Link href="/sources" className="icon-button radar-bell" aria-label="Notifications"><Bell size={18} strokeWidth={1.8} /><span className="notification-dot" /></Link>
            <div className="radar-top-divider" />
            <button className="profile-button radar-profile"><span>F</span><div><strong>Founder</strong><small>Company workspace</small></div><ChevronDown size={15} strokeWidth={1.8} /></button>
          </div>
        </header>

        {tabs.length > 0 ? (
          <div className="radar-context-tabs-wrap">
            <nav className="radar-context-tabs" aria-label={`${current} sections`}>
              {tabs.map((tab) => <Link key={tab.href} href={tab.href} className={tabIsActive(pathname, tab.href) ? "active" : ""}>{tab.label}</Link>)}
            </nav>
          </div>
        ) : null}

        {children}

        <Link href="/ask" className={`radar-ai-fab ${pathname === "/ask" ? "active" : ""}`} aria-label="Ask RADAR" title="Ask RADAR">
          <img src="/ask-radar-icon.svg" alt="" aria-hidden="true" className="radar-ai-fab-image" />
        </Link>
      </section>
    </main>
  );
}
