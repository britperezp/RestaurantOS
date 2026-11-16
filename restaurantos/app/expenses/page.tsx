"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { expenseCategories, paymentMethods, type Expense, type ExpenseInput } from "@/lib/expenses";

type ExpenseModal = "create" | "edit" | "view" | null;

const today = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => today().slice(0, 7);
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
const dateLabel = (value: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00`));

const emptyForm = (date = ""): ExpenseInput => ({ date, vendor: "", category: "Food & beverage", amount: 0, paymentMethod: "Credit card", reference: "", notes: "" });

async function requestJson<T>(url: string, method: "POST" | "PUT", body: ExpenseInput): Promise<T> {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? "Could not save expense.");
  return result;
}

function Icon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    inventory: <><path d="m4 7 8-4 8 4-8 4-8-4Z" /><path d="m4 12 8 4 8-4M4 17l8 4 8-4M4 7v10M20 7v10" /></>,
    waste: <><path d="M12 3 2.8 19a1.4 1.4 0 0 0 1.2 2h16a1.4 1.4 0 0 0 1.2-2L12 3Z" /><path d="M12 9v4M12 17h.01" /></>,
    receipt: <><path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3Z" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
    profit: <><path d="M4 19V5M4 19h17" /><path d="m7 15 4-4 3 2 6-7" /><path d="M16 6h4v4" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    edit: <><path d="m15 5 4 4M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16l-1 4Z" /></>,
    trash: <><path d="M4 7h16M10 11v6M14 11v6M5 7l1 14h12l1-14M9 7V4h6v3" /></>,
  };

  return <svg aria-hidden="true" className="expense-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [databaseStatus, setDatabaseStatus] = useState<"loading" | "ready" | "error">("loading");
  const [isSaving, setIsSaving] = useState(false);
  const [modal, setModal] = useState<ExpenseModal>(null);
  const [activeId, setActiveId] = useState("");
  const [form, setForm] = useState<ExpenseInput>(() => emptyForm());
  const [requestError, setRequestError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All categories");
  const [monthFilter, setMonthFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadExpenses() {
      try {
        const response = await fetch("/api/expenses", { cache: "no-store" });
        const result = await response.json() as { expenses?: Expense[] };
        if (!response.ok || !result.expenses) throw new Error("Could not load expenses.");
        if (!cancelled) {
          setExpenses(result.expenses);
          setMonthFilter((month) => month || currentMonth());
          const requestedExpenseId = new URLSearchParams(window.location.search).get("expense");
          const requestedExpense = result.expenses.find((expense) => expense.id === requestedExpenseId);
          if (requestedExpense) {
            setActiveId(requestedExpense.id);
            setModal("view");
          }
          setDatabaseStatus("ready");
        }
      } catch {
        if (!cancelled) setDatabaseStatus("error");
      }
    }
    void loadExpenses();
    return () => { cancelled = true; };
  }, []);

  const monthExpenses = expenses.filter((expense) => expense.date.startsWith(monthFilter));
  const activeExpense = expenses.find((expense) => expense.id === activeId);
  const monthTotal = monthExpenses.reduce((total, expense) => total + expense.amount, 0);
  const averageExpense = monthExpenses.length ? monthTotal / monthExpenses.length : 0;
  const categoryTotals = expenseCategories
    .map((category) => ({ category, amount: monthExpenses.filter((expense) => expense.category === category).reduce((total, expense) => total + expense.amount, 0) }))
    .filter((entry) => entry.amount > 0)
    .sort((left, right) => right.amount - left.amount);
  const topCategory = categoryTotals[0];
  const filteredExpenses = expenses.filter((expense) => {
    const matchesSearch = `${expense.vendor} ${expense.category} ${expense.reference} ${expense.notes}`.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === "All categories" || expense.category === categoryFilter;
    const matchesMonth = !monthFilter || expense.date.startsWith(monthFilter);
    return matchesSearch && matchesCategory && matchesMonth;
  });

  function openCreate() {
    setActiveId("");
    setForm(emptyForm(today()));
    setRequestError("");
    setModal("create");
  }

  function openEdit(expense: Expense) {
    const { id, ...expenseForm } = expense;
    setActiveId(id);
    setForm(expenseForm);
    setRequestError("");
    setModal("edit");
  }

  async function submitExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setRequestError("");
    try {
      if (modal === "edit") {
        const { expense } = await requestJson<{ expense: Expense }>(`/api/expenses/${activeId}`, "PUT", form);
        setExpenses((current) => current.map((item) => item.id === expense.id ? expense : item));
      } else {
        const { expense } = await requestJson<{ expense: Expense }>("/api/expenses", "POST", form);
        setExpenses((current) => [expense, ...current]);
      }
      setModal(null);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Could not save expense.");
    } finally {
      setIsSaving(false);
    }
  }

  async function removeExpense(expense: Expense) {
    if (!window.confirm(`Delete the ${money(expense.amount)} expense from ${expense.vendor}?`)) return;
    setRequestError("");
    try {
      const response = await fetch(`/api/expenses/${expense.id}`, { method: "DELETE" });
      if (!response.ok) {
        const result = await response.json() as { error?: string };
        throw new Error(result.error ?? "Could not delete expense.");
      }
      setExpenses((current) => current.filter((item) => item.id !== expense.id));
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Could not delete expense.");
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="RestaurantOS overview"><span className="brand-mark" aria-hidden="true"><span /><span /><span /></span><span>restaurant<span className="brand-os">OS</span></span></Link>
        <div className="location-switcher"><span className="location-avatar">B</span><span className="location-copy"><strong>Bar Siena</strong><small>Downtown · Chicago</small></span><span className="chevron" aria-hidden="true">⌄</span></div>
        <p className="nav-label">WORKSPACE</p>
        <nav className="primary-nav" aria-label="Main navigation">
          <Link className="nav-link" href="/"><Icon name="grid" /><span>Overview</span></Link>
          <Link className="nav-link" href="/inventory"><Icon name="inventory" /><span>Inventory</span></Link>
          <Link className="nav-link" href="/waste"><Icon name="waste" /><span>Waste alerts</span></Link>
          <Link className="nav-link is-active" href="/expenses" aria-current="page"><Icon name="receipt" /><span>Expenses</span></Link>
          <Link className="nav-link" href="/profit-loss"><Icon name="profit" /><span>Profit & loss</span></Link>
        </nav>
        <div className="sidebar-bottom">
          <div className={`sidebar-note${databaseStatus === "error" ? " is-offline" : ""}`}><span className="status-dot" />{databaseStatus === "loading" ? "Connecting to database" : databaseStatus === "error" ? "Database connection failed" : isSaving ? "Saving expense" : "SQLite database connected"}</div>
          <Link className="profile-link" href="/"><span className="profile-avatar">JM</span><span className="profile-copy"><strong>Jordan Miller</strong><small>Restaurant manager</small></span><span className="chevron" aria-hidden="true">⌄</span></Link>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar"><div className="breadcrumb"><Link href="/">Bar Siena</Link><span className="breadcrumb-divider">/</span><strong>Expenses</strong></div><div className="topbar-actions"><span className={`service-pill${databaseStatus === "error" ? " is-offline" : ""}`}><span className="status-dot" />{databaseStatus === "error" ? "Database offline" : databaseStatus === "loading" ? "Connecting" : "Database connected"}</span><span className="top-avatar">JM</span></div></header>

        <div className="page-content expenses-page">
          <section className="welcome-row" aria-labelledby="page-title">
            <div><p className="eyebrow">BAR SIENA <span className="eyebrow-dot">·</span> FINANCIAL CONTROL</p><h1 id="page-title">Expenses<span className="title-period">.</span></h1><p className="welcome-subtitle">Every cost accounted for, all in one place.</p></div>
            <button className="button button-primary expense-add-button" type="button" disabled={databaseStatus !== "ready"} onClick={openCreate}><Icon name="plus" /> Add expense</button>
          </section>

          {databaseStatus === "error" && <div className="database-error" role="alert"><div><strong>Expenses database unavailable</strong><span>Check the server connection, then reload this page.</span></div><button type="button" onClick={() => window.location.reload()}>Retry</button></div>}

          <section className="expense-summary-grid" aria-label="Expense summary">
            <article className="stock-stat"><span className="stock-stat-label">Expenses this month</span><strong>{money(monthTotal)}</strong><span className="stock-stat-note">{monthExpenses.length} recorded transactions</span></article>
            <article className="stock-stat"><span className="stock-stat-label">Average transaction</span><strong>{money(averageExpense)}</strong><span className="stock-stat-note">For the selected month</span></article>
            <article className="stock-stat"><span className="stock-stat-label">Top expense category</span><strong className="expense-top-category">{topCategory?.category ?? "No expenses"}</strong><span className="stock-stat-note">{topCategory ? `${money(topCategory.amount)} this month` : "Add a transaction to begin"}</span></article>
            <article className="stock-stat"><span className="stock-stat-label">Categories in use</span><strong>{categoryTotals.length}</strong><span className="stock-stat-note">With activity this month</span></article>
          </section>

          {categoryTotals.length > 0 && <section className="expense-category-panel" aria-labelledby="category-breakdown-title">
            <div className="expense-category-heading"><div><h2 id="category-breakdown-title">Spend by category</h2><p>Share of expenses for {new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(`${monthFilter}-01T12:00:00`))}</p></div><label className="month-picker"><span className="visually-hidden">Expense month</span><input type="month" value={monthFilter} onChange={(event) => setMonthFilter(event.currentTarget.value)} /></label></div>
            <div className="expense-category-bars">{categoryTotals.slice(0, 5).map((entry, index) => <div className="expense-category-row" key={entry.category}><span className={`expense-category-mark category-mark-${index}`} /><span className="expense-category-name">{entry.category}</span><span className="expense-category-track"><i style={{ width: `${Math.max(4, entry.amount / monthTotal * 100)}%` }} /></span><strong>{money(entry.amount)}</strong><small>{Math.round(entry.amount / monthTotal * 100)}%</small></div>)}</div>
          </section>}

          <section className="panel expense-ledger" aria-labelledby="expense-ledger-title">
            <div className="panel-heading"><div><h2 id="expense-ledger-title">Expense ledger</h2><p>Recorded costs and supplier purchases</p></div><span className="ingredient-count">{filteredExpenses.length} transactions</span></div>
            <div className="expense-toolbar">
              <label className="stock-search"><Icon name="search" /><input aria-label="Search expenses" value={search} onChange={(event) => setSearch(event.currentTarget.value)} placeholder="Search vendors, notes, or references" /></label>
              <label className="expense-month-filter"><span className="visually-hidden">Filter by month</span><input type="month" value={monthFilter} onChange={(event) => setMonthFilter(event.currentTarget.value)} /></label>
              <label className="category-select-label"><span className="visually-hidden">Filter by category</span><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.currentTarget.value)}><option>All categories</option>{expenseCategories.map((category) => <option key={category}>{category}</option>)}</select></label>
            </div>
            {requestError && !modal && <p className="ledger-error" role="alert">{requestError}</p>}
            <div className="stock-table-scroll">
              <table className="expense-table"><thead><tr><th>Date</th><th>Vendor / details</th><th>Category</th><th>Payment</th><th>Reference</th><th>Amount</th><th><span className="visually-hidden">Actions</span></th></tr></thead>
                <tbody>
                  {databaseStatus === "loading" && <tr><td className="empty-table" colSpan={7}>Loading expenses from database...</td></tr>}
                  {filteredExpenses.map((expense) => <tr key={expense.id}><td>{dateLabel(expense.date)}</td><td><strong className="expense-vendor">{expense.vendor}</strong>{expense.notes && <small className="expense-notes">{expense.notes}</small>}</td><td><span className="expense-category-tag">{expense.category}</span></td><td>{expense.paymentMethod}</td><td>{expense.reference || <span className="no-reference">—</span>}</td><td className="expense-amount-cell">{money(expense.amount)}</td><td><div className="expense-row-actions"><button type="button" aria-label={`Edit ${expense.vendor} expense`} onClick={() => openEdit(expense)}><Icon name="edit" /></button><button type="button" aria-label={`Delete ${expense.vendor} expense`} onClick={() => void removeExpense(expense)}><Icon name="trash" /></button></div></td></tr>)}
                  {databaseStatus === "ready" && filteredExpenses.length === 0 && <tr><td className="empty-table" colSpan={7}>No expenses match these filters.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
          <footer className="page-footer"><span>RestaurantOS <i>·</i> Expense ledger</span><span>{databaseStatus === "ready" ? "Changes saved to database" : databaseStatus === "loading" ? "Connecting to database" : "Database connection needs attention"} <span className="sync-dot" /></span></footer>
        </div>
      </main>

      {modal && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSaving) setModal(null); }}>
        {modal === "view" && activeExpense ? <section className="inventory-modal expense-modal" role="dialog" aria-modal="true" aria-labelledby="expense-modal-title">
          <div className="modal-heading"><div><p className="modal-eyebrow">FINANCIAL CONTROL</p><h2 id="expense-modal-title">Expense details</h2><p className="modal-description">{activeExpense.vendor}</p></div><button className="modal-close" type="button" onClick={() => setModal(null)} aria-label="Close dialog"><Icon name="close" /></button></div>
          <dl className="expense-detail-list">
            <div><dt>Date</dt><dd>{dateLabel(activeExpense.date)}</dd></div>
            <div><dt>Vendor</dt><dd>{activeExpense.vendor}</dd></div>
            <div><dt>Category</dt><dd>{activeExpense.category}</dd></div>
            <div><dt>Amount</dt><dd>{money(activeExpense.amount)}</dd></div>
            <div><dt>Payment method</dt><dd>{activeExpense.paymentMethod}</dd></div>
            <div><dt>Invoice / reference</dt><dd>{activeExpense.reference || "—"}</dd></div>
            <div className="expense-detail-notes"><dt>Notes</dt><dd>{activeExpense.notes || "—"}</dd></div>
          </dl>
          <div className="modal-actions"><button className="button button-secondary" type="button" onClick={() => setModal(null)}>Close</button><button className="button button-primary" type="button" onClick={() => openEdit(activeExpense)}>Edit expense</button></div>
        </section> : modal !== "view" && <section className="inventory-modal expense-modal" role="dialog" aria-modal="true" aria-labelledby="expense-modal-title">
          <div className="modal-heading"><div><p className="modal-eyebrow">FINANCIAL CONTROL</p><h2 id="expense-modal-title">{modal === "edit" ? "Edit expense" : "Add expense"}</h2><p className="modal-description">Keep the ledger up to date with accurate transaction details.</p></div><button className="modal-close" type="button" disabled={isSaving} onClick={() => setModal(null)} aria-label="Close dialog"><Icon name="close" /></button></div>
          <form onSubmit={submitExpense}>
            <label className="form-field"><span>Date</span><input autoFocus type="date" required value={form.date} onChange={(event) => setForm({ ...form, date: event.currentTarget.value })} /></label>
            <label className="form-field"><span>Vendor</span><input required maxLength={120} value={form.vendor} onChange={(event) => setForm({ ...form, vendor: event.currentTarget.value })} placeholder="e.g. Greenleaf Produce" /></label>
            <label className="form-field"><span>Category</span><select value={form.category} onChange={(event) => setForm({ ...form, category: event.currentTarget.value })}>{expenseCategories.map((category) => <option key={category}>{category}</option>)}</select></label>
            <label className="form-field"><span>Amount (USD)</span><input type="number" min="0.01" step="0.01" required value={form.amount || ""} onChange={(event) => setForm({ ...form, amount: Number(event.currentTarget.value) })} placeholder="0.00" /></label>
            <label className="form-field"><span>Payment method</span><select value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.currentTarget.value })}>{paymentMethods.map((method) => <option key={method}>{method}</option>)}</select></label>
            <label className="form-field"><span>Invoice / reference</span><input maxLength={120} value={form.reference} onChange={(event) => setForm({ ...form, reference: event.currentTarget.value })} placeholder="Optional" /></label>
            <label className="form-field form-span-two"><span>Notes</span><textarea maxLength={500} rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.currentTarget.value })} placeholder="Add details for your records" /></label>
            {requestError && <p className="form-error form-span-two" role="alert">{requestError}</p>}
            <div className="modal-actions form-span-two"><button className="button button-secondary" type="button" disabled={isSaving} onClick={() => setModal(null)}>Cancel</button><button className="button button-primary" type="submit" disabled={isSaving}>{isSaving ? "Saving..." : modal === "edit" ? "Save changes" : "Add expense"}</button></div>
          </form>
        </section>}
      </div>}
    </div>
  );
}