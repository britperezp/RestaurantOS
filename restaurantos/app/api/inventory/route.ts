import { inventoryCategories, inventoryUnits } from "@/lib/inventory";
import { createIngredient, listIngredients } from "@/lib/inventory-db";

type CreateIngredientBody = {
  name?: unknown;
  category?: unknown;
  stock?: unknown;
  unit?: unknown;
  par?: unknown;
  unitCost?: unknown;
  supplier?: unknown;
};

function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export async function GET() {
  try {
    return Response.json({ ingredients: listIngredients() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Could not load inventory." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: CreateIngredientBody;
  try {
    body = await request.json() as CreateIngredientBody;
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!isText(body.name) || body.name.trim().length > 120) {
    return Response.json({ error: "Ingredient name is required and must be 120 characters or fewer." }, { status: 400 });
  }
  if (typeof body.category !== "string" || !inventoryCategories.includes(body.category)) {
    return Response.json({ error: "Choose a valid ingredient category." }, { status: 400 });
  }
  if (!isFiniteNumber(body.stock) || body.stock < 0 || !isFiniteNumber(body.par) || body.par <= 0) {
    return Response.json({ error: "Stock must be zero or more and par level must be greater than zero." }, { status: 400 });
  }
  if (typeof body.unit !== "string" || !inventoryUnits.includes(body.unit)) {
    return Response.json({ error: "Choose a valid unit of measure." }, { status: 400 });
  }
  if (!isFiniteNumber(body.unitCost) || body.unitCost < 0 || !isText(body.supplier) || body.supplier.trim().length > 120) {
    return Response.json({ error: "A valid unit cost and supplier are required." }, { status: 400 });
  }

  try {
    const ingredient = createIngredient({
      name: body.name.trim(),
      category: body.category,
      stock: body.stock,
      unit: body.unit,
      par: body.par,
      unitCost: body.unitCost,
      supplier: body.supplier.trim(),
    });
    return Response.json({ ingredient }, { status: 201 });
  } catch {
    return Response.json({ error: "Could not save ingredient." }, { status: 500 });
  }
}