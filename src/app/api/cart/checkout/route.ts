import type { NextRequest } from "next/server";
import { MissionError, checkoutCart } from "@/lib/orchestrator";
import { forVisitor } from "@/lib/visitor";

async function handlePOST(request: NextRequest) {
  const origin = process.env.APP_URL?.replace(/\/$/, "") || request.nextUrl.origin;
  const body = (await request.json().catch(() => null)) as { totalCents?: unknown } | null;
  try {
    return Response.json({ mission: await checkoutCart(body?.totalCents, origin) });
  } catch (error) {
    const known = error instanceof MissionError;
    return Response.json({ error: error instanceof Error ? error.message : "Checkout failed." }, { status: known ? 409 : 502 });
  }
}

export const POST = forVisitor(handlePOST);
