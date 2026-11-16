import "server-only";

import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { database } from "@/lib/database";
import { demoInventory, type Ingredient, type PurchaseEntry } from "@/lib/inventory";

type IngredientInput = Omit<Ingredient, "id" | "purchases">;

type InventoryMutation =
  | { type: "purchase"; quantity: number; unitCost: number; supplier: string; invoice: string }
  | { type: "adjustment"; quantity: number; reason: string; note: string };

type IngredientRow = Omit<Ingredient, "purchases">;

type PurchaseRow = PurchaseEntry & { ingredient_id: string };

database.exec(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE
    );

    CREATE TABLE IF NOT EXISTS ingredients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      stock REAL NOT NULL CHECK (stock >= 0),
      unit TEXT NOT NULL,
      par REAL NOT NULL CHECK (par > 0),
      unit_cost REAL NOT NULL CHECK (unit_cost >= 0),
      supplier_id TEXT NOT NULL REFERENCES suppliers(id),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS inventory_transactions (
      id TEXT PRIMARY KEY,
      ingredient_id TEXT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      supplier TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      unit_cost REAL NOT NULL CHECK (unit_cost >= 0),
      total REAL NOT NULL CHECK (total >= 0),
      invoice TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('purchase', 'adjustment')),
      note TEXT
    );

    CREATE INDEX IF NOT EXISTS inventory_transactions_ingredient_date
      ON inventory_transactions (ingredient_id, date DESC);
`);

const ingredientCount = database.prepare("SELECT COUNT(*) AS count FROM ingredients").get() as { count: number };
  if (ingredientCount.count === 0) {
    const seed = database.transaction(() => {
      for (const ingredient of demoInventory) {
        ensureSupplier(database, ingredient.supplier);
        database.prepare(`
          INSERT INTO ingredients (id, name, category, stock, unit, par, unit_cost, supplier_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, (SELECT id FROM suppliers WHERE name = ? COLLATE NOCASE))
        `).run(ingredient.id, ingredient.name, ingredient.category, ingredient.stock, ingredient.unit, ingredient.par, ingredient.unitCost, ingredient.supplier);

        for (const purchase of ingredient.purchases) insertTransaction(database, ingredient.id, purchase);
      }
    });
    seed();
  }

function ensureSupplier(instance: Database.Database, name: string) {
  instance.prepare("INSERT INTO suppliers (id, name) VALUES (?, ?) ON CONFLICT(name) DO NOTHING").run(randomUUID(), name.trim());
  return instance.prepare("SELECT id FROM suppliers WHERE name = ? COLLATE NOCASE").get(name.trim()) as { id: string };
}

function insertTransaction(instance: Database.Database, ingredientId: string, entry: PurchaseEntry) {
  instance.prepare(`
    INSERT INTO inventory_transactions
      (id, ingredient_id, date, supplier, quantity, unit, unit_cost, total, invoice, type, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(entry.id, ingredientId, entry.date, entry.supplier, entry.quantity, entry.unit, entry.unitCost, entry.total, entry.invoice, entry.type, entry.note ?? null);
}

const ingredientSelect = `
  SELECT ingredients.id, ingredients.name, ingredients.category, ingredients.stock,
    ingredients.unit, ingredients.par, ingredients.unit_cost AS unitCost,
    suppliers.name AS supplier
  FROM ingredients
  JOIN suppliers ON suppliers.id = ingredients.supplier_id
`;

function getIngredient(id: string): Ingredient | undefined {
  const row = database.prepare(`${ingredientSelect} WHERE ingredients.id = ?`).get(id) as IngredientRow | undefined;
  if (!row) return undefined;
  const purchases = database.prepare(`
    SELECT id, date, supplier, quantity, unit, unit_cost AS unitCost, total, invoice, type, note
    FROM inventory_transactions
    WHERE ingredient_id = ?
    ORDER BY date DESC, rowid DESC
  `).all(id) as PurchaseEntry[];
  return { ...row, purchases };
}

export function listIngredients(): Ingredient[] {
  const rows = database.prepare(`${ingredientSelect} ORDER BY ingredients.name COLLATE NOCASE`).all() as IngredientRow[];
  const transactions = database.prepare(`
    SELECT id, ingredient_id, date, supplier, quantity, unit, unit_cost AS unitCost, total, invoice, type, note
    FROM inventory_transactions
    ORDER BY date DESC, rowid DESC
  `).all() as PurchaseRow[];
  const purchasesByIngredient = new Map<string, PurchaseEntry[]>();
  for (const transaction of transactions) {
    const { ingredient_id: ingredientId, ...purchase } = transaction;
    const purchases = purchasesByIngredient.get(ingredientId) ?? [];
    purchases.push(purchase);
    purchasesByIngredient.set(ingredientId, purchases);
  }
  return rows.map((row) => ({ ...row, purchases: purchasesByIngredient.get(row.id) ?? [] }));
}

export function createIngredient(input: IngredientInput): Ingredient {
  const id = `ing-${randomUUID()}`;
  const create = database.transaction(() => {
    const supplier = ensureSupplier(database, input.supplier);
    database.prepare(`
      INSERT INTO ingredients (id, name, category, stock, unit, par, unit_cost, supplier_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, input.name.trim(), input.category, input.stock, input.unit, input.par, input.unitCost, supplier.id);
  });
  create();
  return getIngredient(id) as Ingredient;
}

export function recordInventoryMutation(ingredientId: string, mutation: InventoryMutation): Ingredient {
  const update = database.transaction(() => {
    const ingredient = database.prepare(`${ingredientSelect} WHERE ingredients.id = ?`).get(ingredientId) as IngredientRow | undefined;
    if (!ingredient) throw new Error("Ingredient not found.");

    let entry: PurchaseEntry;
    if (mutation.type === "purchase") {
      if (mutation.quantity <= 0) throw new Error("Purchase quantity must be greater than zero.");
      if (mutation.unitCost < 0) throw new Error("Unit cost cannot be negative.");
      const supplier = ensureSupplier(database, mutation.supplier);
      entry = {
        id: `purchase-${randomUUID()}`,
        date: new Date().toISOString().slice(0, 10),
        supplier: mutation.supplier.trim(),
        quantity: mutation.quantity,
        unit: ingredient.unit,
        unitCost: mutation.unitCost,
        total: mutation.quantity * mutation.unitCost,
        invoice: mutation.invoice.trim() || "No invoice",
        type: "purchase",
      };
      database.prepare(`
        UPDATE ingredients
        SET stock = stock + ?, unit_cost = ?, supplier_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(mutation.quantity, mutation.unitCost, supplier.id, ingredientId);
    } else {
      if (mutation.quantity === 0) throw new Error("Adjustment must change the stock quantity.");
      if (ingredient.stock + mutation.quantity < 0) throw new Error("Adjustment cannot reduce stock below zero.");
      entry = {
        id: `adjustment-${randomUUID()}`,
        date: new Date().toISOString().slice(0, 10),
        supplier: "Stock adjustment",
        quantity: mutation.quantity,
        unit: ingredient.unit,
        unitCost: ingredient.unitCost,
        total: Math.abs(mutation.quantity) * ingredient.unitCost,
        invoice: "Manual adjustment",
        type: "adjustment",
        note: mutation.note.trim() || mutation.reason,
      };
      database.prepare("UPDATE ingredients SET stock = stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(mutation.quantity, ingredientId);
    }

    insertTransaction(database, ingredientId, entry);
  });
  update();
  const ingredient = getIngredient(ingredientId);
  if (!ingredient) throw new Error("Ingredient not found.");
  return ingredient;
}