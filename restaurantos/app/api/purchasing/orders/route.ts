import { connection } from "next/server";
import { getAuthenticatedUserId, unauthorizedApiResponse } from "@/lib/auth";
import { createPurchaseOrder, listPurchaseOrders } from "@/lib/purchasing-db";
import { validatePurchaseOrder } from "@/lib/purchasing-validation";

export async function GET() {
  if (!await getAuthenticatedUserId()) return unauthorizedApiResponse();
  await connection();
  try {
    return Response.json({ orders: listPurchaseOrders() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not load purchase orders.", error);
    return Response.json({ error: "Could not load purchase orders." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!await getAuthenticatedUserId()) return unauthorizedApiResponse();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const validation = validatePurchaseOrder(body);
  if (!validation.input) return Response.json({ error: validation.error }, { status: 400 });
  try {
    return Response.json({ order: createPurchaseOrder(validation.input) }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Supplier not found.") {
      return Response.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof Error && error.message.includes("active suppliers")) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    console.error("Could not create purchase order.", error);
    return Response.json({ error: "Could not create purchase order." }, { status: 500 });
  }
}
