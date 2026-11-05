import type { NextRequest } from "next/server";
import { cancelCheckout, completePayment } from "@/lib/orchestrator";
import { getState } from "@/lib/store";
import { forVisitor } from "@/lib/visitor";

async function handleGET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const missionId = searchParams.get("mission") ?? "";
  const base = process.env.APP_URL?.replace(/\/$/, "") || origin;
  const id = encodeURIComponent(missionId);
  let notice = "";
  try {
    if (searchParams.get("cancelled")) {
      const mission = cancelCheckout(missionId);
      if (mission.fromCart) return Response.redirect(`${base}/cart`, 303);
    } else {
      await completePayment(missionId, searchParams.get("token"));
      // Only a confirmed capture earns the celebration.
      const paid = getState().missions[missionId];
      if (paid?.status === "PAID" && !paid.capturePending) return Response.redirect(`${base}/paid?mission=${id}`, 303);
    }
  } catch (error) {
    notice = `&notice=${encodeURIComponent(error instanceof Error ? error.message : "Payment failed.")}`;
  }
  return Response.redirect(`${base}/?mission=${id}${notice}`, 303);
}

export const GET = forVisitor(handleGET);
