"use client";

import { useState, useSyncExternalStore } from "react";
import { WorkspaceIcon } from "../workspace-page-shell";

type AlertStatus = "investigating" | "resolved" | "dismissed";

type WasteAlert = {
  item: string;
  detail: string;
  amount: number;
  reason: string;
  tone: string;
  status: AlertStatus;
};

const initialAlerts: WasteAlert[] = [
  {
    item: "Tomato sauce over-prep",
    detail: "3.2 L · Prepared yesterday",
    amount: 42,
    reason: "Use today",
    tone: "kitchen",
    status: "investigating",
  },
  {
    item: "Avocado trim loss",
    detail: "6 units · 12% spoilage",
    amount: 28,
    reason: "Above usual",
    tone: "ready",
    status: "investigating",
  },
  {
    item: "Salmon yield variance",
    detail: "0.8 kg · 18% trim vs 12% target",
    amount: 64,
    reason: "Review prep",
    tone: "served",
    status: "resolved",
  },
];

const alertStatuses: { value: AlertStatus; label: string }[] = [
  { value: "investigating", label: "Investigating" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
];

const statusStorageKey = "restaurantos:waste-alert-statuses";
const money = (amount: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
const isAlertStatus = (value: string): value is AlertStatus => alertStatuses.some((status) => status.value === value);
const emptyStatusesSnapshot = "{}";
const statusListeners = new Set<() => void>();
let cachedStatusesSnapshot: string | null = null;

function parseStoredStatuses(value: string): Record<string, AlertStatus> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    console.error("Unable to parse saved Waste Alerts statuses.", error);
    return {};
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    console.error("Saved Waste Alerts statuses must be an object.");
    return {};
  }

  const storedValues = parsed as Record<string, unknown>;
  const statuses: Record<string, AlertStatus> = {};
  for (const alert of initialAlerts) {
    const status = storedValues[alert.item];
    if (typeof status === "string" && isAlertStatus(status)) {
      statuses[alert.item] = status;
    }
  }
  return statuses;
}

function getStatusesSnapshot() {
  if (cachedStatusesSnapshot !== null) return cachedStatusesSnapshot;

  try {
    cachedStatusesSnapshot = window.localStorage.getItem(statusStorageKey) ?? emptyStatusesSnapshot;
  } catch (error) {
    console.error("Unable to load saved Waste Alerts statuses.", error);
    cachedStatusesSnapshot = emptyStatusesSnapshot;
  }
  return cachedStatusesSnapshot;
}

function notifyStatusListeners() {
  statusListeners.forEach((listener) => listener());
}

function handleStatusesStorage(event: StorageEvent) {
  if (event.key !== statusStorageKey && event.key !== null) return;
  cachedStatusesSnapshot = event.newValue ?? emptyStatusesSnapshot;
  notifyStatusListeners();
}

function subscribeToStatuses(listener: () => void) {
  statusListeners.add(listener);
  window.addEventListener("storage", handleStatusesStorage);
  return () => {
    statusListeners.delete(listener);
    if (statusListeners.size === 0) window.removeEventListener("storage", handleStatusesStorage);
  };
}

function saveAlertStatus(item: string, status: AlertStatus) {
  const updatedSnapshot = JSON.stringify({ ...parseStoredStatuses(getStatusesSnapshot()), [item]: status });
  cachedStatusesSnapshot = updatedSnapshot;
  try {
    window.localStorage.setItem(statusStorageKey, updatedSnapshot);
  } catch (error) {
    console.error("Unable to save Waste Alerts statuses.", error);
  }
  notifyStatusListeners();
}

export default function WasteAlertsModule() {
  const statusesSnapshot = useSyncExternalStore(subscribeToStatuses, getStatusesSnapshot, () => emptyStatusesSnapshot);
  const savedStatuses = parseStoredStatuses(statusesSnapshot);
  const alerts = initialAlerts.map((alert) => ({
    ...alert,
    status: savedStatuses[alert.item] ?? alert.status,
  }));
  const [search, setSearch] = useState("");
  const [reasonFilter, setReasonFilter] = useState("All reasons");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [sortOrder, setSortOrder] = useState("highest");

  const investigatingAlerts = alerts.filter((alert) => alert.status === "investigating");
  const totalExposure = investigatingAlerts.reduce((total, alert) => total + alert.amount, 0);
  const resolvedImpact = alerts
    .filter((alert) => alert.status === "resolved")
    .reduce((total, alert) => total + alert.amount, 0);
  const largestAlert = investigatingAlerts.reduce<WasteAlert | null>(
    (largest, alert) => !largest || alert.amount > largest.amount ? alert : largest,
    null,
  );
  const visibleAlerts = alerts
    .filter((alert) => {
      const searchableDetails = `${alert.item} ${alert.detail} ${alert.reason}`.toLowerCase();
      const matchesSearch = searchableDetails.includes(search.toLowerCase());
      const matchesReason = reasonFilter === "All reasons" || alert.reason === reasonFilter;
      const matchesStatus = statusFilter === "All statuses" || alert.status === statusFilter;
      return matchesSearch && matchesReason && matchesStatus;
    })
    .sort((left, right) => sortOrder === "highest" ? right.amount - left.amount : left.amount - right.amount);

  const updateStatus = (item: string, status: AlertStatus) => {
    saveAlertStatus(item, status);
  };

  return (
    <>
      <section className="module-stat-grid" aria-label="Waste exposure summary">
        <article className="stock-stat stock-stat-alert"><span className="stock-stat-label">Estimated exposure</span><strong>{money(totalExposure)}</strong><span className="stock-stat-note">Investigating alerts only</span></article>
        <article className="stock-stat"><span className="stock-stat-label">Investigating</span><strong>{investigatingAlerts.length}</strong><span className="stock-stat-note">Alerts requiring follow-up</span></article>
        <article className="stock-stat"><span className="stock-stat-label">Resolved impact</span><strong>{money(resolvedImpact)}</strong><span className="stock-stat-note">Resolved exposure</span></article>
        <article className="stock-stat"><span className="stock-stat-label">Dismissed</span><strong>{alerts.filter((alert) => alert.status === "dismissed").length}</strong><span className="stock-stat-note">Excluded from exposure</span></article>
      </section>

      <section className="panel waste-insights-panel" aria-labelledby="waste-insights-title">
        <div className="panel-heading"><div><h2 id="waste-insights-title">Exposure insights</h2><p>Estimated financial impact from current alerts</p></div></div>
        <div className="waste-insight-content">
          <div className="waste-insight-callout">
            <span className="insight-kicker">LARGEST CURRENT EXPOSURE</span>
            {largestAlert ? (
              <>
                <strong>{largestAlert.item}</strong>
                <p>{money(largestAlert.amount)} at risk · {totalExposure ? Math.round(largestAlert.amount / totalExposure * 100) : 0}% of investigating exposure.</p>
              </>
            ) : (
              <>
                <strong>No alerts under investigation</strong>
                <p>New and resolved alerts are excluded from current exposure.</p>
              </>
            )}
          </div>
          <div className="waste-exposure-breakdown" aria-label="Exposure share by investigating alert">
            {[...investigatingAlerts].sort((left, right) => right.amount - left.amount).map((alert) => {
              const share = totalExposure ? alert.amount / totalExposure * 100 : 0;
              return (
                <div className="waste-exposure-row" key={alert.item}>
                  <div><strong>{alert.item}</strong><span>{money(alert.amount)} · {share.toFixed(1)}%</span></div>
                  <span className="waste-exposure-track" aria-hidden="true"><i style={{ width: `${share}%` }} /></span>
                </div>
              );
            })}
            {investigatingAlerts.length === 0 && <p className="waste-empty">No active exposure to break down.</p>}
          </div>
        </div>
      </section>

      <section id="waste-log" className="panel waste-log-panel" aria-labelledby="waste-log-title">
        <div className="panel-heading"><div><h2 id="waste-log-title">Alert log</h2><p>Review alert details and track status</p></div><span className="waste-alert-count">{visibleAlerts.length} of {alerts.length}</span></div>
        <div className="waste-toolbar">
          <label className="waste-search">
            <span className="visually-hidden">Search alerts</span>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
            <input value={search} onChange={(event) => setSearch(event.currentTarget.value)} placeholder="Search alerts or details" />
          </label>
          <label className="waste-filter"><span>Reason</span><select value={reasonFilter} onChange={(event) => setReasonFilter(event.currentTarget.value)}><option>All reasons</option>{Array.from(new Set(alerts.map((alert) => alert.reason))).map((reason) => <option key={reason}>{reason}</option>)}</select></label>
          <label className="waste-filter"><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.currentTarget.value)}><option>All statuses</option>{alertStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label>
          <label className="waste-filter"><span>Sort by loss</span><select value={sortOrder} onChange={(event) => setSortOrder(event.currentTarget.value)}><option value="highest">Highest first</option><option value="lowest">Lowest first</option></select></label>
        </div>
        <div className="waste-record-list">
          {visibleAlerts.map((alert) => {
            const share = alert.status === "investigating" && totalExposure ? alert.amount / totalExposure * 100 : 0;
            return (
              <article className="waste-record" key={alert.item}>
                <span className={`waste-indicator waste-${alert.tone}`}><WorkspaceIcon name="waste" /></span>
                <div className="waste-record-detail">
                  <strong>{alert.item}</strong>
                  <span>{alert.detail}</span>
                  <small>{alert.reason}</small>
                  {alert.status === "investigating" && <span className="waste-record-track" aria-hidden="true"><i style={{ width: `${share}%` }} /></span>}
                </div>
                <div className="waste-record-value">
                  <strong>{money(alert.amount)}</strong>
                  <span>{alert.status === "investigating" ? `${share.toFixed(1)}% of at-risk` : alert.status === "resolved" ? "Resolved exposure" : "Excluded from exposure"}</span>
                  <label className="visually-hidden" htmlFor={`waste-status-${alert.item}`}>Status for {alert.item}</label>
                  <select id={`waste-status-${alert.item}`} className={`waste-status-select waste-status-${alert.status}`} value={alert.status} onChange={(event) => {
                    if (isAlertStatus(event.currentTarget.value)) updateStatus(alert.item, event.currentTarget.value);
                  }}>
                    {alertStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                  </select>
                </div>
              </article>
            );
          })}
          {visibleAlerts.length === 0 && <p className="waste-empty">No current alerts match this search.</p>}
        </div>
        <div className="waste-total"><span>Estimated loss at risk <small>· investigating only</small></span><strong>{money(totalExposure)}</strong></div>
      </section>
    </>
  );
}
