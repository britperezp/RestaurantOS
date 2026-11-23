import { decidePurchaseOrder, receivePurchaseOrder } from "@/lib/purchasing-db";
import type { ReceiptInput } from "@/lib/purchasing-db";
import { getAuthenticatedUserId, unauthorizedApiResponse } from "@/lib/auth";

type OrderActionBody = {
  action?: unknown;
  note?: unknown;
  reference?: unknown;
  lines?: unknown;
};

export async function PATCH(request: Request, context: RouteContext<"/api/purchasing/orders/[id]">) {
  const actor = await getAuthenticatedUserId();
  if (!actor) return unauthorizedApiResponse();
  const { id } = await context.params;
  let body: OrderActionBody;
  try {
    const value: unknown = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return Response.json({ error: "Purchase order action must be sent as an object." }, { status: 400 });
    }
    body = value as OrderActionBody;
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (body.action === "submit" || body.action === "approve" || body.action === "reject") {
    if (body.note !== undefined && (typeof body.note !== "string" || body.note.length > 500)) {
      return Response.json({ error: "Approval notes must be 500 characters or fewer." }, { status: 400 });
    }
    try {
      const order = decidePurchaseOrder(id, body.action, actor, typeof body.note === "string" ? body.note.trim() : "");
      if (!order) return Response.json({ error: "Purchase order not found." }, { status: 404 });
      return Response.json({ order });
    } catch (error) {
      if (error instanceof Error && error.message === "Purchase order not found.") {
        return Response.json({ error: error.message }, { status: 404 });
      }
      if (error instanceof Error && /Only .* orders/.test(error.message)) {
        return Response.json({ error: error.message }, { status: 409 });
      }
      console.error("Could not update purchase order approval.", error);
      return Response.json({ error: "Could not update purchase order approval." }, { status: 500 });
    }
  }

  if (body.action !== "receive") return Response.json({ error: "Choose a valid purchase order action." }, { status: 400 });
  if (typeof body.reference !== "string" || body.reference.length > 120 || (body.note !== undefined && (typeof body.note !== "string" || body.note.length > 500))) {
    return Response.json({ error: "Receipt reference must be 120 characters and notes 500 characters or fewer." }, { status: 400 });
  }
  if (!Array.isArray(body.lines) || body.lines.length === 0 || body.lines.length > 50) {
    return Response.json({ error: "Enter received quantities for at least one order item." }, { status: 400 });
  }
  const lines: ReceiptInput["lines"] = [];
  for (const candidate of body.lines) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      return Response.json({ error: "Each received quantity must be an object." }, { status: 400 });
    }
    const line = candidate as Record<string, unknown>;
    if (typeof line.orderItemId !== "string" || !line.orderItemId.trim() || typeof line.quantity !== "number" || !Number.isFinite(line.quantity) || line.quantity <= 0) {
      return Response.json({ error: "Received quantities must have a valid item and be greater than zero." }, { status: 400 });
    }
    lines.push({ orderItemId: line.orderItemId, quantity: line.quantity });
  }
  try {
    const order = receivePurchaseOrder(id, {
      lines,
      receivedBy: actor,
      reference: body.reference.trim(),
      note: typeof body.note === "string" ? body.note.trim() : "",
    });
    if (!order) return Response.json({ error: "Purchase order not found." }, { status: 404 });
    return Response.json({ order });
  } catch (error) {
    if (error instanceof Error && error.message === "Purchase order not found.") {
      return Response.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof Error && /Only approved|cannot be received|does not belong|cannot exceed|at least one item|must be greater/.test(error.message)) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    console.error("Could not receive purchase order.", error);
    return Response.json({ error: "Could not receive purchase order." }, { status: 500 });
  }
}
