import { connection } from "next/server";
import { getAuthenticatedUserId, unauthorizedApiResponse } from "@/lib/auth";
import { createSupplier, listSuppliers } from "@/lib/purchasing-db";
import { validateSupplier } from "@/lib/purchasing-validation";

async function readBody(request: Request): Promise<{ body?: unknown; error?: string }> {
  try {
    return { body: await request.json() };
  } catch {
    return { error: "Request body must be valid JSON." };
  }
}

export async function GET() {
  if (!await getAuthenticatedUserId()) return unauthorizedApiResponse();
  await connection();
  try {
    return Response.json({ suppliers: listSuppliers() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not load suppliers.", error);
    return Response.json({ error: "Could not load suppliers." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!await getAuthenticatedUserId()) return unauthorizedApiResponse();
  const parsed = await readBody(request);
  if (parsed.error) return Response.json({ error: parsed.error }, { status: 400 });
  const validation = validateSupplier(parsed.body);
  if (!validation.input) return Response.json({ error: validation.error }, { status: 400 });
  try {
    return Response.json({ supplier: createSupplier(validation.input) }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      return Response.json({ error: "A supplier with that name already exists." }, { status: 409 });
    }
    console.error("Could not create supplier.", error);
    return Response.json({ error: "Could not create supplier." }, { status: 500 });
  }
}
