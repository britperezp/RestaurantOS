"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type {
  PriceHistoryEntry,
  PurchaseOrder,
  PurchaseOrderInput,
  PurchaseOrderStatus,
  Supplier,
  SupplierInput,
} from "@/lib/purchasing";
import { restaurantIdentity } from "@/lib/restaurant-identity";

type PurchasingTab = "orders" | "suppliers" | "prices";
type PurchasingModal = "supplier" | "order" | "order-detail" | null;
type OrderLineForm = { itemName: string; quantity: string; unit: string; unitPrice: string };
type OrderForm = { supplierId: string; neededBy: string; notes: string; items: OrderLineForm[] };
type PurchasingData = { suppliers: Supplier[]; orders: PurchaseOrder[]; priceHistory: PriceHistoryEntry[] };

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
const dateLabel = (value: string | null) => value
  ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00`))
  : "Not scheduled";
const statusLabels: Record<PurchaseOrderStatus, string> = {
  draft: "Draft",
  pending_approval: "Awaiting approval",
  approved: "Approved",
  rejected: "Rejected",
  partially_received: "Partially received",
  received: "Received",
};
const emptySupplier: SupplierInput = {
  name: "",
  contactName: "",
  email: "",
  phone: "",
  paymentTerms: "Net 30",
  leadTimeDays: 0,
  notes: "",
  status: "active",
};
const emptyLine: OrderLineForm = { itemName: "", quantity: "", unit: "case", unitPrice: "" };

async function requestJson<T>(url: string, method: "POST" | "PATCH", body: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? "Could not save purchasing changes.");
  return result;
}

async function fetchPurchasingData(): Promise<PurchasingData> {
  const response = await fetch("/api/purchasing", { cache: "no-store" });
  const result = await response.json() as PurchasingData & { error?: string };
  if (!response.ok) throw new Error(result.error ?? "Could not load suppliers and purchasing data.");
  return result;
}

function Icon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    supplier: <><path d="M3 21h18M5 21V7l7-4 7 4v14M9 10h.01M15 10h.01M9 14h.01M15 14h.01M10 21v-4h4v4" /></>,
    order: <><path d="M3 7h18l-2 13H5L3 7Z" /><path d="M8 9V6a4 4 0 0 1 8 0v3M9 13h6" /></>,
    history: <><path d="M3 12a9 9 0 1 0 2.64-6.36L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    edit: <><path d="m15 5 4 4M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16l-1 4Z" /></>,
    check: <path d="m5 12 4 4L19 6" />,
  };
  return <svg aria-hidden="true" className="purchasing-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export default function PurchasingModule() {
  const [data, setData] = useState<PurchasingData>({ suppliers: [], orders: [], priceHistory: [] });
  const [databaseStatus, setDatabaseStatus] = useState<"loading" | "ready" | "error">("loading");
  const [tab, setTab] = useState<PurchasingTab>("orders");
  const [modal, setModal] = useState<PurchasingModal>(null);
  const [activeOrderId, setActiveOrderId] = useState("");
  const [activeSupplierId, setActiveSupplierId] = useState("");
  const [supplierForm, setSupplierForm] = useState<SupplierInput>(emptySupplier);
  const [orderForm, setOrderForm] = useState<OrderForm>({ supplierId: "", neededBy: "", notes: "", items: [{ ...emptyLine }] });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priceSearch, setPriceSearch] = useState("");
  const [approvalNote, setApprovalNote] = useState("");
  const [receiptReference, setReceiptReference] = useState("");
  const [receiptNote, setReceiptNote] = useState("");
  const [receiptQuantities, setReceiptQuantities] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [requestError, setRequestError] = useState("");

  const loadData = useCallback(async () => {
    try {
      setData(await fetchPurchasingData());
      setDatabaseStatus("ready");
      return true;
    } catch (error) {
      setDatabaseStatus("error");
      setRequestError(error instanceof Error ? error.message : "Could not load suppliers and purchasing data.");
      return false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadInitialData() {
      try {
        const result = await fetchPurchasingData();
        if (!cancelled) {
          setData(result);
          setDatabaseStatus("ready");
        }
      } catch (error) {
        if (!cancelled) {
          setDatabaseStatus("error");
          setRequestError(error instanceof Error ? error.message : "Could not load suppliers and purchasing data.");
        }
      }
    }
    void loadInitialData();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!modal) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving) setModal(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modal, isSaving]);

  const activeOrder = data.orders.find((order) => order.id === activeOrderId);
  const activeSuppliers = useMemo(() => data.suppliers.filter((supplier) => supplier.status === "active"), [data.suppliers]);
  const pendingCount = data.orders.filter((order) => order.status === "pending_approval").length;
  const openOrders = data.orders.filter((order) => ["pending_approval", "approved", "partially_received"].includes(order.status));
  const openValue = openOrders.reduce((total, order) => total + order.total, 0);
  const filteredOrders = data.orders.filter((order) => {
    const matchesSearch = `${order.orderNumber} ${order.supplierName} ${order.notes}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });
  const filteredSuppliers = data.suppliers.filter((supplier) =>
    `${supplier.name} ${supplier.contactName} ${supplier.email} ${supplier.phone}`.toLowerCase().includes(search.toLowerCase()));
  const filteredPrices = data.priceHistory.filter((entry) =>
    `${entry.itemName} ${entry.supplierName} ${entry.orderNumber}`.toLowerCase().includes(priceSearch.toLowerCase()));

  function openCreateSupplier() {
    setActiveSupplierId("");
    setSupplierForm({ ...emptySupplier });
    setRequestError("");
    setModal("supplier");
  }

  function openEditSupplier(supplier: Supplier) {
    setActiveSupplierId(supplier.id);
    setSupplierForm({
      name: supplier.name,
      contactName: supplier.contactName,
      email: supplier.email,
      phone: supplier.phone,
      paymentTerms: supplier.paymentTerms,
      leadTimeDays: supplier.leadTimeDays,
      notes: supplier.notes,
      status: supplier.status,
    });
    setRequestError("");
    setModal("supplier");
  }

  function openCreateOrder() {
    setOrderForm({ supplierId: activeSuppliers[0]?.id ?? "", neededBy: "", notes: "", items: [{ ...emptyLine }] });
    setRequestError("");
    setModal("order");
  }

  function openOrder(order: PurchaseOrder) {
    setActiveOrderId(order.id);
    setApprovalNote("");
    setReceiptReference("");
    setReceiptNote("");
    setReceiptQuantities(Object.fromEntries(order.items.map((item) => [item.id, ""])));
    setRequestError("");
    setModal("order-detail");
  }

  async function submitSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setRequestError("");
    try {
      const url = activeSupplierId ? `/api/purchasing/suppliers/${activeSupplierId}` : "/api/purchasing/suppliers";
      await requestJson(url, activeSupplierId ? "PATCH" : "POST", supplierForm);
      await loadData();
      setModal(null);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Could not save supplier.");
    } finally {
      setIsSaving(false);
    }
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setRequestError("");
    const input: PurchaseOrderInput = {
      supplierId: orderForm.supplierId,
      neededBy: orderForm.neededBy,
      notes: orderForm.notes,
      items: orderForm.items.map((item) => ({
        itemName: item.itemName,
        quantity: Number(item.quantity),
        unit: item.unit,
        unitPrice: Number(item.unitPrice),
      })),
    };
    try {
      await requestJson("/api/purchasing/orders", "POST", input);
      await loadData();
      setModal(null);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Could not create purchase order.");
    } finally {
      setIsSaving(false);
    }
  }

  async function performOrderAction(action: "submit" | "approve" | "reject") {
    if (!activeOrder) return;
    setIsSaving(true);
    setRequestError("");
    try {
      await requestJson(`/api/purchasing/orders/${activeOrder.id}`, "PATCH", { action, note: approvalNote });
      await loadData();
      setApprovalNote("");
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Could not update purchase order.");
    } finally {
      setIsSaving(false);
    }
  }

  async function receiveItems(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeOrder) return;
    const lines = activeOrder.items
      .map((item) => ({ orderItemId: item.id, quantity: Number(receiptQuantities[item.id] || 0) }))
      .filter((line) => line.quantity > 0);
    if (lines.length === 0) {
      setRequestError("Enter a quantity to receive for at least one item.");
      return;
    }
    setIsSaving(true);
    setRequestError("");
    try {
      await requestJson(`/api/purchasing/orders/${activeOrder.id}`, "PATCH", {
        action: "receive",
        lines,
        reference: receiptReference,
        note: receiptNote,
      });
      await loadData();
      setReceiptQuantities(Object.fromEntries(activeOrder.items.map((item) => [item.id, ""])));
      setReceiptReference("");
      setReceiptNote("");
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Could not record receipt.");
    } finally {
      setIsSaving(false);
    }
  }

  function updateOrderLine(index: number, patch: Partial<OrderLineForm>) {
    setOrderForm((current) => ({
      ...current,
      items: current.items.map((item, lineIndex) => lineIndex === index ? { ...item, ...patch } : item),
    }));
  }

  return (
    <>
      <div className="purchasing-page">
        <section className="welcome-row" aria-labelledby="page-title">
          <div>
            <p className="eyebrow">{restaurantIdentity.name.toUpperCase()} <span className="eyebrow-dot">·</span> SUPPLY CHAIN</p>
            <h1 id="page-title">Suppliers & purchasing<span className="title-period">.</span></h1>
            <p className="welcome-subtitle">Keep supplier relationships, costs, and incoming orders in sync.</p>
          </div>
          <div className="purchasing-actions">
            <button className="button button-secondary" type="button" onClick={openCreateSupplier}><Icon name="supplier" /> Add supplier</button>
            <button className="button button-primary" type="button" disabled={databaseStatus !== "ready" || activeSuppliers.length === 0} onClick={openCreateOrder}><Icon name="plus" /> New purchase order</button>
          </div>
        </section>

        {databaseStatus === "error" && <div className="database-error" role="alert"><div><strong>Purchasing database unavailable</strong><span>{requestError || "Check the server connection, then retry."}</span></div><button type="button" onClick={() => void loadData()}>Retry</button></div>}

        <section className="module-stat-grid purchasing-stat-grid" aria-label="Purchasing summary">
          <article className="stock-stat"><span className="stock-stat-label">Active suppliers</span><strong>{activeSuppliers.length}</strong><span className="stock-stat-note">{data.suppliers.length} in directory</span></article>
          <article className="stock-stat"><span className="stock-stat-label">Open purchase orders</span><strong>{openOrders.length}</strong><span className="stock-stat-note">Awaiting delivery or approval</span></article>
          <article className="stock-stat"><span className="stock-stat-label">Awaiting approval</span><strong>{pendingCount}</strong><span className="stock-stat-note">Requires a purchasing decision</span></article>
          <article className="stock-stat"><span className="stock-stat-label">Open order value</span><strong>{money(openValue)}</strong><span className="stock-stat-note">Approved and pending orders</span></article>
        </section>

        <section className="panel purchasing-panel">
          <div className="purchasing-tab-bar" role="tablist" aria-label="Purchasing sections">
            <button className={`purchasing-tab${tab === "orders" ? " is-active" : ""}`} type="button" role="tab" aria-selected={tab === "orders"} onClick={() => setTab("orders")}><Icon name="order" />Purchase orders<span>{data.orders.length}</span></button>
            <button className={`purchasing-tab${tab === "suppliers" ? " is-active" : ""}`} type="button" role="tab" aria-selected={tab === "suppliers"} onClick={() => setTab("suppliers")}><Icon name="supplier" />Suppliers<span>{data.suppliers.length}</span></button>
            <button className={`purchasing-tab${tab === "prices" ? " is-active" : ""}`} type="button" role="tab" aria-selected={tab === "prices"} onClick={() => setTab("prices")}><Icon name="history" />Price history<span>{data.priceHistory.length}</span></button>
          </div>

          {tab === "orders" && <section role="tabpanel" aria-label="Purchase orders">
            <div className="panel-heading purchasing-heading"><div><h2>Purchase orders</h2><p>Draft, route, approve, and receive supplier orders.</p></div><span className="ingredient-count">{filteredOrders.length} orders</span></div>
            <div className="purchasing-toolbar">
              <label className="stock-search"><Icon name="search" /><input aria-label="Search purchase orders" value={search} onChange={(event) => setSearch(event.currentTarget.value)} placeholder="Search order, supplier, or note" /></label>
              <label className="category-select-label"><span className="visually-hidden">Filter purchase order status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.currentTarget.value)}><option value="all">All statuses</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            </div>
            <div className="stock-table-scroll">
              <table className="purchasing-table"><thead><tr><th>Order</th><th>Supplier</th><th>Order date</th><th>Needed by</th><th>Status</th><th>Total</th><th><span className="visually-hidden">Details</span></th></tr></thead>
                <tbody>
                  {databaseStatus === "loading" && <tr><td className="empty-table" colSpan={7}>Loading purchasing data...</td></tr>}
                  {filteredOrders.map((order) => <tr key={order.id}>
                    <td><strong className="purchasing-order-number">{order.orderNumber}</strong><small>{order.items.length} line items</small></td>
                    <td>{order.supplierName}</td><td>{dateLabel(order.orderDate)}</td><td>{dateLabel(order.neededBy)}</td>
                    <td><span className={`purchasing-status status-${order.status}`}>{statusLabels[order.status]}</span></td>
                    <td className="purchasing-money">{money(order.total)}</td>
                    <td><button className="purchasing-open-button" type="button" onClick={() => openOrder(order)}>View</button></td>
                  </tr>)}
                  {databaseStatus === "ready" && filteredOrders.length === 0 && <tr><td className="empty-table" colSpan={7}>No purchase orders match these filters.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>}

          {tab === "suppliers" && <section role="tabpanel" aria-label="Suppliers">
            <div className="panel-heading purchasing-heading"><div><h2>Supplier directory</h2><p>Contact details and purchasing terms at a glance.</p></div><span className="ingredient-count">{filteredSuppliers.length} suppliers</span></div>
            <div className="purchasing-toolbar">
              <label className="stock-search"><Icon name="search" /><input aria-label="Search suppliers" value={search} onChange={(event) => setSearch(event.currentTarget.value)} placeholder="Search supplier or contact" /></label>
              <button className="button button-secondary purchasing-toolbar-button" type="button" onClick={openCreateSupplier}><Icon name="plus" /> Add supplier</button>
            </div>
            <div className="stock-table-scroll">
              <table className="purchasing-table supplier-table"><thead><tr><th>Supplier</th><th>Contact</th><th>Terms</th><th>Lead time</th><th>Orders</th><th>Status</th><th><span className="visually-hidden">Actions</span></th></tr></thead>
                <tbody>
                  {filteredSuppliers.map((supplier) => <tr key={supplier.id}>
                    <td><strong className="purchasing-order-number">{supplier.name}</strong><small>{supplier.email || supplier.phone || "Contact details not added"}</small></td>
                    <td>{supplier.contactName || "—"}</td><td>{supplier.paymentTerms}</td><td>{supplier.leadTimeDays ? `${supplier.leadTimeDays} days` : "—"}</td><td>{supplier.orderCount}</td>
                    <td><span className={`purchasing-status status-${supplier.status}`}>{supplier.status === "active" ? "Active" : "Inactive"}</span></td>
                    <td><button className="purchasing-open-button" type="button" onClick={() => openEditSupplier(supplier)}><Icon name="edit" /> Edit</button></td>
                  </tr>)}
                  {filteredSuppliers.length === 0 && <tr><td className="empty-table" colSpan={7}>No suppliers match this search.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>}

          {tab === "prices" && <section role="tabpanel" aria-label="Price history">
            <div className="panel-heading purchasing-heading"><div><h2>Item price history</h2><p>Compare recorded unit prices from approved purchase orders.</p></div><span className="ingredient-count">{filteredPrices.length} price records</span></div>
            <div className="purchasing-toolbar">
              <label className="stock-search"><Icon name="search" /><input aria-label="Search price history" value={priceSearch} onChange={(event) => setPriceSearch(event.currentTarget.value)} placeholder="Search items, suppliers, or orders" /></label>
            </div>
            <div className="stock-table-scroll">
              <table className="purchasing-table price-table"><thead><tr><th>Item</th><th>Supplier</th><th>Purchase order</th><th>Date</th><th>Quantity</th><th>Unit price</th></tr></thead>
                <tbody>
                  {filteredPrices.map((entry) => <tr key={entry.id}><td><strong className="purchasing-order-number">{entry.itemName}</strong></td><td>{entry.supplierName}</td><td>{entry.orderNumber}</td><td>{dateLabel(entry.orderDate)}</td><td>{entry.quantity} {entry.unit}</td><td className="purchasing-money">{money(entry.unitPrice)} <small>/ {entry.unit}</small></td></tr>)}
                  {filteredPrices.length === 0 && <tr><td className="empty-table" colSpan={6}>Price history appears after a purchase order is approved.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>}
        </section>

        {requestError && modal === null && databaseStatus !== "error" && <p className="purchasing-inline-error" role="alert">{requestError}</p>}
        <footer className="page-footer"><span>RestaurantOS <i>·</i> Suppliers & purchasing</span><span>{databaseStatus === "ready" ? "Purchasing data saved" : databaseStatus === "loading" ? "Connecting to database" : "Database connection needs attention"} <span className="sync-dot" /></span></footer>
      </div>

      {modal && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSaving) setModal(null); }}>
        {modal === "supplier" && <section className="inventory-modal purchasing-modal" role="dialog" aria-modal="true" aria-labelledby="supplier-modal-title">
          <div className="modal-heading"><div><p className="modal-eyebrow">SUPPLIER DIRECTORY</p><h2 id="supplier-modal-title">{activeSupplierId ? "Edit supplier" : "Add supplier"}</h2><p className="modal-description">Keep current contacts and terms available to the purchasing team.</p></div><button className="modal-close" type="button" disabled={isSaving} onClick={() => setModal(null)} aria-label="Close dialog"><Icon name="close" /></button></div>
          <form onSubmit={submitSupplier}>
            <label className="form-field form-span-two"><span>Supplier name</span><input autoFocus required maxLength={120} value={supplierForm.name} onChange={(event) => setSupplierForm({ ...supplierForm, name: event.currentTarget.value })} /></label>
            <label className="form-field"><span>Contact person</span><input maxLength={120} value={supplierForm.contactName} onChange={(event) => setSupplierForm({ ...supplierForm, contactName: event.currentTarget.value })} /></label>
            <label className="form-field"><span>Email</span><input type="email" maxLength={254} value={supplierForm.email} onChange={(event) => setSupplierForm({ ...supplierForm, email: event.currentTarget.value })} /></label>
            <label className="form-field"><span>Phone</span><input type="tel" maxLength={50} value={supplierForm.phone} onChange={(event) => setSupplierForm({ ...supplierForm, phone: event.currentTarget.value })} /></label>
            <label className="form-field"><span>Payment terms</span><input required maxLength={60} value={supplierForm.paymentTerms} onChange={(event) => setSupplierForm({ ...supplierForm, paymentTerms: event.currentTarget.value })} /></label>
            <label className="form-field"><span>Lead time (days)</span><input type="number" min="0" max="365" step="1" value={supplierForm.leadTimeDays} onChange={(event) => setSupplierForm({ ...supplierForm, leadTimeDays: Number(event.currentTarget.value) })} /></label>
            <label className="form-field"><span>Status</span><select value={supplierForm.status} onChange={(event) => setSupplierForm({ ...supplierForm, status: event.currentTarget.value === "inactive" ? "inactive" : "active" })}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
            <label className="form-field form-span-two"><span>Notes</span><textarea rows={3} maxLength={500} value={supplierForm.notes} onChange={(event) => setSupplierForm({ ...supplierForm, notes: event.currentTarget.value })} /></label>
            {requestError && <p className="form-error form-span-two" role="alert">{requestError}</p>}
            <div className="modal-actions form-span-two"><button className="button button-secondary" type="button" disabled={isSaving} onClick={() => setModal(null)}>Cancel</button><button className="button button-primary" type="submit" disabled={isSaving}>{isSaving ? "Saving..." : activeSupplierId ? "Save supplier" : "Add supplier"}</button></div>
          </form>
        </section>}

        {modal === "order" && <section className="inventory-modal purchasing-modal purchasing-order-modal" role="dialog" aria-modal="true" aria-labelledby="order-modal-title">
          <div className="modal-heading"><div><p className="modal-eyebrow">PURCHASING</p><h2 id="order-modal-title">New purchase order</h2><p className="modal-description">Create a draft order, then submit it for approval.</p></div><button className="modal-close" type="button" disabled={isSaving} onClick={() => setModal(null)} aria-label="Close dialog"><Icon name="close" /></button></div>
          <form onSubmit={submitOrder}>
            <label className="form-field"><span>Supplier</span><select required value={orderForm.supplierId} onChange={(event) => setOrderForm({ ...orderForm, supplierId: event.currentTarget.value })}><option value="">Choose supplier</option>{activeSuppliers.map((supplier) => <option value={supplier.id} key={supplier.id}>{supplier.name}</option>)}</select></label>
            <label className="form-field"><span>Needed by</span><input type="date" value={orderForm.neededBy} onChange={(event) => setOrderForm({ ...orderForm, neededBy: event.currentTarget.value })} /></label>
            <div className="purchasing-line-items form-span-two">
              <div className="purchasing-line-heading"><strong>Order items</strong><button className="purchasing-text-button" type="button" onClick={() => setOrderForm((current) => ({ ...current, items: [...current.items, { ...emptyLine }] }))}><Icon name="plus" /> Add line</button></div>
              {orderForm.items.map((item, index) => <div className="purchasing-line-form" key={index}>
                <label className="form-field"><span>Item</span><input required maxLength={120} value={item.itemName} onChange={(event) => updateOrderLine(index, { itemName: event.currentTarget.value })} placeholder="e.g. Roma tomatoes" /></label>
                <label className="form-field"><span>Quantity</span><input type="number" min="0.001" step="any" required value={item.quantity} onChange={(event) => updateOrderLine(index, { quantity: event.currentTarget.value })} /></label>
                <label className="form-field"><span>Unit</span><input required maxLength={24} value={item.unit} onChange={(event) => updateOrderLine(index, { unit: event.currentTarget.value })} /></label>
                <label className="form-field"><span>Unit price</span><input type="number" min="0" step="0.01" required value={item.unitPrice} onChange={(event) => updateOrderLine(index, { unitPrice: event.currentTarget.value })} /></label>
                <button className="purchasing-remove-line" type="button" disabled={orderForm.items.length === 1} aria-label={`Remove order item ${index + 1}`} onClick={() => setOrderForm((current) => ({ ...current, items: current.items.filter((_, lineIndex) => lineIndex !== index) }))}><Icon name="close" /></button>
              </div>)}
            </div>
            <label className="form-field form-span-two"><span>Order notes</span><textarea rows={3} maxLength={500} value={orderForm.notes} onChange={(event) => setOrderForm({ ...orderForm, notes: event.currentTarget.value })} /></label>
            {requestError && <p className="form-error form-span-two" role="alert">{requestError}</p>}
            <div className="modal-actions form-span-two"><button className="button button-secondary" type="button" disabled={isSaving} onClick={() => setModal(null)}>Cancel</button><button className="button button-primary" type="submit" disabled={isSaving || !orderForm.supplierId}>{isSaving ? "Saving..." : "Save draft"}</button></div>
          </form>
        </section>}

        {modal === "order-detail" && activeOrder && <section className="inventory-modal purchasing-modal purchasing-detail-modal" role="dialog" aria-modal="true" aria-labelledby="order-detail-title">
          <div className="modal-heading"><div><p className="modal-eyebrow">{activeOrder.orderNumber} <span className="purchasing-detail-dot">·</span> {activeOrder.supplierName}</p><h2 id="order-detail-title">Purchase order details</h2><p className="modal-description">Created {dateLabel(activeOrder.orderDate)} · Needed by {dateLabel(activeOrder.neededBy)}</p></div><button className="modal-close" type="button" disabled={isSaving} onClick={() => setModal(null)} aria-label="Close dialog"><Icon name="close" /></button></div>
          <div className="purchasing-detail-summary"><span className={`purchasing-status status-${activeOrder.status}`}>{statusLabels[activeOrder.status]}</span><strong>{money(activeOrder.total)}</strong></div>
          {activeOrder.notes && <p className="purchasing-order-note">{activeOrder.notes}</p>}
          <div className="purchasing-detail-lines">
            <div className="purchasing-line-heading"><strong>Items</strong><span>{activeOrder.items.length} lines</span></div>
            {activeOrder.items.map((item) => <div className="purchasing-detail-line" key={item.id}>
              <div><strong>{item.itemName}</strong><small>{money(item.unitPrice)} / {item.unit}</small></div>
              <span>{item.receivedQuantity} of {item.quantity} {item.unit} received</span>
              <strong>{money(item.lineTotal)}</strong>
            </div>)}
          </div>
          <div className="purchasing-approval-history">
            <div className="purchasing-line-heading"><strong>Approval history</strong><span>{activeOrder.approvals.length} events</span></div>
            {activeOrder.approvals.length ? activeOrder.approvals.map((approval) => <div className="purchasing-approval-event" key={approval.id}>
              <span className={`purchasing-approval-mark is-${approval.decision}`} />
              <div><strong>{approval.decision === "submitted" ? "Submitted for approval" : approval.decision === "approved" ? "Approved" : "Rejected"} · {approval.actor}</strong><small>{dateLabel(approval.createdAt.slice(0, 10))}{approval.note ? ` · ${approval.note}` : ""}</small></div>
            </div>) : <p className="purchasing-muted">This draft has not been submitted yet.</p>}
          </div>

          {activeOrder.status === "rejected" && activeOrder.rejectionReason && <p className="purchasing-rejection"><strong>Last rejection:</strong> {activeOrder.rejectionReason}</p>}
          {(activeOrder.status === "draft" || activeOrder.status === "rejected") && <div className="purchasing-action-panel">
            <p>{activeOrder.status === "rejected" ? "Send the order back for another approval review." : "Send this draft to an approver before placing the order."}</p>
            <button className="button button-primary" type="button" disabled={isSaving} onClick={() => void performOrderAction("submit")}>Submit for approval</button>
          </div>}
          {activeOrder.status === "pending_approval" && <div className="purchasing-action-panel">
            <label className="form-field"><span>Approval note (optional)</span><textarea rows={2} maxLength={500} value={approvalNote} onChange={(event) => setApprovalNote(event.currentTarget.value)} placeholder="Add a note for the order history" /></label>
            <div className="purchasing-decision-actions"><button className="button button-secondary" type="button" disabled={isSaving} onClick={() => void performOrderAction("reject")}>Reject</button><button className="button button-primary" type="button" disabled={isSaving} onClick={() => void performOrderAction("approve")}><Icon name="check" /> Approve order</button></div>
          </div>}
          {(activeOrder.status === "approved" || activeOrder.status === "partially_received") && <form className="purchasing-action-panel purchasing-receive-form" onSubmit={receiveItems}>
            <div><strong>Record a delivery</strong><p>Enter the quantities received now. Remaining quantities can be recorded later.</p></div>
            {activeOrder.items.filter((item) => item.receivedQuantity < item.quantity).map((item) => <label className="purchasing-receive-line" key={item.id}>
              <span><strong>{item.itemName}</strong><small>{item.quantity - item.receivedQuantity} {item.unit} remaining</small></span>
              <input aria-label={`Quantity received for ${item.itemName}`} type="number" min="0" max={item.quantity - item.receivedQuantity} step="any" value={receiptQuantities[item.id] ?? ""} onChange={(event) => setReceiptQuantities((current) => ({ ...current, [item.id]: event.currentTarget.value }))} placeholder="0" />
            </label>)}
            <div className="purchasing-receipt-meta">
              <label className="form-field"><span>Delivery reference</span><input maxLength={120} value={receiptReference} onChange={(event) => setReceiptReference(event.currentTarget.value)} placeholder="Optional" /></label>
              <label className="form-field"><span>Receiving note</span><input maxLength={500} value={receiptNote} onChange={(event) => setReceiptNote(event.currentTarget.value)} placeholder="Optional" /></label>
            </div>
            <button className="button button-primary" type="submit" disabled={isSaving}>{isSaving ? "Recording..." : "Record received items"}</button>
          </form>}
          {requestError && <p className="form-error purchasing-detail-error" role="alert">{requestError}</p>}
          <div className="modal-actions"><button className="button button-secondary" type="button" disabled={isSaving} onClick={() => setModal(null)}>Close</button></div>
        </section>}
      </div>}
    </>
  );
}
