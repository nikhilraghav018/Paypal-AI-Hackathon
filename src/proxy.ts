import { NextResponse, type NextRequest } from "next/server";
import { isCrossSite } from "@/lib/same-site";

export function proxy(request: NextRequest) {
  if (isCrossSite(request)) return NextResponse.json({ error: "Requests from other websites are not allowed." }, { status: 403 });
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
