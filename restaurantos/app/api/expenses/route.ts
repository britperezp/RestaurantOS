import { createExpense, listExpenses } from "@/lib/expenses-db";
import { expenseCategories, paymentMethods, type ExpenseInput } from "@/lib/expenses";
import { getAuthenticatedUserId, unauthorizedApiResponse } from "@/lib/auth";

type ExpenseBody = Partial<Record<keyof ExpenseInput, unknown>>;

function validateExpense(body: ExpenseBody): { input?: ExpenseInput; error?: string } {
  if (typeof body.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.date) || Number.isNaN(Date.parse(`${body.date}T00:00:00Z`))) {
    return { error: "Enter a valid expense date." };
  }
  if (typeof body.vendor !== "string" || !body.vendor.trim() || body.vendor.trim().length > 120) {
    return { error: "Vendor is required and must be 120 characters or fewer." };
  }
  if (typeof body.category !== "string" || !expenseCategories.includes(body.category)) {
    return { error: "Choose a valid expense category." };
  }
  if (typeof body.amount !== "number" || !Number.isFinite(body.amount) || body.amount <= 0) {
    return { error: "Amount must be greater than zero." };
  }
  if (typeof body.paymentMethod !== "string" || !paymentMethods.includes(body.paymentMethod)) {
    return { error: "Choose a valid payment method." };
  }
  if (typeof body.reference !== "string" || body.reference.length > 120 || typeof body.notes !== "string" || body.notes.length > 500) {
    return { error: "Reference must be 120 characters and notes 500 characters or fewer." };
  }
  return {
    input: {
      date: body.date,
      vendor: body.vendor.trim(),
      category: body.category,
      amount: body.amount,
      paymentMethod: body.paymentMethod,
      reference: body.reference.trim(),
      notes: body.notes.trim(),
    },
  };
}

export async function GET(request: Request) {
  if (!await getAuthenticatedUserId()) return unauthorizedApiResponse();
  try {
    const url = new URL(request.url);
    const requestedLimit = Number(url.searchParams.get("limit") ?? 100);
    const limit = Number.isFinite(requestedLimit) ? requestedLimit : 100;
    return Response.json({ expenses: listExpenses(limit) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Could not load expenses." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!await getAuthenticatedUserId()) return unauthorizedApiResponse();
  let body: ExpenseBody;
  try {
    body = await request.json() as ExpenseBody;
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const validation = validateExpense(body);
  if (!validation.input) return Response.json({ error: validation.error }, { status: 400 });

  try {
    return Response.json({ expense: createExpense(validation.input) }, { status: 201 });
  } catch {
    return Response.json({ error: "Could not save expense." }, { status: 500 });
  }
}

export { validateExpense };