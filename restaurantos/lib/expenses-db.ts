import "server-only";

import { randomUUID } from "node:crypto";
import { database } from "@/lib/database";
import { demoExpenses, type Expense, type ExpenseInput } from "@/lib/expenses";

type ExpenseRow = Omit<Expense, "paymentMethod"> & { payment_method: string };

database.exec(`
  CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    vendor TEXT NOT NULL,
    category TEXT NOT NULL,
    amount REAL NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL,
    reference TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS expenses_date ON expenses (date DESC, created_at DESC);
  CREATE INDEX IF NOT EXISTS expenses_category ON expenses (category);
`);

const expenseCount = database.prepare("SELECT COUNT(*) AS count FROM expenses").get() as { count: number };
if (expenseCount.count === 0) {
  const seedExpenses = database.transaction(() => {
    const insert = database.prepare(`
      INSERT INTO expenses (id, date, vendor, category, amount, payment_method, reference, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const expense of demoExpenses) {
      insert.run(`expense-${randomUUID()}`, expense.date, expense.vendor, expense.category, expense.amount, expense.paymentMethod, expense.reference, expense.notes);
    }
  });
  seedExpenses();
}

function fromRow(row: ExpenseRow): Expense {
  const { payment_method: paymentMethod, ...expense } = row;
  return { ...expense, paymentMethod };
}

function findExpense(id: string): Expense | undefined {
  const row = database.prepare(`
    SELECT id, date, vendor, category, amount, payment_method, reference, notes
    FROM expenses WHERE id = ?
  `).get(id) as ExpenseRow | undefined;
  return row ? fromRow(row) : undefined;
}

export function listExpenses(limit = 100): Expense[] {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 500);
  const rows = database.prepare(`
    SELECT id, date, vendor, category, amount, payment_method, reference, notes
    FROM expenses
    ORDER BY date DESC, created_at DESC, rowid DESC
    LIMIT ?
  `).all(safeLimit) as ExpenseRow[];
  return rows.map(fromRow);
}

export function createExpense(input: ExpenseInput): Expense {
  const id = `expense-${randomUUID()}`;
  database.prepare(`
    INSERT INTO expenses (id, date, vendor, category, amount, payment_method, reference, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, input.date, input.vendor, input.category, input.amount, input.paymentMethod, input.reference, input.notes);
  return findExpense(id) as Expense;
}

export function updateExpense(id: string, input: ExpenseInput): Expense | undefined {
  const result = database.prepare(`
    UPDATE expenses
    SET date = ?, vendor = ?, category = ?, amount = ?, payment_method = ?, reference = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(input.date, input.vendor, input.category, input.amount, input.paymentMethod, input.reference, input.notes, id);
  return result.changes ? findExpense(id) : undefined;
}

export function deleteExpense(id: string): boolean {
  return database.prepare("DELETE FROM expenses WHERE id = ?").run(id).changes > 0;
}