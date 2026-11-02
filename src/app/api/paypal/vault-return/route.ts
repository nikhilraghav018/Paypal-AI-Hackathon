import type { NextRequest } from "next/server";
import { createPaymentToken } from "@/lib/paypal";
import { getState, saveState } from "@/lib/store";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const base = process.env.APP_URL?.replace(/\/$/, "") || origin;
  const state = getState();
  const setupToken = state.pendingSetupToken;
  state.pendingSetupToken = undefined;
  let notice = "";
  try {
    const returned = searchParams.get("approval_token_id");
    if (searchParams.get("cancelled")) notice = "PayPal was not connected.";
    else if (!setupToken || (returned && returned !== setupToken)) notice = "That PayPal approval does not match this request.";
    else {
      const { vaultId, email } = await createPaymentToken(setupToken);
      state.wallet = { vaultId, email, connectedAt: new Date().toISOString() };
    }
  } catch (error) {
    notice = error instanceof Error ? error.message : "Could not connect PayPal.";
  }
  saveState();
  return Response.redirect(`${base}/${notice ? `?notice=${encodeURIComponent(notice)}` : ""}`, 303);
}
