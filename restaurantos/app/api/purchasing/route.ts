import { connection } from "next/server";
import { getAuthenticatedUserId, unauthorizedApiResponse } from "@/lib/auth";
import { listPriceHistory, listPurchaseOrders, listSuppliers } from "@/lib/purchasing-db";

export async function GET() {
  if (!await getAuthenticatedUserId()) return unauthorizedApiResponse();
  await connection();
  try {
    return Response.json({
      suppliers: listSuppliers(),
      orders: listPurchaseOrders(),
      priceHistory: listPriceHistory(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not load purchasing data.", error);
    return Response.json({ error: "Could not load suppliers and purchasing data." }, { status: 500 });
  }
}
