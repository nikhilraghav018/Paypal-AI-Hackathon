import { NextResponse, type NextRequest } from "next/server";
import { isCrossSite } from "@/lib/same-site";

// Kept here as literals so the proxy does not pull in the server-only store.
const VISITOR_COOKIE = "velora_visitor";
const VISITOR_HEADER = "x-velora-visitor";
const VISITOR_ID = /^[a-f0-9]{32}$/;
const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Gives each browser a random visitor ID on its first visit, so it gets its own private missions,
 * cart and dashboard, and passes that ID on to the route handlers in a header only the proxy sets.
 */
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/") && isCrossSite(request)) {
    return NextResponse.json({ error: "Requests from other websites are not allowed." }, { status: 403 });
  }
  const sent = request.cookies.get(VISITOR_COOKIE)?.value;
  const id = sent && VISITOR_ID.test(sent) ? sent : crypto.randomUUID().replace(/-/g, "");

  const headers = new Headers(request.headers);
  headers.set(VISITOR_HEADER, id);
  const response = NextResponse.next({ request: { headers } });
  if (id !== sent) {
    response.cookies.set({
      name: VISITOR_COOKIE,
      value: id,
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: ONE_YEAR,
    });
  }
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)"] };
