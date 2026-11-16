"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { expenseCategories, paymentMethods, type ExpenseInput } from "@/lib/expenses";

const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = (date = ""): ExpenseInput => ({ date, vendor: "", category: "Food & beverage", amount: 0, paymentMethod: "Credit card", reference: "", notes: "" });

export default function AddExpenseDialog() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<ExpenseInput>(() => emptyForm());
  const [requestError, setRequestError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving) setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSaving]);

  function openDialog() {
    setForm(emptyForm(today()));
    setRequestError("");
    setIsOpen(true);
  }

  async function submitExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setRequestError("");
    try {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not save expense.");
      setIsOpen(false);
      router.refresh();
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Could not save expense.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <button className="button button-primary" type="button" onClick={openDialog}><span className="plus">+</span> Add expense</button>
      {isOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSaving) setIsOpen(false); }}>
        <section className="inventory-modal expense-modal" role="dialog" aria-modal="true" aria-labelledby="overview-expense-modal-title">
          <div className="modal-heading">
            <div><p className="modal-eyebrow">FINANCIAL CONTROL</p><h2 id="overview-expense-modal-title">Add expense</h2><p className="modal-description">Keep the ledger up to date with accurate transaction details.</p></div>
            <button className="modal-close" type="button" disabled={isSaving} onClick={() => setIsOpen(false)} aria-label="Close dialog">
              <svg aria-hidden="true" className="expense-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="m18 6-12 12M6 6l12 12" /></svg>
            </button>
          </div>
          <form onSubmit={submitExpense}>
            <label className="form-field"><span>Date</span><input autoFocus type="date" required value={form.date} onChange={(event) => setForm({ ...form, date: event.currentTarget.value })} /></label>
            <label className="form-field"><span>Vendor</span><input required maxLength={120} value={form.vendor} onChange={(event) => setForm({ ...form, vendor: event.currentTarget.value })} placeholder="e.g. Greenleaf Produce" /></label>
            <label className="form-field"><span>Category</span><select value={form.category} onChange={(event) => setForm({ ...form, category: event.currentTarget.value })}>{expenseCategories.map((category) => <option key={category}>{category}</option>)}</select></label>
            <label className="form-field"><span>Amount (USD)</span><input type="number" min="0.01" step="0.01" required value={form.amount || ""} onChange={(event) => setForm({ ...form, amount: Number(event.currentTarget.value) })} placeholder="0.00" /></label>
            <label className="form-field"><span>Payment method</span><select value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.currentTarget.value })}>{paymentMethods.map((method) => <option key={method}>{method}</option>)}</select></label>
            <label className="form-field"><span>Invoice / reference</span><input maxLength={120} value={form.reference} onChange={(event) => setForm({ ...form, reference: event.currentTarget.value })} placeholder="Optional" /></label>
            <label className="form-field form-span-two"><span>Notes</span><textarea maxLength={500} rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.currentTarget.value })} placeholder="Add details for your records" /></label>
            {requestError && <p className="form-error form-span-two" role="alert">{requestError}</p>}
            <div className="modal-actions form-span-two"><button className="button button-secondary" type="button" disabled={isSaving} onClick={() => setIsOpen(false)}>Cancel</button><button className="button button-primary" type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Add expense"}</button></div>
          </form>
        </section>
      </div>}
    </>
  );
}