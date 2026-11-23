import { recordInventoryMutation } from "@/lib/inventory-db";
import { getAuthenticatedUserId, unauthorizedApiResponse } from "@/lib/auth";

type MutationBody = {
  type?: unknown;
  quantity?: unknown;
  unitCost?: unknown;
  supplier?: unknown;
  invoice?: unknown;
  reason?: unknown;
  note?: unknown;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export async function PATCH(request: Request, context: RouteContext<"/api/inventory/[id]">) {
  if (!await getAuthenticatedUserId()) return unauthorizedApiResponse();
  const { id } = await context.params;
  let body: MutationBody;
  try {
    body = await request.json() as MutationBody;
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!isFiniteNumber(body.quantity) || body.quantity === 0) {
    return Response.json({ error: "Quantity must be a non-zero number." }, { status: 400 });
  }

  if (body.type === "purchase") {
    if (body.quantity < 0 || !isFiniteNumber(body.unitCost) || body.unitCost < 0 || typeof body.supplier !== "string" || !body.supplier.trim()) {
      return Response.json({ error: "Purchases need a positive quantity, valid unit cost, and supplier." }, { status: 400 });
    }
    if (typeof body.invoice === "string" && body.invoice.length > 120) {
      return Response.json({ error: "Invoice reference must be 120 characters or fewer." }, { status: 400 });
    }
  } else if (body.type === "adjustment") {
    if (typeof body.reason !== "string" || !body.reason.trim() || (body.note !== undefined && typeof body.note !== "string")) {
      return Response.json({ error: "Stock adjustments need a reason." }, { status: 400 });
    }
  } else {
    return Response.json({ error: "Choose a valid inventory transaction type." }, { status: 400 });
  }

  try {
    const ingredient = recordInventoryMutation(id, body as Parameters<typeof recordInventoryMutation>[1]);
    return Response.json({ ingredient });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update inventory.";
    const status = message === "Ingredient not found." ? 404 : message.includes("below zero") ? 409 : 400;
    return Response.json({ error: message }, { status });
  }
}