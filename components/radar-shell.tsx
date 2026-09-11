"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bell,
  ChevronDown,
  Eye,
  FileText,
  Home,
  Search,
  Settings,
  Target,
} from "lucide-react";
import { RadarLogo } from "@/components/radar-logo";

type MainKey = "overview" | "monitor" | "intelligence" | "decisions" | "reports" | "settings";
type NavItem = { label: string; href: string; icon: LucideIcon; key: MainKey; hint: string };
type TabItem = { label: string; href: string };

const primaryNav: NavItem[] = [
  { label: "Overview", href: "/", icon: Home, key: "overview", hint: "What changed, what matters, what needs attention." },
  { label: "Monitor", href: "/monitor", icon: Eye, key: "monitor", hint: "Choose and review what RADAR watches." },
  { label: "Intelligence", href: "/intelligence", icon: Activity, key: "intelligence", hint: "Turn changes into signals, patterns and opportunities." },
  { label: "Decisions", href: "/decisions", icon: Target, key: "decisions", hint: "Decide what to do and track execution." },
  { label: "Reports", href: "/briefings", icon: FileText, key: "reports", hint: "Read and export leadership briefings." },
];

const settingsNav: NavItem = {
  label: "Settings",
  href: "/settings",
  icon: Settings,
  key: "settings",
  hint: "Workspace, integrations, alerts and team access.",
};

const monitorTabs: TabItem[] = [
  { label: "Overview", href: "/monitor" },
  { label: "Companies", href: "/companies" },
  { label: "Watchlists", href: "/watch-graph" },
  { label: "Sources", href: "/sources" },
];

const intelligenceTabs: TabItem[] = [
  { label: "Overview", href: "/intelligence" },
  { label: "Signals", href: "/signals" },
  { label: "Moves", href: "/moves" },
  { label: "Opportunities", href: "/discover" },
  { label: "Market Map", href: "/market-map" },
];

const decisionTabs: TabItem[] = [
  { label: "Recommendations", href: "/decisions" },
  { label: "Actions", href: "/actions" },
  { label: "Outcomes", href: "/outcomes" },
];

function activeSection(pathname: string): MainKey | null {
  if (pathname === "/") return "overview";
  if (["/monitor", "/companies", "/watch-graph", "/sources", "/brain", "/onboarding"].some((p) => pathname === p || pathname.startsWith(`${p}/`))) return "monitor";
  if (["/intelligence", "/signals", "/moves", "/discover", "/market-map"].some((p) => pathname === p || pathname.startsWith(`${p}/`))) return "intelligence";
  if (["/decisions", "/actions", "/outcomes"].some((p) => pathname === p || pathname.startsWith(`${p}/`))) return "decisions";
  if (pathname === "/briefings" || pathname.startsWith("/briefings/")) return "reports";
  if (pathname === "/settings" || pathname.startsWith("/settings/")) return "settings";
  return null;
}

function contextualTabs(section: MainKey | null): TabItem[] {
  if (section === "monitor") return monitorTabs;
  if (section === "intelligence") return intelligenceTabs;
  if (section === "decisions") return decisionTabs;
  return [];
}

function tabIsActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, current }: { item: NavItem; current: MainKey | null }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`nav-item ${current === item.key ? "active" : ""}`}
      title={item.hint}
      aria-label={`${item.label}: ${item.hint}`}
    >
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

        <div className="radar-sidebar-promo">
          <div className="radar-promo-copy">See further.<br />Move smarter.</div>
          <div className="radar-mountain-mini" aria-hidden="true">
            <span className="peak p1" /><span className="peak p2" /><span className="peak p3" />
          </div>
          <div className="radar-promo-footer">
            <strong>RADAR</strong>
            <span>STRATEGIC INTELLIGENCE<br />FOR A BRIGHTER TOMORROW.</span>
          </div>
        </div>
      </aside>

      <section className="main-panel radar-reference-main">
        <header className="topbar radar-reference-topbar">
          <div className="command-search radar-reference-search" role="search">
            <Search size={18} strokeWidth={1.8} />
            <span>Search companies, markets, technologies or signals...</span>
            <kbd>⌘ K</kbd>
          </div>
          <div className="top-actions radar-reference-actions">
            <Link href="/sources" className="icon-button radar-bell" aria-label="Notifications"><Bell size={18} strokeWidth={1.8} /><span className="notification-dot" /></Link>
            <div className="radar-top-divider" />
            <button className="profile-button radar-profile">
              <span>DS</span>
              <div><strong>Dipanshu Sahu</strong><small>Strategic Lead</small></div>
              <ChevronDown size={15} strokeWidth={1.8} />
            </button>
          </div>
        </header>

        {tabs.length > 0 ? (
          <div className="radar-context-tabs-wrap">
            <nav className="radar-context-tabs" aria-label={`${current} sections`}>
              {tabs.map((tab) => (
                <Link key={tab.href} href={tab.href} className={tabIsActive(pathname, tab.href) ? "active" : ""}>
                  {tab.label}
                </Link>
              ))}
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
