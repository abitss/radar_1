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
  MessageCircle,
  Search,
  Settings,
  Signal,
  Sparkles,
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
        <Link href="/ask" className={`radar-ai-launcher ${pathname === "/ask" ? "active" : ""}`} aria-label="Ask RADAR">
          <span className="radar-ai-icon"><Sparkles size={18} strokeWidth={1.8} /><MessageCircle size={10} strokeWidth={1.8} /></span>
          <span className="radar-ai-copy"><strong>Ask RADAR</strong><small>Assistant</small></span>
        </Link>
      </section>
    </main>
  );
}
