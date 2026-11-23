export type SupplierStatus = "active" | "inactive";

export type Supplier = {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  paymentTerms: string;
  leadTimeDays: number;
  notes: string;
  status: SupplierStatus;
  orderCount: number;
  lastOrderDate: string | null;
};

export type SupplierInput = Omit<Supplier, "id" | "orderCount" | "lastOrderDate">;

export type PurchaseOrderStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "partially_received"
  | "received";

export type PurchaseOrderLine = {
  id: string;
  itemName: string;
  quantity: number;
  receivedQuantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
};

export type PurchaseOrderApproval = {
  id: string;
  decision: "submitted" | "approved" | "rejected";
  actor: string;
  note: string;
  createdAt: string;
};

export type PurchaseOrder = {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  status: PurchaseOrderStatus;
  orderDate: string;
  neededBy: string | null;
  notes: string;
  requestedBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  total: number;
  items: PurchaseOrderLine[];
  approvals: PurchaseOrderApproval[];
};

export type PurchaseOrderLineInput = Omit<PurchaseOrderLine, "id" | "receivedQuantity" | "lineTotal">;

export type PurchaseOrderInput = {
  supplierId: string;
  neededBy: string;
  notes: string;
  items: PurchaseOrderLineInput[];
};

export type PriceHistoryEntry = {
  id: string;
  itemName: string;
  supplierName: string;
  orderNumber: string;
  orderDate: string;
  quantity: number;
  unit: string;
  unitPrice: number;
};
