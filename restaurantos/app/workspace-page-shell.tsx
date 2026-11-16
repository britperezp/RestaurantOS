import Link from "next/link";
import type { ReactNode } from "react";

type WorkspaceRoute = "waste" | "profit-loss";

const navigationItems = [
  { label: "Overview", href: "/", icon: "grid" },
  { label: "Inventory", href: "/inventory", icon: "inventory" },
  { label: "Waste alerts", href: "/waste", icon: "waste", route: "waste" },
  { label: "Expenses", href: "/expenses", icon: "receipt" },
  { label: "Profit & loss", href: "/profit-loss", icon: "profit", route: "profit-loss" },
] satisfies { label: string; href: string; icon: string; route?: WorkspaceRoute }[];

export function WorkspaceIcon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    inventory: <><path d="m4 7 8-4 8 4-8 4-8-4Z" /><path d="m4 12 8 4 8-4M4 17l8 4 8-4M4 7v10M20 7v10" /></>,
    waste: <><path d="M12 3 2.8 19a1.4 1.4 0 0 0 1.2 2h16a1.4 1.4 0 0 0 1.2-2L12 3Z" /><path d="M12 9v4M12 17h.01" /></>,
    receipt: <><path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3Z" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
    profit: <><path d="M4 19V5M4 19h17" /><path d="m7 15 4-4 3 2 6-7" /><path d="M16 6h4v4" /></>,
  };

  return <svg aria-hidden="true" className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export default function WorkspacePageShell({ activeRoute, title, children }: { activeRoute: WorkspaceRoute; title: string; children: ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="RestaurantOS overview">
          <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
          <span>restaurant<span className="brand-os">OS</span></span>
        </Link>
        <div className="location-switcher">
          <span className="location-avatar">B</span>
          <span className="location-copy"><strong>Bar Siena</strong><small>Downtown · Chicago</small></span>
          <span className="chevron" aria-hidden="true">⌄</span>
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav className="primary-nav" aria-label="Main navigation">
          {navigationItems.map((item) => {
            const isActive = item.route === activeRoute;
            return <Link key={item.label} className={`nav-link${isActive ? " is-active" : ""}`} href={item.href} aria-current={isActive ? "page" : undefined}><WorkspaceIcon name={item.icon} /><span>{item.label}</span></Link>;
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note"><span className="status-dot" /> Books are up to date</div>
          <Link className="profile-link" href="/">
            <span className="profile-avatar">JM</span>
            <span className="profile-copy"><strong>Jordan Miller</strong><small>Restaurant manager</small></span>
            <span className="chevron" aria-hidden="true">⌄</span>
          </Link>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb"><Link href="/">Bar Siena</Link><span className="breadcrumb-divider">/</span><strong>{title}</strong></div>
          <div className="topbar-actions"><span className="service-pill"><span className="status-dot" /> All locations</span><button className="icon-button" type="button" aria-label="Notifications"><span className="bell-icon">♧</span><i /></button><span className="top-avatar">JM</span></div>
        </header>
        <div className="page-content">
          {children}
          <footer className="page-footer"><span>RestaurantOS <i>·</i> {title}</span><span>Last synced just now <span className="sync-dot" /></span></footer>
        </div>
      </main>
    </div>
  );
}