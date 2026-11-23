import type { PurchaseOrderInput, PurchaseOrderLineInput, SupplierInput, SupplierStatus } from "@/lib/purchasing";

type ValidationResult<T> = { input?: T; error?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export function validateSupplier(value: unknown): ValidationResult<SupplierInput> {
  if (!isRecord(value)) return { error: "Supplier details must be sent as an object." };
  if (typeof value.name !== "string" || !value.name.trim() || value.name.trim().length > 120) {
    return { error: "Supplier name is required and must be 120 characters or fewer." };
  }
  const fields: [keyof SupplierInput, number][] = [
    ["contactName", 120],
    ["email", 254],
    ["phone", 50],
    ["paymentTerms", 60],
    ["notes", 500],
  ];
  for (const [field, maxLength] of fields) {
    const fieldValue = value[field];
    if (fieldValue !== undefined && (typeof fieldValue !== "string" || fieldValue.length > maxLength)) {
      return { error: `${field} must be ${maxLength} characters or fewer.` };
    }
  }
  const email = typeof value.email === "string" ? value.email.trim() : "";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid supplier email address." };
  if (value.leadTimeDays !== undefined && (typeof value.leadTimeDays !== "number" || !Number.isInteger(value.leadTimeDays) || value.leadTimeDays < 0 || value.leadTimeDays > 365)) {
    return { error: "Lead time must be a whole number between 0 and 365 days." };
  }
  const status: SupplierStatus = value.status === undefined ? "active" : value.status as SupplierStatus;
  if (status !== "active" && status !== "inactive") return { error: "Choose an active or inactive supplier status." };
  return {
    input: {
      name: value.name.trim(),
      contactName: typeof value.contactName === "string" ? value.contactName.trim() : "",
      email,
      phone: typeof value.phone === "string" ? value.phone.trim() : "",
      paymentTerms: typeof value.paymentTerms === "string" && value.paymentTerms.trim() ? value.paymentTerms.trim() : "Net 30",
      leadTimeDays: typeof value.leadTimeDays === "number" ? value.leadTimeDays : 0,
      notes: typeof value.notes === "string" ? value.notes.trim() : "",
      status,
    },
  };
}

export function validatePurchaseOrder(value: unknown): ValidationResult<PurchaseOrderInput> {
  if (!isRecord(value)) return { error: "Purchase order details must be sent as an object." };
  if (typeof value.supplierId !== "string" || !value.supplierId.trim()) return { error: "Choose a supplier." };
  if (value.neededBy !== undefined && value.neededBy !== "" && (typeof value.neededBy !== "string" || !isValidDate(value.neededBy))) {
    return { error: "Enter a valid required delivery date." };
  }
  if (value.notes !== undefined && (typeof value.notes !== "string" || value.notes.length > 500)) {
    return { error: "Order notes must be 500 characters or fewer." };
  }
  if (!Array.isArray(value.items) || value.items.length === 0 || value.items.length > 50) {
    return { error: "Add between 1 and 50 purchase order items." };
  }
  const items: PurchaseOrderLineInput[] = [];
  for (const candidate of value.items) {
    if (!isRecord(candidate)) return { error: "Each order item must be an object." };
    if (typeof candidate.itemName !== "string" || !candidate.itemName.trim() || candidate.itemName.trim().length > 120) {
      return { error: "Each item needs a name of 120 characters or fewer." };
    }
    if (typeof candidate.quantity !== "number" || !Number.isFinite(candidate.quantity) || candidate.quantity <= 0 || candidate.quantity > 1_000_000) {
      return { error: "Item quantities must be greater than zero and no more than 1,000,000." };
    }
    if (typeof candidate.unit !== "string" || !candidate.unit.trim() || candidate.unit.trim().length > 24) {
      return { error: "Each item needs a unit of 24 characters or fewer." };
    }
    if (typeof candidate.unitPrice !== "number" || !Number.isFinite(candidate.unitPrice) || candidate.unitPrice < 0 || candidate.unitPrice > 1_000_000) {
      return { error: "Unit prices must be zero or more and no more than 1,000,000." };
    }
    items.push({ itemName: candidate.itemName.trim(), quantity: candidate.quantity, unit: candidate.unit.trim(), unitPrice: candidate.unitPrice });
  }
  return {
    input: {
      supplierId: value.supplierId.trim(),
      neededBy: typeof value.neededBy === "string" ? value.neededBy : "",
      notes: typeof value.notes === "string" ? value.notes.trim() : "",
      items,
    },
  };
}
