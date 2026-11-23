import { updateSupplier } from "@/lib/purchasing-db";
import { getAuthenticatedUserId, unauthorizedApiResponse } from "@/lib/auth";
import { validateSupplier } from "@/lib/purchasing-validation";

export async function PATCH(request: Request, context: RouteContext<"/api/purchasing/suppliers/[id]">) {
  if (!await getAuthenticatedUserId()) return unauthorizedApiResponse();
  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Supplier details must be sent as an object." }, { status: 400 });
  }
  const validation = validateSupplier(body);
  if (!validation.input) return Response.json({ error: validation.error }, { status: 400 });
  try {
    const supplier = updateSupplier(id, validation.input);
    if (!supplier) return Response.json({ error: "Supplier not found." }, { status: 404 });
    return Response.json({ supplier });
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      return Response.json({ error: "A supplier with that name already exists." }, { status: 409 });
    }
    console.error("Could not update supplier.", error);
    return Response.json({ error: "Could not update supplier." }, { status: 500 });
  }
}
