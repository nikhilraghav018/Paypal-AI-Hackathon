import type { NextRequest } from "next/server";
import { cancelCheckout, completePayment } from "@/lib/orchestrator";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const missionId = searchParams.get("mission") ?? "";
  const base = process.env.APP_URL?.replace(/\/$/, "") || origin;
  let notice = "";
  try {
    if (searchParams.get("cancelled")) cancelCheckout(missionId);
    else await completePayment(missionId, searchParams.get("token"));
  } catch (error) {
    notice = `&notice=${encodeURIComponent(error instanceof Error ? error.message : "Payment failed.")}`;
  }
  return Response.redirect(`${base}/?mission=${encodeURIComponent(missionId)}${notice}`, 303);
}
