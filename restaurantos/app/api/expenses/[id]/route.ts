import { deleteExpense, updateExpense } from "@/lib/expenses-db";
import { validateExpense } from "@/app/api/expenses/route";
import type { ExpenseInput } from "@/lib/expenses";

export async function PUT(request: Request, context: RouteContext<"/api/expenses/[id]">) {
  const { id } = await context.params;
  let body: Partial<Record<keyof ExpenseInput, unknown>>;
  try {
    body = await request.json() as Partial<Record<keyof ExpenseInput, unknown>>;
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const validation = validateExpense(body);
  if (!validation.input) return Response.json({ error: validation.error }, { status: 400 });
  try {
    const expense = updateExpense(id, validation.input);
    return expense ? Response.json({ expense }) : Response.json({ error: "Expense not found." }, { status: 404 });
  } catch {
    return Response.json({ error: "Could not update expense." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext<"/api/expenses/[id]">) {
  const { id } = await context.params;
  try {
    return deleteExpense(id)
      ? new Response(null, { status: 204 })
      : Response.json({ error: "Expense not found." }, { status: 404 });
  } catch {
    return Response.json({ error: "Could not delete expense." }, { status: 500 });
  }
}