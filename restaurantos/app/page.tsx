import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import type { ReactNode } from "react";

import { Suspense } from "react";
import { connection } from "next/server";
import type { Expense } from "@/lib/expenses";
import { restaurantIdentity } from "@/lib/restaurant-identity";
import AddExpenseDialog from "./add-expense-dialog";

const navigationItems = [
  { label: "Overview", href: "#overview", icon: "grid", active: true },
  { label: "Inventory", href: "/inventory", icon: "inventory" },
  { label: "Waste alerts", href: "/waste", icon: "waste" },
  { label: "Expenses", href: "/expenses", icon: "receipt" },
  { label: "Profit & loss", href: "/profit-loss", icon: "profit" },
];

const inventoryItems = [
  { id: "PRODUCE", item: "Avocados", detail: "4 units left · Par 12", status: "Reorder", tone: "kitchen" },
  { id: "DAIRY", item: "Heavy cream", detail: "1.5 L left · Par 6 L", status: "Low stock", tone: "ready" },
  { id: "PROTEIN", item: "Atlantic salmon", detail: "2.2 kg left · Par 5 kg", status: "Low stock", tone: "served" },
];

function NavIcon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    receipt: <><path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3Z" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
    inventory: <><path d="m4 7 8-4 8 4-8 4-8-4Z" /><path d="m4 12 8 4 8-4M4 17l8 4 8-4M4 7v10M20 7v10" /></>,
    profit: <><path d="M4 19V5M4 19h17" /><path d="m7 15 4-4 3 2 6-7" /><path d="M16 6h4v4" /></>,
    waste: <><path d="M12 3 2.8 19a1.4 1.4 0 0 0 1.2 2h16a1.4 1.4 0 0 0 1.2-2L12 3Z" /><path d="M12 9v4M12 17h.01" /></>,
  };

  return (
    <svg aria-hidden="true" className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

async function RecentExpenses() {
  await connection();
  const { listExpenses } = await import("@/lib/expenses-db");
  const expenses: Expense[] = listExpenses(3);

  return (
    <section id="expenses" className="panel menu-panel" aria-labelledby="expenses-title">
      <div className="panel-heading">
        <div><h2 id="expenses-title">Recent expenses</h2><p>Latest recorded transactions</p></div>
      </div>
      <div className="expense-list">
        {expenses.map((expense, index) => (
          <Link className="expense-row" href={`/expenses?expense=${encodeURIComponent(expense.id)}`} key={expense.id}>
            <span className={`expense-avatar avatar-${["peach", "blue", "sage"][index % 3]}`}>{expense.vendor.slice(0, 1).toUpperCase()}</span>
            <div className="guest-details"><strong>{expense.vendor}</strong><span>{expense.category} · {expense.date}</span></div>
            <strong className="expense-amount">{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(expense.amount)}</strong>
          </Link>
        ))}
        {expenses.length === 0 && <p className="expenses-empty">No expenses recorded yet.</p>}
      </div>
      <Link className="panel-footer-link" href="/expenses">View expense ledger <span aria-hidden="true">→</span></Link>
    </section>
  );
}

function RecentExpensesFallback() {
  return <section className="panel menu-panel"><div className="panel-heading"><div><h2>Recent expenses</h2><p>Loading from database...</p></div></div></section>;
}

export default function Home() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" aria-label="RestaurantOS overview">
          <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
          <span>restaurant<span className="brand-os">OS</span></span>
        </a>

        <div className="location-switcher">
          <span className="location-avatar">{restaurantIdentity.initial}</span>
          <span className="location-copy"><strong>{restaurantIdentity.name}</strong><small>{restaurantIdentity.location}</small></span>
          <span className="chevron" aria-hidden="true">⌄</span>
        </div>

        <p className="nav-label">WORKSPACE</p>
        <nav className="primary-nav" aria-label="Main navigation">
          {navigationItems.map((item) => (
            <Link key={item.label} href={item.href} className={`nav-link${item.active ? " is-active" : ""}`} aria-current={item.active ? "page" : undefined}>
              <NavIcon name={item.icon} />
              <span>{item.label}</span>
              {item.label === "Orders" && <span className="nav-count">8</span>}
            </Link>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-note"><span className="status-dot" /> Books are up to date</div>
          <div className="profile-link"><UserButton /><span className="profile-copy"><strong>Your account</strong><small>Manage profile and sign out</small></span></div>
        </div>
      </aside>

      <main id="overview" className="main-content">
        <header className="topbar">
          <div className="breadcrumb"><span>{restaurantIdentity.name}</span><span className="breadcrumb-divider">/</span><strong>Financial overview</strong></div>
          <div className="topbar-actions">
            <span className="service-pill"><span className="status-dot" /> All locations</span>
            <button className="icon-button" type="button" aria-label="Notifications"><span className="bell-icon">♧</span><i /></button>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-row" aria-labelledby="page-title">
            <div>
              <p className="eyebrow">DAILY SUMMARY <span className="eyebrow-dot">·</span> NOVEMBER 10, 2026</p>
              <h1 id="page-title">Know your numbers<span className="title-period">.</span></h1>
              <p className="welcome-subtitle">Track margin drift and waste before they hit your bottom line.</p>
            </div>
            <AddExpenseDialog />
          </section>

          <section className="metrics-grid" aria-label="Today's financial performance">
            <Link className="metric-card metric-revenue metric-card-link" href="/profit-loss#gross-profit-row" aria-label="View gross margin in Profit and Loss">
              <div className="metric-heading"><span>Gross margin</span><span className="metric-icon dollar">%</span></div>
              <strong className="metric-value">72.0<span className="metric-unit">%</span></strong>
              <div className="metric-foot"><span className="trend-up">↗ 1.8 pts</span><span>vs. last week</span><span className="sparkline spark-green" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /></span></div>
            </Link>
            <Link className="metric-card metric-card-link" href="/profit-loss#food-cost-insight" aria-label="View food cost in Profit and Loss">
              <div className="metric-heading"><span>Food cost</span><span className="metric-icon"><NavIcon name="inventory" /></span></div>
              <strong className="metric-value">28.0<span className="metric-unit">%</span></strong>
              <div className="metric-foot"><span className="trend-warning">1.5 pts over</span><span>26.5% target</span><span className="sparkline spark-orange" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /></span></div>
            </Link>
            <Link className="metric-card metric-card-link" href="/waste#waste-insights-title" aria-label="View Waste Alerts">
              <div className="metric-heading"><span>Waste cost</span><span className="metric-icon waste-metric-icon"><NavIcon name="waste" /></span></div>
              <strong className="metric-value">$184<span className="metric-cents">.00</span></strong>
              <div className="metric-foot"><span className="trend-warning">2.2% of sales</span><span>2.0% target</span><span className="sparkline spark-orange" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /></span></div>
            </Link>
            <Link className="metric-card metric-card-link" href="/profit-loss#net-profit-row" aria-label="View net profit in Profit and Loss">
              <div className="metric-heading"><span>Net profit</span><span className="metric-icon occupancy-icon"><NavIcon name="profit" /></span></div>
              <strong className="metric-value">$2,136<span className="metric-cents">.00</span></strong>
              <div className="metric-foot"><span className="trend-up">25.4%</span><span>profit margin</span><span className="sparkline spark-green" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /></span></div>
            </Link>
          </section>

          <div className="dashboard-grid">
            <section id="inventory" className="panel reservations-panel" aria-labelledby="inventory-title">
              <div className="panel-heading">
                <div><h2 id="inventory-title">Inventory watch</h2><p>Items that need attention</p></div>
              </div>
              <Link className="inventory-summary" href="/inventory?filter=low"><span className="warning-icon">!</span><strong>3 items running low</strong><span>Check stock</span></Link>
              <div className="inventory-list">
                {inventoryItems.map((item) => (
                  <Link className="inventory-row" href={`/inventory?search=${encodeURIComponent(item.item)}`} key={item.item} aria-label={`View ${item.item} in Inventory`}>
                    <span className="inventory-code">{item.id}</span>
                    <div className="order-details"><strong>{item.item}</strong><span>{item.detail}</span></div>
                    <span className={`order-status status-${item.tone}`}>{item.status}</span>
                  </Link>
                ))}
              </div>
              <Link className="panel-footer-link" href="/inventory">View inventory <span aria-hidden="true">→</span></Link>
            </section>

            <Suspense fallback={<RecentExpensesFallback />}><RecentExpenses /></Suspense>

          </div>
          <footer className="page-footer"><span>RestaurantOS <i>·</i> Better margins start here.</span><span>Last synced just now <span className="sync-dot" /></span></footer>
        </div>
      </main>
    </div>
  );
}
