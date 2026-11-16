export type Expense = {
  id: string;
  date: string;
  vendor: string;
  category: string;
  amount: number;
  paymentMethod: string;
  reference: string;
  notes: string;
};

export type ExpenseInput = Omit<Expense, "id">;

export const expenseCategories = [
  "Food & beverage",
  "Payroll",
  "Utilities",
  "Rent",
  "Supplies",
  "Repairs & maintenance",
  "Marketing",
  "Insurance",
  "Other",
];

export const paymentMethods = ["Credit card", "Debit card", "Bank transfer", "Cash", "Check", "Other"];

export const demoExpenses: ExpenseInput[] = [
  { date: "2026-11-10", vendor: "Sysco Foods", category: "Food & beverage", amount: 684.2, paymentMethod: "Credit card", reference: "SY-28542", notes: "Produce and pantry delivery" },
  { date: "2026-11-10", vendor: "Citywide Utilities", category: "Utilities", amount: 312.8, paymentMethod: "Bank transfer", reference: "CW-11026", notes: "Monthly service charge" },
  { date: "2026-11-09", vendor: "Greenleaf Produce", category: "Food & beverage", amount: 248.6, paymentMethod: "Credit card", reference: "GR-7492", notes: "Daily produce delivery" },
];