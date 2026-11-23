import "server-only";

import { randomUUID } from "node:crypto";
import { database } from "@/lib/database";
import type {
  PriceHistoryEntry,
  PurchaseOrder,
  PurchaseOrderApproval,
  PurchaseOrderInput,
  PurchaseOrderLine,
  PurchaseOrderStatus,
  Supplier,
  SupplierInput,
} from "@/lib/purchasing";

type SupplierRow = Omit<Supplier, "orderCount" | "lastOrderDate"> & {
  orderCount?: number;
  lastOrderDate?: string | null;
};
type PurchaseOrderRow = Omit<PurchaseOrder, "items" | "approvals">;
type ApprovalRow = PurchaseOrderApproval & { order_id: string };
type PurchaseOrderLineRow = PurchaseOrderLine & { order_id: string };

database.exec(`
  CREATE TABLE IF NOT EXISTS purchasing_suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    contact_name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    payment_terms TEXT NOT NULL DEFAULT 'Net 30',
    lead_time_days INTEGER NOT NULL DEFAULT 0 CHECK (lead_time_days >= 0),
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS purchase_orders (
    id TEXT PRIMARY KEY,
    order_number TEXT NOT NULL UNIQUE,
    supplier_id TEXT NOT NULL REFERENCES purchasing_suppliers(id) ON DELETE RESTRICT,
    status TEXT NOT NULL CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'partially_received', 'received')),
    order_date TEXT NOT NULL,
    needed_by TEXT,
    notes TEXT NOT NULL DEFAULT '',
    requested_by TEXT NOT NULL,
    approved_by TEXT,
    approved_at TEXT,
    rejection_reason TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS purchase_order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    quantity REAL NOT NULL CHECK (quantity > 0),
    received_quantity REAL NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
    unit TEXT NOT NULL,
    unit_price REAL NOT NULL CHECK (unit_price >= 0),
    line_total REAL NOT NULL CHECK (line_total >= 0),
    CHECK (received_quantity <= quantity)
  );

  CREATE TABLE IF NOT EXISTS purchase_order_approvals (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    decision TEXT NOT NULL CHECK (decision IN ('submitted', 'approved', 'rejected')),
    actor TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS purchase_receipts (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    received_at TEXT NOT NULL,
    received_by TEXT NOT NULL,
    reference TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS purchase_receipt_items (
    id TEXT PRIMARY KEY,
    receipt_id TEXT NOT NULL REFERENCES purchase_receipts(id) ON DELETE CASCADE,
    order_item_id TEXT NOT NULL REFERENCES purchase_order_items(id) ON DELETE CASCADE,
    quantity REAL NOT NULL CHECK (quantity > 0)
  );

  CREATE INDEX IF NOT EXISTS purchase_orders_supplier_date
    ON purchase_orders (supplier_id, order_date DESC);
  CREATE INDEX IF NOT EXISTS purchase_order_items_name
    ON purchase_order_items (item_name COLLATE NOCASE);
  CREATE INDEX IF NOT EXISTS purchase_order_approvals_order
    ON purchase_order_approvals (order_id, created_at DESC);
`);

function seedPurchasingData() {
  const seed = database.transaction(() => {
    const suppliers = [
      ["supplier-greenleaf", "Greenleaf Produce", "Purchasing desk", "", "", "Net 15", 1, "Local seasonal produce"],
      ["supplier-sysco", "Sysco Foods", "Purchasing desk", "", "", "Net 30", 2, "Broadline foodservice supplier"],
      ["supplier-harbor", "Harbor Seafood Co.", "Purchasing desk", "", "", "Net 15", 1, "Fresh and frozen seafood"],
      ["supplier-dairy", "Dairy Direct", "Purchasing desk", "", "", "Net 30", 2, "Dairy and refrigerated goods"],
      ["supplier-local", "Local Market", "Purchasing desk", "", "", "Due on receipt", 0, "Local specialty items"],
    ] as const;
    const insertSupplier = database.prepare(`
      INSERT INTO purchasing_suppliers
        (id, name, contact_name, email, phone, payment_terms, lead_time_days, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const supplier of suppliers) insertSupplier.run(...supplier);

    const insertOrder = database.prepare(`
      INSERT INTO purchase_orders
        (id, order_number, supplier_id, status, order_date, needed_by, notes, requested_by, approved_by, approved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Jordan Miller', ?, ?)
    `);
    const insertItem = database.prepare(`
      INSERT INTO purchase_order_items
        (id, order_id, item_name, quantity, received_quantity, unit, unit_price, line_total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertApproval = database.prepare(`
      INSERT INTO purchase_order_approvals (id, order_id, decision, actor, note, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertOrder.run("po-demo-0042", "PO-2026-0042", "supplier-greenleaf", "approved", "2026-11-14", "2026-11-16", "Weekly produce replenishment", "Jordan Miller", "2026-11-14 10:15:00");
    insertItem.run("poi-demo-0042-1", "po-demo-0042", "Heirloom tomatoes", 10, 0, "kg", 2.95, 29.5);
    insertItem.run("poi-demo-0042-2", "po-demo-0042", "Baby arugula", 5, 0, "kg", 5.2, 26);
    insertApproval.run("poa-demo-0042-1", "po-demo-0042", "submitted", "Jordan Miller", "", "2026-11-14 09:45:00");
    insertApproval.run("poa-demo-0042-2", "po-demo-0042", "approved", "Jordan Miller", "Approved for the weekly delivery.", "2026-11-14 10:15:00");

    insertOrder.run("po-demo-0041", "PO-2026-0041", "supplier-harbor", "partially_received", "2026-11-13", "2026-11-17", "Seafood delivery", "Jordan Miller", "2026-11-13 11:10:00");
    insertItem.run("poi-demo-0041-1", "po-demo-0041", "Atlantic salmon", 8, 3, "kg", 18.75, 150);
    insertItem.run("poi-demo-0041-2", "po-demo-0041", "Sea scallops", 4, 0, "kg", 22.5, 90);
    insertApproval.run("poa-demo-0041-1", "po-demo-0041", "submitted", "Jordan Miller", "", "2026-11-13 10:55:00");
    insertApproval.run("poa-demo-0041-2", "po-demo-0041", "approved", "Jordan Miller", "", "2026-11-13 11:10:00");
    database.prepare(`
      INSERT INTO purchase_receipts (id, order_id, received_at, received_by, reference, note)
      VALUES ('receipt-demo-0041', 'po-demo-0041', '2026-11-14', 'Jordan Miller', 'HS-11904', 'First partial delivery')
    `).run();
    database.prepare(`
      INSERT INTO purchase_receipt_items (id, receipt_id, order_item_id, quantity)
      VALUES ('receipt-demo-0041-item', 'receipt-demo-0041', 'poi-demo-0041-1', 3)
    `).run();

    insertOrder.run("po-demo-0040", "PO-2026-0040", "supplier-sysco", "pending_approval", "2026-11-12", "2026-11-18", "Pantry restock", null, null);
    insertItem.run("poi-demo-0040-1", "po-demo-0040", "Arborio rice", 12, 0, "kg", 3.35, 40.2);
    insertItem.run("poi-demo-0040-2", "po-demo-0040", "Extra virgin olive oil", 4, 0, "L", 12.95, 51.8);
    insertApproval.run("poa-demo-0040-1", "po-demo-0040", "submitted", "Jordan Miller", "", "2026-11-12 15:20:00");
  });
  seed();
}

const supplierCount = database.prepare("SELECT COUNT(*) AS count FROM purchasing_suppliers").get() as { count: number };
if (supplierCount.count === 0) seedPurchasingData();

const supplierSelect = `
  SELECT s.id, s.name, s.contact_name AS contactName, s.email, s.phone,
    s.payment_terms AS paymentTerms, s.lead_time_days AS leadTimeDays,
    s.notes, s.status
`;

function findSupplier(id: string): Supplier | undefined {
  const row = database.prepare(`
    ${supplierSelect},
    (SELECT COUNT(*) FROM purchase_orders WHERE supplier_id = s.id) AS orderCount,
    (SELECT MAX(order_date) FROM purchase_orders WHERE supplier_id = s.id) AS lastOrderDate
    FROM purchasing_suppliers s
    WHERE s.id = ?
  `).get(id) as SupplierRow | undefined;
  return row ? { ...row, orderCount: row.orderCount ?? 0, lastOrderDate: row.lastOrderDate ?? null } : undefined;
}

export function listSuppliers(): Supplier[] {
  return database.prepare(`
    ${supplierSelect},
    COUNT(po.id) AS orderCount,
    MAX(po.order_date) AS lastOrderDate
    FROM purchasing_suppliers s
    LEFT JOIN purchase_orders po ON po.supplier_id = s.id
    GROUP BY s.id
    ORDER BY s.status = 'active' DESC, s.name COLLATE NOCASE
  `).all() as Supplier[];
}

export function createSupplier(input: SupplierInput): Supplier {
  const id = `supplier-${randomUUID()}`;
  database.prepare(`
    INSERT INTO purchasing_suppliers
      (id, name, contact_name, email, phone, payment_terms, lead_time_days, notes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, input.name.trim(), input.contactName.trim(), input.email.trim(), input.phone.trim(), input.paymentTerms.trim(), input.leadTimeDays, input.notes.trim(), input.status);
  const supplier = findSupplier(id);
  if (!supplier) throw new Error("Supplier was created but could not be loaded.");
  return supplier;
}

export function updateSupplier(id: string, input: SupplierInput): Supplier | undefined {
  const result = database.prepare(`
    UPDATE purchasing_suppliers
    SET name = ?, contact_name = ?, email = ?, phone = ?, payment_terms = ?,
      lead_time_days = ?, notes = ?, status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(input.name.trim(), input.contactName.trim(), input.email.trim(), input.phone.trim(), input.paymentTerms.trim(), input.leadTimeDays, input.notes.trim(), input.status, id);
  if (!result.changes) return undefined;
  const supplier = findSupplier(id);
  return supplier ? { ...supplier, ...input, orderCount: supplier.orderCount, lastOrderDate: supplier.lastOrderDate } : undefined;
}

function getPurchaseOrder(id: string): PurchaseOrder | undefined {
  const order = database.prepare(`
    SELECT po.id, po.order_number AS orderNumber, po.supplier_id AS supplierId,
      s.name AS supplierName, po.status, po.order_date AS orderDate, po.needed_by AS neededBy,
      po.notes, po.requested_by AS requestedBy, po.approved_by AS approvedBy,
      po.approved_at AS approvedAt, po.rejection_reason AS rejectionReason,
      COALESCE(SUM(poi.line_total), 0) AS total
    FROM purchase_orders po
    JOIN purchasing_suppliers s ON s.id = po.supplier_id
    LEFT JOIN purchase_order_items poi ON poi.order_id = po.id
    WHERE po.id = ?
    GROUP BY po.id
  `).get(id) as PurchaseOrderRow | undefined;
  if (!order) return undefined;
  const items = database.prepare(`
    SELECT id, item_name AS itemName, quantity, received_quantity AS receivedQuantity,
      unit, unit_price AS unitPrice, line_total AS lineTotal
    FROM purchase_order_items WHERE order_id = ? ORDER BY rowid
  `).all(id) as PurchaseOrderLine[];
  const approvals = database.prepare(`
    SELECT id, decision, actor, note, created_at AS createdAt
    FROM purchase_order_approvals WHERE order_id = ?
    ORDER BY created_at, rowid
  `).all(id) as PurchaseOrderApproval[];
  return { ...order, items, approvals };
}

export function listPurchaseOrders(): PurchaseOrder[] {
  const rows = database.prepare(`
    SELECT po.id, po.order_number AS orderNumber, po.supplier_id AS supplierId,
      s.name AS supplierName, po.status, po.order_date AS orderDate, po.needed_by AS neededBy,
      po.notes, po.requested_by AS requestedBy, po.approved_by AS approvedBy,
      po.approved_at AS approvedAt, po.rejection_reason AS rejectionReason,
      COALESCE(SUM(poi.line_total), 0) AS total
    FROM purchase_orders po
    JOIN purchasing_suppliers s ON s.id = po.supplier_id
    LEFT JOIN purchase_order_items poi ON poi.order_id = po.id
    GROUP BY po.id
    ORDER BY po.order_date DESC, po.created_at DESC
  `).all() as PurchaseOrderRow[];
  const itemRows = database.prepare(`
    SELECT id, order_id AS order_id, item_name AS itemName, quantity,
      received_quantity AS receivedQuantity, unit, unit_price AS unitPrice, line_total AS lineTotal
    FROM purchase_order_items ORDER BY rowid
  `).all() as PurchaseOrderLineRow[];
  const approvalRows = database.prepare(`
    SELECT id, order_id, decision, actor, note, created_at AS createdAt
    FROM purchase_order_approvals ORDER BY created_at, rowid
  `).all() as ApprovalRow[];
  const itemsByOrder = new Map<string, PurchaseOrderLine[]>();
  const approvalsByOrder = new Map<string, PurchaseOrderApproval[]>();
  for (const { order_id: orderId, ...item } of itemRows) {
    const items = itemsByOrder.get(orderId) ?? [];
    items.push(item);
    itemsByOrder.set(orderId, items);
  }
  for (const { order_id: orderId, ...approval } of approvalRows) {
    const approvals = approvalsByOrder.get(orderId) ?? [];
    approvals.push(approval);
    approvalsByOrder.set(orderId, approvals);
  }
  return rows.map((order) => ({
    ...order,
    items: itemsByOrder.get(order.id) ?? [],
    approvals: approvalsByOrder.get(order.id) ?? [],
  }));
}

export function createPurchaseOrder(input: PurchaseOrderInput, requestedBy = "Jordan Miller"): PurchaseOrder {
  const id = `po-${randomUUID()}`;
  const create = database.transaction(() => {
    const supplier = database.prepare("SELECT status FROM purchasing_suppliers WHERE id = ?").get(input.supplierId) as { status: string } | undefined;
    if (!supplier) throw new Error("Supplier not found.");
    if (supplier.status !== "active") throw new Error("Purchase orders can only be created for active suppliers.");

    const year = new Date().getUTCFullYear();
    const latest = database.prepare(`
      SELECT order_number AS orderNumber FROM purchase_orders
      WHERE order_number LIKE ?
      ORDER BY order_number DESC LIMIT 1
    `).get(`PO-${year}-%`) as { orderNumber: string } | undefined;
    const nextSequence = latest ? Number(latest.orderNumber.slice(-4)) + 1 : 1;
    const orderNumber = `PO-${year}-${String(nextSequence).padStart(4, "0")}`;
    database.prepare(`
      INSERT INTO purchase_orders (id, order_number, supplier_id, status, order_date, needed_by, notes, requested_by)
      VALUES (?, ?, ?, 'draft', ?, ?, ?, ?)
    `).run(id, orderNumber, input.supplierId, new Date().toISOString().slice(0, 10), input.neededBy || null, input.notes.trim(), requestedBy);
    const insertItem = database.prepare(`
      INSERT INTO purchase_order_items (id, order_id, item_name, quantity, unit, unit_price, line_total)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of input.items) {
      insertItem.run(randomUUID(), id, item.itemName.trim(), item.quantity, item.unit.trim(), item.unitPrice, item.quantity * item.unitPrice);
    }
  });
  create();
  const order = getPurchaseOrder(id);
  if (!order) throw new Error("Purchase order was created but could not be loaded.");
  return order;
}

type OrderDecision = "submit" | "approve" | "reject";

export function decidePurchaseOrder(id: string, action: OrderDecision, actor: string, note = ""): PurchaseOrder | undefined {
  const decide = database.transaction(() => {
    const order = database.prepare("SELECT status FROM purchase_orders WHERE id = ?").get(id) as { status: PurchaseOrderStatus } | undefined;
    if (!order) throw new Error("Purchase order not found.");
    const now = new Date().toISOString();
    if (action === "submit") {
      if (order.status !== "draft" && order.status !== "rejected") throw new Error("Only draft or rejected orders can be submitted.");
      database.prepare(`
        UPDATE purchase_orders SET status = 'pending_approval', rejection_reason = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(id);
      database.prepare(`
        INSERT INTO purchase_order_approvals (id, order_id, decision, actor, note)
        VALUES (?, ?, 'submitted', ?, ?)
      `).run(randomUUID(), id, actor, note);
      return;
    }
    if (order.status !== "pending_approval") throw new Error("Only orders awaiting approval can be approved or rejected.");
    if (action === "approve") {
      database.prepare(`
        UPDATE purchase_orders
        SET status = 'approved', approved_by = ?, approved_at = ?, rejection_reason = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(actor, now, id);
      database.prepare(`
        INSERT INTO purchase_order_approvals (id, order_id, decision, actor, note)
        VALUES (?, ?, 'approved', ?, ?)
      `).run(randomUUID(), id, actor, note);
      return;
    }
    database.prepare(`
      UPDATE purchase_orders
      SET status = 'rejected', approved_by = NULL, approved_at = NULL, rejection_reason = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(note || "No reason provided.", id);
    database.prepare(`
      INSERT INTO purchase_order_approvals (id, order_id, decision, actor, note)
      VALUES (?, ?, 'rejected', ?, ?)
    `).run(randomUUID(), id, actor, note);
  });
  decide();
  return getPurchaseOrder(id);
}

export type ReceiptInput = {
  lines: { orderItemId: string; quantity: number }[];
  receivedBy: string;
  reference: string;
  note: string;
};

export function receivePurchaseOrder(id: string, input: ReceiptInput): PurchaseOrder | undefined {
  const receive = database.transaction(() => {
    const order = database.prepare("SELECT status FROM purchase_orders WHERE id = ?").get(id) as { status: PurchaseOrderStatus } | undefined;
    if (!order) throw new Error("Purchase order not found.");
    if (order.status !== "approved" && order.status !== "partially_received") {
      throw new Error("Only approved orders can be received.");
    }
    const quantities = new Map<string, number>();
    for (const line of input.lines) {
      quantities.set(line.orderItemId, (quantities.get(line.orderItemId) ?? 0) + line.quantity);
    }
    if (quantities.size === 0) throw new Error("Enter a quantity to receive for at least one item.");
    const receiptId = `receipt-${randomUUID()}`;
    database.prepare(`
      INSERT INTO purchase_receipts (id, order_id, received_at, received_by, reference, note)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(receiptId, id, new Date().toISOString().slice(0, 10), input.receivedBy, input.reference.trim(), input.note.trim());
    const selectItem = database.prepare(`
      SELECT quantity, received_quantity AS receivedQuantity
      FROM purchase_order_items WHERE id = ? AND order_id = ?
    `);
    const updateItem = database.prepare(`
      UPDATE purchase_order_items SET received_quantity = received_quantity + ?
      WHERE id = ? AND order_id = ?
    `);
    const insertReceiptItem = database.prepare(`
      INSERT INTO purchase_receipt_items (id, receipt_id, order_item_id, quantity)
      VALUES (?, ?, ?, ?)
    `);
    for (const [itemId, quantity] of quantities) {
      if (quantity <= 0) throw new Error("Received quantities must be greater than zero.");
      const item = selectItem.get(itemId, id) as { quantity: number; receivedQuantity: number } | undefined;
      if (!item) throw new Error("A received item does not belong to this purchase order.");
      if (item.receivedQuantity + quantity > item.quantity) throw new Error("Received quantity cannot exceed the quantity ordered.");
      updateItem.run(quantity, itemId, id);
      insertReceiptItem.run(randomUUID(), receiptId, itemId, quantity);
    }
    const remaining = database.prepare(`
      SELECT COUNT(*) AS count FROM purchase_order_items WHERE order_id = ? AND received_quantity < quantity
    `).get(id) as { count: number };
    const status = remaining.count === 0 ? "received" : "partially_received";
    database.prepare("UPDATE purchase_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(status, id);
  });
  receive();
  return getPurchaseOrder(id);
}

export function listPriceHistory(): PriceHistoryEntry[] {
  return database.prepare(`
    SELECT poi.id, poi.item_name AS itemName, s.name AS supplierName,
      po.order_number AS orderNumber, po.order_date AS orderDate,
      poi.quantity, poi.unit, poi.unit_price AS unitPrice
    FROM purchase_order_items poi
    JOIN purchase_orders po ON po.id = poi.order_id
    JOIN purchasing_suppliers s ON s.id = po.supplier_id
    WHERE po.status IN ('approved', 'partially_received', 'received')
    ORDER BY po.order_date DESC, po.created_at DESC, poi.rowid DESC
  `).all() as PriceHistoryEntry[];
}
