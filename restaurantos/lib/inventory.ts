export type PurchaseEntry = {
  id: string;
  date: string;
  supplier: string;
  quantity: number;
  unit: string;
  unitCost: number;
  total: number;
  invoice: string;
  type: "purchase" | "adjustment";
  note?: string;
};

export type Ingredient = {
  id: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  par: number;
  unitCost: number;
  supplier: string;
  purchases: PurchaseEntry[];
};

export const inventorySuppliers = ["Greenleaf Produce", "Sysco Foods", "Harbor Seafood Co.", "Dairy Direct", "Local Market"];
export const inventoryCategories = ["Produce", "Dairy", "Seafood", "Meat", "Dry goods", "Beverages", "Other"];
export const inventoryUnits = ["kg", "g", "L", "mL", "each", "case", "bottle"];

export const demoInventory: Ingredient[] = [
  { id: "ing-avocado", name: "Avocados", category: "Produce", stock: 4, unit: "each", par: 12, unitCost: 0.85, supplier: "Greenleaf Produce", purchases: [{ id: "p-avocado", date: "2026-11-09", supplier: "Greenleaf Produce", quantity: 12, unit: "each", unitCost: 0.78, total: 9.36, invoice: "GR-7492", type: "purchase" }] },
  { id: "ing-cream", name: "Heavy cream", category: "Dairy", stock: 1.5, unit: "L", par: 6, unitCost: 4.2, supplier: "Dairy Direct", purchases: [{ id: "p-cream", date: "2026-11-08", supplier: "Dairy Direct", quantity: 4, unit: "L", unitCost: 4.1, total: 16.4, invoice: "DD-1038", type: "purchase" }] },
  { id: "ing-salmon", name: "Atlantic salmon", category: "Seafood", stock: 2.2, unit: "kg", par: 5, unitCost: 18.5, supplier: "Harbor Seafood Co.", purchases: [{ id: "p-salmon", date: "2026-11-08", supplier: "Harbor Seafood Co.", quantity: 5, unit: "kg", unitCost: 17.9, total: 89.5, invoice: "HS-11842", type: "purchase" }] },
  { id: "ing-rice", name: "Arborio rice", category: "Dry goods", stock: 8, unit: "kg", par: 4, unitCost: 3.4, supplier: "Sysco Foods", purchases: [{ id: "p-rice", date: "2026-11-07", supplier: "Sysco Foods", quantity: 10, unit: "kg", unitCost: 3.25, total: 32.5, invoice: "SY-28460", type: "purchase" }] },
  { id: "ing-olive-oil", name: "Extra virgin olive oil", category: "Dry goods", stock: 2.4, unit: "L", par: 3, unitCost: 12.8, supplier: "Sysco Foods", purchases: [{ id: "p-oil", date: "2026-11-06", supplier: "Sysco Foods", quantity: 3, unit: "L", unitCost: 12.2, total: 36.6, invoice: "SY-28391", type: "purchase" }] },
  { id: "ing-tomato", name: "Heirloom tomatoes", category: "Produce", stock: 9, unit: "kg", par: 5, unitCost: 2.9, supplier: "Greenleaf Produce", purchases: [{ id: "p-tomato", date: "2026-11-09", supplier: "Greenleaf Produce", quantity: 8, unit: "kg", unitCost: 2.75, total: 22, invoice: "GR-7492", type: "purchase" }] },
  { id: "ing-butter", name: "Cultured butter", category: "Dairy", stock: 3.2, unit: "kg", par: 3, unitCost: 6.2, supplier: "Dairy Direct", purchases: [{ id: "p-butter", date: "2026-11-08", supplier: "Dairy Direct", quantity: 4, unit: "kg", unitCost: 6, total: 24, invoice: "DD-1038", type: "purchase" }] },
  { id: "ing-parmesan", name: "Parmigiano Reggiano", category: "Dairy", stock: 1.1, unit: "kg", par: 2, unitCost: 14.6, supplier: "Dairy Direct", purchases: [{ id: "p-parmesan", date: "2026-11-08", supplier: "Dairy Direct", quantity: 2, unit: "kg", unitCost: 14.25, total: 28.5, invoice: "DD-1038", type: "purchase" }] },
  { id: "ing-stock", name: "Chicken stock", category: "Meat", stock: 6, unit: "L", par: 4, unitCost: 2.1, supplier: "Sysco Foods", purchases: [{ id: "p-stock", date: "2026-11-07", supplier: "Sysco Foods", quantity: 8, unit: "L", unitCost: 2, total: 16, invoice: "SY-28460", type: "purchase" }] },
  { id: "ing-coffee", name: "House espresso beans", category: "Beverages", stock: 2.5, unit: "kg", par: 1.5, unitCost: 16, supplier: "Local Market", purchases: [{ id: "p-coffee", date: "2026-11-06", supplier: "Local Market", quantity: 3, unit: "kg", unitCost: 15.5, total: 46.5, invoice: "LM-501", type: "purchase" }] },
  { id: "ing-lemons", name: "Meyer lemons", category: "Produce", stock: 2, unit: "each", par: 8, unitCost: 0.35, supplier: "Greenleaf Produce", purchases: [{ id: "p-lemons", date: "2026-11-09", supplier: "Greenleaf Produce", quantity: 12, unit: "each", unitCost: 0.32, total: 3.84, invoice: "GR-7492", type: "purchase" }] },
  { id: "ing-chicken", name: "Chicken breast", category: "Meat", stock: 0, unit: "kg", par: 4, unitCost: 8.9, supplier: "Sysco Foods", purchases: [{ id: "p-chicken", date: "2026-11-07", supplier: "Sysco Foods", quantity: 6, unit: "kg", unitCost: 8.5, total: 51, invoice: "SY-28460", type: "purchase" }] },
];