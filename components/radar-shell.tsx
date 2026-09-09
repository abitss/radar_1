"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  ChevronDown,
  Diamond,
  FileText,
  Globe2,
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
      <Icon size={17} />
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
          <Link href="/" aria-label="RADAR home"><RadarLogo /></Link>
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
          <Link href="/ask" className="command-search radar-reference-search">
            <Search size={18} />
            <span>Search for companies, markets, technologies, or signals...</span>
            <kbd>⌘ K</kbd>
          </Link>
          <div className="top-actions radar-reference-actions">
            <Link href="/sources" className="icon-button radar-bell" aria-label="Notifications"><Bell size={18} /><span className="notification-dot" /></Link>
            <div className="radar-top-divider" />
            <button className="profile-button radar-profile">
              <span>DS</span>
              <div><strong>Dipanshu Sahu</strong><small>Strategic Lead</small></div>
              <ChevronDown size={15} />
            </button>
          </div>
        </header>
        {children}
      </section>
    </main>
  );
}
