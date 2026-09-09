"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  BookOpen,
  ChevronDown,
  Diamond,
  FileText,
  Home,
  Link2,
  Search,
  Settings,
  Signal,
  Star,
  Users,
} from "lucide-react";
import { RadarLogo } from "@/components/radar-logo";

type NavItem = { label: string; href: string; icon: LucideIcon };

const ASK_RADAR_ICON = "data:image/png;base64,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";

const primaryNav: NavItem[] = [
  { label: "Overview", href: "/", icon: Home },
  { label: "Signals", href: "/signals", icon: Signal },
  { label: "Markets", href: "/market-map", icon: BarChart3 },
  { label: "Competitors", href: "/companies", icon: Users },
  { label: "Opportunities", href: "/discover", icon: Diamond },
  { label: "Reports", href: "/briefings", icon: FileText },
  { label: "Playbooks", href: "/actions", icon: BookOpen },
];

const secondaryNav: NavItem[] = [
  { label: "Watchlists", href: "/watch-graph", icon: Star },
  { label: "Integrations", href: "/sources", icon: Link2 },
  { label: "Settings", href: "/settings", icon: Settings },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  return (
    <Link href={item.href} className={`nav-item ${isActive(pathname, item.href) ? "active" : ""}`}>
      <Icon size={17} strokeWidth={1.8} />
      <span>{item.label}</span>
    </Link>
  );
}

export function RadarShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <main className="app-shell radar-reference-shell">
      <aside className="sidebar radar-reference-sidebar">
        <div className="brand-row radar-reference-brand">
          <Link href="/" aria-label="RADAR home" className="radar-logo-link"><RadarLogo /></Link>
        </div>

        <nav className="nav-list radar-reference-nav" aria-label="RADAR navigation">
          {primaryNav.map((item) => <NavLink key={item.href} item={item} pathname={pathname} />)}
        </nav>

        <div className="radar-sidebar-divider" />

        <nav className="nav-list radar-reference-nav secondary" aria-label="RADAR secondary navigation">
          {secondaryNav.map((item) => <NavLink key={item.href} item={item} pathname={pathname} />)}
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
            <span>Search for companies, markets, technologies, or signals...</span>
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
        {children}
        <Link href="/ask" className={`radar-ai-fab ${pathname === "/ask" ? "active" : ""}`} aria-label="Ask RADAR" title="Ask RADAR">
          <img src={ASK_RADAR_ICON} alt="" aria-hidden="true" className="radar-ai-fab-image" />
        </Link>
      </section>
    </main>
  );
}
