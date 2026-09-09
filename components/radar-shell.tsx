"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bell,
  BrainCircuit,
  Building2,
  CheckCircle2,
  ChevronDown,
  Compass,
  Crosshair,
  FileText,
  Gauge,
  GitBranch,
  LayoutDashboard,
  MessageSquareText,
  Radar,
  Search,
  Settings,
} from "lucide-react";
import { RadarLogo } from "@/components/radar-logo";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
};

const nav: NavItem[] = [
  { label: "Today", href: "/", icon: LayoutDashboard },
  { label: "Discover", href: "/discover", icon: Compass },
  { label: "Companies", href: "/companies", icon: Building2 },
  { label: "Signals", href: "/signals", icon: Activity, badge: 12 },
  { label: "RADAR Moves", href: "/moves", icon: Radar },
  { label: "Decisions", href: "/decisions", icon: BrainCircuit, badge: 3 },
  { label: "Actions", href: "/actions", icon: CheckCircle2 },
  { label: "Watch Graph", href: "/watch-graph", icon: GitBranch },
  { label: "Market Map", href: "/market-map", icon: Crosshair },
  { label: "Briefings", href: "/briefings", icon: FileText },
  { label: "Ask RADAR", href: "/ask", icon: MessageSquareText },
  { label: "Sources & Alerts", href: "/sources", icon: Bell },
  { label: "System Health", href: "/system-health", icon: Gauge },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function RadarShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <Link href="/" aria-label="RADAR home">
            <RadarLogo />
          </Link>
          <span className="brand-badge">BETA</span>
        </div>

        <Link href="/brain" className="workspace-switcher" style={{ textDecoration: "none" }}>
          <div className="workspace-avatar">R</div>
          <div>
            <strong>ReadRight</strong>
            <span>Primary workspace</span>
          </div>
          <ChevronDown size={15} />
        </Link>

        <nav className="nav-list" aria-label="RADAR navigation">
          {nav.map(({ label, href, icon: Icon, badge }) => (
            <Link
              key={href}
              href={href}
              className={`nav-item ${isActive(pathname, href) ? "active" : ""}`}
              style={{ textDecoration: "none" }}
            >
              <Icon size={17} />
              <span>{label}</span>
              {badge ? <em>{badge}</em> : null}
            </Link>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <Link href="/settings" className={`nav-item ${isActive(pathname, "/settings") ? "active" : ""}`} style={{ textDecoration: "none" }}>
            <Settings size={17} />
            <span>Settings</span>
          </Link>
          <div className="system-pill"><span className="live-dot" />All systems operational</div>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <Link href="/ask" className="command-search" style={{ textDecoration: "none" }}>
            <Search size={16} />
            <span>Search intelligence...</span>
            <kbd>⌘ K</kbd>
          </Link>
          <div className="top-actions">
            <Link href="/sources" className="icon-button" aria-label="Notifications"><Bell size={17} /><span className="notification-dot" /></Link>
            <button className="profile-button"><span>DS</span><ChevronDown size={14} /></button>
          </div>
        </header>
        {children}
      </section>
    </main>
  );
}
