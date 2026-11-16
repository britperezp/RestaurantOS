import WorkspacePageShell from "../workspace-page-shell";
import { io } from "next/cache";
import { Suspense } from "react";

const sales = 8420;
const foodCost = 2358;
const laborCost = 2644;
const otherExpenses = 1282;
const totalCosts = foodCost + laborCost + otherExpenses;
const grossProfit = sales - foodCost;
const netProfit = sales - totalCosts;
const primeCost = foodCost + laborCost;
const foodCostTarget = sales * 0.265;
const foodCostGap = sales * 0.28 - foodCostTarget;

const money = (amount: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
const percent = (amount: number) => `${(amount / sales * 100).toFixed(1)}%`;

async function ReportDate() {
  await io();
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date()).toUpperCase();
}

const breakdown = [
  { label: "Net sales", amount: sales, tone: "sales-dot", kind: "income" },
  { label: "Food cost", amount: foodCost, tone: "food-dot", kind: "cost" },
  { label: "Labor", amount: laborCost, tone: "labor-dot", kind: "cost" },
  { label: "Other expenses", amount: otherExpenses, tone: "overhead-dot", kind: "cost" },
  { label: "Net profit", amount: netProfit, tone: "sales-dot", kind: "profit" },
];

const ledgerRows = [
  { label: "Net sales", amount: sales, type: "income" },
  { label: "Food cost", amount: -foodCost, type: "cost" },
  { label: "Gross profit", amount: grossProfit, type: "subtotal" },
  { label: "Labor", amount: -laborCost, type: "cost" },
  { label: "Other expenses", amount: -otherExpenses, type: "cost" },
  { label: "Total costs", amount: -totalCosts, type: "subtotal" },
  { label: "Net profit", amount: netProfit, type: "total" },
];

export default function ProfitLossPage() {
  return (
    <WorkspacePageShell activeRoute="profit-loss" title="Profit & loss">
      <section className="welcome-row" aria-labelledby="page-title">
        <div><p className="eyebrow">BAR SIENA <span className="eyebrow-dot">·</span> <Suspense fallback=""><ReportDate /></Suspense></p><h1 id="page-title">Profit & loss<span className="title-period">.</span></h1><p className="welcome-subtitle">Daily performance, cost structure, and margin signals.</p></div>
      </section>

      <section className="module-stat-grid" aria-label="Daily profit and loss summary">
        <article className="stock-stat"><span className="stock-stat-label">Net sales</span><strong>{money(sales)}</strong><span className="stock-stat-note">Today so far</span></article>
        <article className="stock-stat"><span className="stock-stat-label">Gross profit</span><strong>{money(grossProfit)}</strong><span className="stock-stat-note">{percent(grossProfit)} margin after food cost</span></article>
        <article className="stock-stat"><span className="stock-stat-label">Total costs</span><strong>{money(totalCosts)}</strong><span className="stock-stat-note">{percent(totalCosts)} of sales</span></article>
        <article className="stock-stat"><span className="stock-stat-label">Net profit</span><strong>{money(netProfit)}</strong><span className="stock-stat-note">{percent(netProfit)} net margin</span></article>
      </section>

      <div className="profit-analysis-grid">
        <section className="panel profit-breakdown-panel" aria-labelledby="profit-breakdown-title">
          <div className="panel-heading"><div><h2 id="profit-breakdown-title">Cost & margin</h2><p>Share of today&apos;s net sales · All figures in USD</p></div></div>
          <div className="order-summary"><span className="live-indicator"><i /> TRACKING</span><span>Today so far</span><span className="summary-divider" /><span>Last updated <strong>4:32 PM</strong></span></div>
          <div className="profit-breakdown-list">
            {breakdown.map((row) => {
              const share = row.amount / sales * 100;
              const value = row.kind === "cost" ? `−${money(row.amount)}` : money(row.amount);
              return (
                <div className={`profit-breakdown-row is-${row.kind}`} key={row.label}>
                  <div className="profit-breakdown-label"><span className="financial-label"><i className={`financial-dot ${row.tone}`} />{row.label}</span><span>{percent(row.amount)}</span></div>
                  <div className="profit-breakdown-track" aria-hidden="true"><i style={{ width: `${share}%` }} /></div>
                  <strong className="profit-breakdown-value">{value}</strong>
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel profit-insights-panel" aria-labelledby="profit-insights-title">
          <div className="panel-heading"><div><h2 id="profit-insights-title">Margin insights</h2><p>Signals calculated from today&apos;s figures</p></div></div>
          <div className="profit-insight-list">
            <article className="profit-insight" id="food-cost-insight">
              <span className="insight-kicker">FOOD COST</span>
              <strong>{percent(foodCost)} <span>vs. 26.5% target</span></strong>
              <p>Food cost is 1.5 percentage points above target. At today&apos;s sales, the gap is {money(foodCostGap)}.</p>
            </article>
            <article className="profit-insight">
              <span className="insight-kicker">PRIME COST</span>
              <strong>{money(primeCost)} <span>· {percent(primeCost)} of sales</span></strong>
              <p>Food and labor together account for {percent(primeCost)} of today&apos;s sales.</p>
            </article>
            <article className="profit-insight">
              <span className="insight-kicker">OTHER EXPENSES</span>
              <strong>{percent(otherExpenses)} <span>of sales</span></strong>
              <p>{money(otherExpenses)} is recorded outside food and labor costs.</p>
            </article>
          </div>
        </section>
      </div>

      <section className="panel profit-ledger-panel" aria-labelledby="profit-ledger-title">
        <div className="panel-heading"><div><h2 id="profit-ledger-title">Detailed breakdown</h2><p>How sales flow through costs to net profit</p></div><span className="ingredient-count">USD</span></div>
        <div className="profit-table-scroll">
          <table className="profit-table">
            <thead><tr><th>Line item</th><th>Amount</th><th>% of sales</th></tr></thead>
            <tbody>
              {ledgerRows.map((row) => (
                <tr className={`profit-table-${row.type}`} id={row.label === "Gross profit" ? "gross-profit-row" : row.label === "Net profit" ? "net-profit-row" : undefined} key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td>{row.amount < 0 ? `−${money(Math.abs(row.amount))}` : money(row.amount)}</td>
                  <td>{percent(Math.abs(row.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </WorkspacePageShell>
  );
}