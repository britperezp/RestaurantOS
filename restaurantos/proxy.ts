import { clerkMiddleware } from "@clerk/nextjs/server";

const clerkAuthMiddleware = clerkMiddleware(async (auth, request) => {
  const pathname = request.nextUrl.pathname;
  const isPublicAuthPage = pathname === "/sign-in"
  || pathname === "/sign-in"
  || pathname.startsWith("/sign-in/")
    || pathname === "/sign-up"
    || pathname.startsWith("/sign-up/");

  if (!isPublicAuthPage && !pathname.startsWith("/api/")) {
    await auth.protect({ unauthenticatedUrl: new URL("/sign-in", request.url).toString() });
  }
});

const proxy = async (
  request: Parameters<typeof clerkAuthMiddleware>[0],
  event: Parameters<typeof clerkAuthMiddleware>[1],
) => {
  const response = await clerkAuthMiddleware(request, event);
  if (!(response instanceof Response)) return response;

  const rewrite = response.headers.get("x-middleware-rewrite");
  if (rewrite) {
    const rewriteUrl = new URL(rewrite, request.url);
    const requestUrl = new URL(request.url);
    if (
      rewriteUrl.origin === requestUrl.origin
      && rewriteUrl.pathname === requestUrl.pathname
      && rewriteUrl.search === requestUrl.search
    ) {
      response.headers.delete("x-middleware-rewrite");
      response.headers.set("x-middleware-next", "1");
    }
  }

  return response;
};

export default proxy;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
