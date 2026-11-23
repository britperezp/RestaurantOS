import "server-only";

import { auth } from "@clerk/nextjs/server";

export async function getAuthenticatedUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

export function unauthorizedApiResponse(): Response {
  return Response.json(
    { error: "Authentication required." },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}
