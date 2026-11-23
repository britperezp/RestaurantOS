"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { useEffect, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { inventoryCategories as categories, inventorySuppliers as suppliers, inventoryUnits, type Ingredient } from "@/lib/inventory";
import { restaurantIdentity } from "@/lib/restaurant-identity";

type InventoryFilter = "all" | "low" | "out";
type ModalType = "ingredient" | "restock" | "adjust" | "history" | null;

const money = (amount: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
const quantity = (amount: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(amount);
const dateLabel = (date: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${date}T12:00:00`));
const inventoryQueryListeners = new Set<() => void>();

function getInventoryQuery() {
  return window.location.search;
}

function subscribeToInventoryQuery(listener: () => void) {
  inventoryQueryListeners.add(listener);
  window.addEventListener("popstate", listener);
  return () => {
    inventoryQueryListeners.delete(listener);
    window.removeEventListener("popstate", listener);
  };
}

function updateInventoryQuery(key: "search" | "filter", value: string) {
  const url = new URL(window.location.href);
  if (value) url.searchParams.set(key, value);
  else url.searchParams.delete(key);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  inventoryQueryListeners.forEach((listener) => listener());
}

async function sendJson<T>(url: string, method: "POST" | "PATCH", body: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? "Could not save inventory changes.");
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
    box: <><path d="m4 7 8-4 8 4v10l-8 4-8-4V7Z" /><path d="m4 7 8 4 8-4M12 11v10" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
  };

  return <svg aria-hidden="true" className="inventory-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function getStockState(item: Ingredient) {
  if (item.stock <= 0) return "out";
  if (item.stock <= item.par) return "low";
  return "healthy";
}

export default function InventoryPage() {
  const querySnapshot = useSyncExternalStore(subscribeToInventoryQuery, getInventoryQuery, () => "");
  const query = new URLSearchParams(querySnapshot);
  const search = query.get("search") ?? "";
  const requestedFilter = query.get("filter");
  const filter: InventoryFilter = requestedFilter === "low" || requestedFilter === "out" ? requestedFilter : "all";
  const [inventory, setInventory] = useState<Ingredient[]>([]);
  const [databaseStatus, setDatabaseStatus] = useState<"loading" | "ready" | "error">("loading");
  const [isSaving, setIsSaving] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All categories");
  const [modal, setModal] = useState<ModalType>(null);
  const [activeId, setActiveId] = useState("");
  const [ingredientForm, setIngredientForm] = useState({ name: "", category: "Produce", stock: "", unit: "kg", par: "", unitCost: "", supplier: suppliers[0] });
  const [purchaseForm, setPurchaseForm] = useState({ quantity: "", unitCost: "", supplier: "", invoice: "" });
  const [adjustmentForm, setAdjustmentForm] = useState({ quantity: "", reason: "Waste", note: "" });

  useEffect(() => {
    let cancelled = false;
    async function loadInventory() {
      try {
        const response = await fetch("/api/inventory", { cache: "no-store" });
        const result = await response.json() as { ingredients?: Ingredient[]; error?: string };
        if (!response.ok || !result.ingredients) throw new Error(result.error ?? "Could not connect to the inventory database.");
        if (!cancelled) {
          setInventory(result.ingredients);
          setDatabaseStatus("ready");
        }
      } catch {
        if (!cancelled) setDatabaseStatus("error");
      }
    }
    void loadInventory();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!modal) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModal(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modal]);

  const activeIngredient = inventory.find((item) => item.id === activeId);
  const lowStockItems = inventory.filter((item) => getStockState(item) !== "healthy");
  const stockValue = inventory.reduce((total, item) => total + item.stock * item.unitCost, 0);
  const supplierCount = new Set(inventory.map((item) => item.supplier)).size;
  const filteredInventory = inventory
    .filter((item) => {
      const matchesSearch = `${item.name} ${item.category} ${item.supplier}`.toLowerCase().includes(search.toLowerCase());
      const state = getStockState(item);
      const matchesState = filter === "all" || (filter === "low" && state !== "healthy") || (filter === "out" && state === "out");
      const matchesCategory = categoryFilter === "All categories" || item.category === categoryFilter;
      return matchesSearch && matchesState && matchesCategory;
    })
    .sort((left, right) => left.name.localeCompare(right.name));
  const recentPurchases = inventory
    .flatMap((item) => item.purchases.map((purchase) => ({ ...purchase, ingredient: item.name })))
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 5);

  function openRestock(item: Ingredient) {
    setActiveId(item.id);
    setPurchaseForm({ quantity: "", unitCost: String(item.unitCost), supplier: item.supplier, invoice: "" });
    setRequestError("");
    setModal("restock");
  }

  function openAdjustment(item: Ingredient) {
    setActiveId(item.id);
    setAdjustmentForm({ quantity: "", reason: "Waste", note: "" });
    setRequestError("");
    setModal("adjust");
  }

  async function handleCreateIngredient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setRequestError("");
    try {
      const { ingredient } = await sendJson<{ ingredient: Ingredient }>("/api/inventory", "POST", {
      name: ingredientForm.name.trim(),
      category: ingredientForm.category,
      stock: Number(ingredientForm.stock),
      unit: ingredientForm.unit,
      par: Number(ingredientForm.par),
      unitCost: Number(ingredientForm.unitCost),
      supplier: ingredientForm.supplier,
      });
      setInventory((current) => [...current, ingredient]);
      setIngredientForm({ name: "", category: "Produce", stock: "", unit: "kg", par: "", unitCost: "", supplier: suppliers[0] });
      setModal(null);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Could not save ingredient.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRecordPurchase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeIngredient) return;
    setIsSaving(true);
    setRequestError("");
    try {
      const { ingredient } = await sendJson<{ ingredient: Ingredient }>(`/api/inventory/${activeIngredient.id}`, "PATCH", {
        type: "purchase",
        quantity: Number(purchaseForm.quantity),
        unitCost: Number(purchaseForm.unitCost),
        supplier: purchaseForm.supplier,
        invoice: purchaseForm.invoice.trim(),
      });
      setInventory((current) => current.map((item) => item.id === ingredient.id ? ingredient : item));
      setModal(null);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Could not record purchase.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAdjustStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeIngredient) return;
    const adjustment = Number(adjustmentForm.quantity);
    if (!adjustment || activeIngredient.stock + adjustment < 0) {
      setRequestError("Adjustment cannot reduce stock below zero.");
      return;
    }
    setIsSaving(true);
    setRequestError("");
    try {
      const { ingredient } = await sendJson<{ ingredient: Ingredient }>(`/api/inventory/${activeIngredient.id}`, "PATCH", {
        type: "adjustment",
        quantity: adjustment,
        reason: adjustmentForm.reason,
        note: adjustmentForm.note.trim(),
      });
      setInventory((current) => current.map((item) => item.id === ingredient.id ? ingredient : item));
      setModal(null);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Could not adjust stock.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="RestaurantOS overview">
          <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
          <span>restaurant<span className="brand-os">OS</span></span>
        </Link>
        <div className="location-switcher">
          <span className="location-avatar">{restaurantIdentity.initial}</span>
          <span className="location-copy"><strong>{restaurantIdentity.name}</strong><small>{restaurantIdentity.location}</small></span>
          <span className="chevron" aria-hidden="true">⌄</span>
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav className="primary-nav" aria-label="Main navigation">
          <Link className="nav-link" href="/"><Icon name="grid" /><span>Overview</span></Link>
          <Link className="nav-link is-active" href="/inventory" aria-current="page"><Icon name="inventory" /><span>Inventory</span></Link>
          <Link className="nav-link" href="/waste"><Icon name="waste" /><span>Waste alerts</span></Link>
          <Link className="nav-link" href="/expenses"><Icon name="receipt" /><span>Expenses</span></Link>
          <Link className="nav-link" href="/profit-loss"><Icon name="profit" /><span>Profit & loss</span></Link>
        </nav>
        <div className="sidebar-bottom">
          <div className={`sidebar-note${databaseStatus === "error" ? " is-offline" : ""}`}><span className="status-dot" />{databaseStatus === "loading" ? "Connecting to database" : databaseStatus === "error" ? "Database connection failed" : isSaving ? "Saving to database" : "SQLite database connected"}</div>
          <div className="profile-link"><UserButton /><span className="profile-copy"><strong>Your account</strong><small>Manage profile and sign out</small></span></div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb"><Link href="/">{restaurantIdentity.name}</Link><span className="breadcrumb-divider">/</span><strong>Inventory</strong></div>
          <div className="topbar-actions"><span className={`service-pill${databaseStatus === "error" ? " is-offline" : ""}`}><span className="status-dot" />{databaseStatus === "loading" ? "Connecting" : databaseStatus === "error" ? "Database offline" : isSaving ? "Saving changes" : "Database connected"}</span></div>
        </header>

        <div className="page-content inventory-page">
          <section className="welcome-row" aria-labelledby="page-title">
            <div>
              <p className="eyebrow">{restaurantIdentity.name.toUpperCase()} <span className="eyebrow-dot">·</span> STOCK CONTROL</p>
              <h1 id="page-title">Inventory<span className="title-period">.</span></h1>
              <p className="welcome-subtitle">Ingredients, on-hand quantities, costs, and supplier history.</p>
            </div>
            <div className="inventory-actions">
              <button className="button button-secondary" type="button" disabled={databaseStatus !== "ready" || inventory.length === 0} onClick={() => { setActiveId(inventory[0]?.id ?? ""); setPurchaseForm({ quantity: "", unitCost: String(inventory[0]?.unitCost ?? ""), supplier: inventory[0]?.supplier ?? suppliers[0], invoice: "" }); setRequestError(""); setModal("restock"); }}><Icon name="box" /> Record purchase</button>
              <button className="button button-primary" type="button" disabled={databaseStatus !== "ready"} onClick={() => { setRequestError(""); setModal("ingredient"); }}><Icon name="plus" /> Add ingredient</button>
            </div>
          </section>

          {databaseStatus === "error" && <div className="database-error" role="alert"><div><strong>Inventory database unavailable</strong><span>Check the server connection, then reload inventory.</span></div><button type="button" onClick={() => window.location.reload()}>Retry</button></div>}

          <section className="stock-summary-grid" aria-label="Inventory summary">
            <article className="stock-stat"><span className="stock-stat-label">Tracked ingredients</span><strong>{inventory.length}</strong><span className="stock-stat-note">Across {new Set(inventory.map((item) => item.category)).size} categories</span></article>
            <article className="stock-stat"><span className="stock-stat-label">Current stock value</span><strong>{money(stockValue)}</strong><span className="stock-stat-note">At latest unit cost</span></article>
            <article className="stock-stat stock-stat-alert"><span className="stock-stat-label">Needs attention</span><strong>{lowStockItems.length}</strong><span className="stock-stat-note">Low or out of stock</span></article>
            <article className="stock-stat"><span className="stock-stat-label">Active suppliers</span><strong>{supplierCount}</strong><span className="stock-stat-note">Linked to ingredients</span></article>
          </section>

          <section className="low-stock-section" aria-labelledby="low-stock-heading">
            <div className="low-stock-heading">
              <div><span className="warning-icon">!</span><div><h2 id="low-stock-heading">Low-stock alerts</h2><p>{lowStockItems.length ? "Restock before service is affected." : "All ingredients are above par."}</p></div></div>
              <span className="low-stock-total">{lowStockItems.length} alerts</span>
            </div>
            {lowStockItems.length > 0 ? (
              <div className="low-stock-cards">
                {lowStockItems.slice(0, 4).map((item) => (
                  <article className={`low-stock-card${item.stock === 0 ? " is-out" : ""}`} key={item.id}>
                    <div className="low-stock-card-top"><span className="stock-category-dot" />{item.category}<span className="low-stock-state">{item.stock === 0 ? "Out of stock" : "Below par"}</span></div>
                    <strong>{item.name}</strong>
                    <span className="low-stock-quantity">{quantity(item.stock)} {item.unit} <i>/</i> par {quantity(item.par)} {item.unit}</span>
                    <button className="small-action" type="button" disabled={databaseStatus !== "ready" || isSaving} onClick={() => openRestock(item)}>Restock <span aria-hidden="true">→</span></button>
                  </article>
                ))}
              </div>
            ) : <p className="all-stock-good">Stock levels look good. Your par levels are covered.</p>}
          </section>

          <section className="panel stock-table-panel" aria-labelledby="ingredients-heading">
            <div className="panel-heading stock-table-heading">
              <div><h2 id="ingredients-heading">Ingredients</h2><p>Manage stock, unit costs, and suppliers</p></div>
              <span className="ingredient-count">{filteredInventory.length} of {inventory.length} ingredients</span>
            </div>
            <div className="stock-toolbar">
              <label className="stock-search"><Icon name="search" /><input aria-label="Search ingredients" value={search} onChange={(event) => updateInventoryQuery("search", event.currentTarget.value)} placeholder="Search ingredients or suppliers" /></label>
              <label className="category-select-label"><span className="visually-hidden">Filter by category</span><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.currentTarget.value)}><option>All categories</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
              <div className="stock-filters" role="group" aria-label="Filter stock status">
                {(["all", "low", "out"] as InventoryFilter[]).map((option) => <button key={option} type="button" className={filter === option ? "is-selected" : ""} onClick={() => updateInventoryQuery("filter", option === "all" ? "" : option)}>{option === "all" ? "All stock" : option === "low" ? "Low stock" : "Out of stock"}</button>)}
              </div>
            </div>
            <div className="stock-table-scroll">
              <table className="stock-table">
                <thead><tr><th>Ingredient</th><th>On hand</th><th>Par level</th><th>Unit cost</th><th>Supplier</th><th>Status</th><th><span className="visually-hidden">Actions</span></th></tr></thead>
                <tbody>
                  {databaseStatus === "loading" && <tr><td className="empty-table" colSpan={7}>Loading inventory from database...</td></tr>}
                  {filteredInventory.map((item) => {
                    const state = getStockState(item);
                    return <tr key={item.id}>
                      <td><button className="ingredient-name-button" type="button" onClick={() => { setActiveId(item.id); setModal("history"); }}><strong>{item.name}</strong><span>{item.category}</span></button></td>
                      <td><strong className={state === "out" ? "stock-quantity is-zero" : state === "low" ? "stock-quantity is-low" : "stock-quantity"}>{quantity(item.stock)} <small>{item.unit}</small></strong></td>
                      <td>{quantity(item.par)} <span className="table-unit">{item.unit}</span></td>
                      <td>{money(item.unitCost)}<span className="table-unit"> / {item.unit}</span></td>
                      <td className="supplier-cell">{item.supplier}</td>
                      <td><span className={`stock-status status-${state}`}>{state === "out" ? "Out of stock" : state === "low" ? "Low stock" : "In stock"}</span></td>
                      <td><div className="table-actions"><button type="button" disabled={databaseStatus !== "ready" || isSaving} onClick={() => openRestock(item)}>Restock</button><button type="button" disabled={databaseStatus !== "ready" || isSaving} className="more-action" aria-label={`Adjust ${item.name} stock`} onClick={() => openAdjustment(item)}>Adjust</button></div></td>
                    </tr>;
                  })}
                  {databaseStatus === "ready" && filteredInventory.length === 0 && <tr><td className="empty-table" colSpan={7}>No ingredients match these filters.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel purchase-history-panel" aria-labelledby="purchase-history-heading">
            <div className="panel-heading"><div><h2 id="purchase-history-heading">Recent purchase history</h2><p>Latest supplier deliveries and stock updates</p></div><span className="history-period"><Icon name="clock" /> Latest activity</span></div>
            <div className="history-table-scroll">
              <table className="history-table"><thead><tr><th>Date</th><th>Ingredient</th><th>Supplier / reference</th><th>Quantity</th><th>Unit cost</th><th>Total</th></tr></thead>
                <tbody>{recentPurchases.map((entry) => <tr key={entry.id}><td>{dateLabel(entry.date)}</td><td><strong>{entry.ingredient}</strong><span className={`history-type${entry.type === "adjustment" ? " adjustment-type" : ""}`}>{entry.type === "purchase" ? "Purchase" : entry.note ?? "Adjustment"}</span></td><td>{entry.supplier}<small>{entry.invoice}</small></td><td>{entry.quantity > 0 ? "+" : ""}{quantity(entry.quantity)} {entry.unit}</td><td>{money(entry.unitCost)}<span className="table-unit"> / {entry.unit}</span></td><td className="history-total">{entry.type === "purchase" ? money(entry.total) : "Stock update"}</td></tr>)}</tbody>
              </table>
            </div>
          </section>

          <footer className="page-footer"><span>RestaurantOS <i>·</i> Demo inventory</span><span>{databaseStatus === "ready" ? requestError ? "Last change could not be saved" : isSaving ? "Saving changes to database" : "Changes saved to database" : databaseStatus === "loading" ? "Connecting to database" : "Database connection needs attention"} <span className="sync-dot" /></span></footer>
        </div>
      </main>

      {modal && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }}>
        {modal === "ingredient" && <section className="inventory-modal" role="dialog" aria-modal="true" aria-labelledby="ingredient-modal-title">
          <div className="modal-heading"><div><p className="modal-eyebrow">STOCK CONTROL</p><h2 id="ingredient-modal-title">Add ingredient</h2></div><button className="modal-close" type="button" onClick={() => setModal(null)} aria-label="Close dialog"><Icon name="close" /></button></div>
          <form onSubmit={handleCreateIngredient}>
            <label className="form-field form-span-two"><span>Ingredient name</span><input autoFocus required value={ingredientForm.name} onChange={(event) => setIngredientForm({ ...ingredientForm, name: event.currentTarget.value })} placeholder="e.g. San Marzano tomatoes" /></label>
            <label className="form-field"><span>Category</span><select value={ingredientForm.category} onChange={(event) => setIngredientForm({ ...ingredientForm, category: event.currentTarget.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
            <label className="form-field"><span>Unit of measure</span><select value={ingredientForm.unit} onChange={(event) => setIngredientForm({ ...ingredientForm, unit: event.currentTarget.value })}>{inventoryUnits.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
            <label className="form-field"><span>Current quantity</span><input type="number" min="0" step="0.01" required value={ingredientForm.stock} onChange={(event) => setIngredientForm({ ...ingredientForm, stock: event.currentTarget.value })} placeholder="0" /></label>
            <label className="form-field"><span>Par level</span><input type="number" min="0.01" step="0.01" required value={ingredientForm.par} onChange={(event) => setIngredientForm({ ...ingredientForm, par: event.currentTarget.value })} placeholder="Minimum stock" /></label>
            <label className="form-field"><span>Unit cost (USD)</span><input type="number" min="0" step="0.01" required value={ingredientForm.unitCost} onChange={(event) => setIngredientForm({ ...ingredientForm, unitCost: event.currentTarget.value })} placeholder="0.00" /></label>
            <label className="form-field"><span>Supplier</span><select value={ingredientForm.supplier} onChange={(event) => setIngredientForm({ ...ingredientForm, supplier: event.currentTarget.value })}>{suppliers.map((supplier) => <option key={supplier}>{supplier}</option>)}</select></label>
            {requestError && <p className="form-error form-span-two" role="alert">{requestError}</p>}
            <div className="modal-actions form-span-two"><button className="button button-secondary" type="button" disabled={isSaving} onClick={() => setModal(null)}>Cancel</button><button className="button button-primary" type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Add ingredient"}</button></div>
          </form>
        </section>}

        {modal === "restock" && <section className="inventory-modal" role="dialog" aria-modal="true" aria-labelledby="restock-modal-title">
          <div className="modal-heading"><div><p className="modal-eyebrow">INVENTORY UPDATE</p><h2 id="restock-modal-title">Record purchase</h2><p className="modal-description">Add received stock and keep the purchase ledger current.</p></div><button className="modal-close" type="button" onClick={() => setModal(null)} aria-label="Close dialog"><Icon name="close" /></button></div>
          <form onSubmit={handleRecordPurchase}>
            <label className="form-field form-span-two"><span>Ingredient</span><select value={activeId} onChange={(event) => { const selected = inventory.find((item) => item.id === event.currentTarget.value); setActiveId(event.currentTarget.value); if (selected) setPurchaseForm({ ...purchaseForm, unitCost: String(selected.unitCost), supplier: selected.supplier }); }}>{inventory.map((item) => <option value={item.id} key={item.id}>{item.name} · {quantity(item.stock)} {item.unit} on hand</option>)}</select></label>
            <label className="form-field"><span>Quantity received {activeIngredient && `(${activeIngredient.unit})`}</span><input autoFocus type="number" min="0.01" step="0.01" required value={purchaseForm.quantity} onChange={(event) => setPurchaseForm({ ...purchaseForm, quantity: event.currentTarget.value })} placeholder="0" /></label>
            <label className="form-field"><span>Unit cost (USD)</span><input type="number" min="0" step="0.01" required value={purchaseForm.unitCost} onChange={(event) => setPurchaseForm({ ...purchaseForm, unitCost: event.currentTarget.value })} /></label>
            <label className="form-field"><span>Supplier</span><select value={purchaseForm.supplier} onChange={(event) => setPurchaseForm({ ...purchaseForm, supplier: event.currentTarget.value })}>{suppliers.map((supplier) => <option key={supplier}>{supplier}</option>)}</select></label>
            <label className="form-field"><span>Invoice / reference</span><input value={purchaseForm.invoice} onChange={(event) => setPurchaseForm({ ...purchaseForm, invoice: event.currentTarget.value })} placeholder="Optional" /></label>
            {requestError && <p className="form-error form-span-two" role="alert">{requestError}</p>}
            <div className="modal-actions form-span-two"><button className="button button-secondary" type="button" disabled={isSaving} onClick={() => setModal(null)}>Cancel</button><button className="button button-primary" type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Save purchase"}</button></div>
          </form>
        </section>}

        {modal === "adjust" && activeIngredient && <section className="inventory-modal" role="dialog" aria-modal="true" aria-labelledby="adjust-modal-title">
          <div className="modal-heading"><div><p className="modal-eyebrow">CURRENTLY {quantity(activeIngredient.stock)} {activeIngredient.unit} ON HAND</p><h2 id="adjust-modal-title">Adjust stock</h2><p className="modal-description">Use a negative quantity to remove stock or a positive quantity to add it.</p></div><button className="modal-close" type="button" onClick={() => setModal(null)} aria-label="Close dialog"><Icon name="close" /></button></div>
          <form onSubmit={handleAdjustStock}>
            <label className="form-field"><span>Quantity change ({activeIngredient.unit})</span><input autoFocus type="number" step="0.01" required value={adjustmentForm.quantity} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, quantity: event.currentTarget.value })} placeholder="-1 or +1" /></label>
            <label className="form-field"><span>Reason</span><select value={adjustmentForm.reason} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, reason: event.currentTarget.value })}>{["Waste", "Usage", "Count correction", "Transfer", "Other"].map((reason) => <option key={reason}>{reason}</option>)}</select></label>
            <label className="form-field form-span-two"><span>Note</span><input value={adjustmentForm.note} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, note: event.currentTarget.value })} placeholder="Optional detail for the stock history" /></label>
            {requestError && <p className="form-error form-span-two" role="alert">{requestError}</p>}
            <div className="modal-actions form-span-two"><button className="button button-secondary" type="button" disabled={isSaving} onClick={() => setModal(null)}>Cancel</button><button className="button button-primary" type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Save adjustment"}</button></div>
          </form>
        </section>}

        {modal === "history" && activeIngredient && <section className="inventory-modal history-modal" role="dialog" aria-modal="true" aria-labelledby="history-modal-title">
          <div className="modal-heading"><div><p className="modal-eyebrow">{activeIngredient.category} · {activeIngredient.supplier}</p><h2 id="history-modal-title">{activeIngredient.name}</h2><p className="modal-description">{quantity(activeIngredient.stock)} {activeIngredient.unit} on hand · par {quantity(activeIngredient.par)} {activeIngredient.unit} · {money(activeIngredient.unitCost)} per {activeIngredient.unit}</p></div><button className="modal-close" type="button" onClick={() => setModal(null)} aria-label="Close dialog"><Icon name="close" /></button></div>
          <div className="history-modal-heading"><strong>Purchase & adjustment history</strong><button className="small-action" type="button" onClick={() => openRestock(activeIngredient)}>Record purchase <span aria-hidden="true">+</span></button></div>
          <div className="history-timeline">{[...activeIngredient.purchases].sort((left, right) => right.date.localeCompare(left.date)).map((entry) => <article className="history-event" key={entry.id}><span className={`history-event-mark${entry.type === "adjustment" ? " is-adjustment" : ""}`} /><div><strong>{entry.type === "purchase" ? entry.supplier : entry.note ?? "Stock adjustment"}</strong><span>{dateLabel(entry.date)} · {entry.type === "purchase" ? entry.invoice : "Manual adjustment"}</span></div><div className="history-event-quantity"><strong>{entry.quantity > 0 ? "+" : ""}{quantity(entry.quantity)} {entry.unit}</strong><span>{entry.type === "purchase" ? money(entry.total) : "Adjustment"}</span></div></article>)}{activeIngredient.purchases.length === 0 && <p className="history-empty">No purchase or adjustment history yet.</p>}</div>
        </section>}
      </div>}
    </div>
  );
}