import { randomUUID } from "node:crypto";
import { type NextRequest, connection } from "next/server";
import { createSetupToken, deletePaymentToken, paypalConfigured } from "@/lib/paypal";
import { getState, saveState } from "@/lib/store";

function snapshot() {
  const { wallet } = getState();
  return { connected: Boolean(wallet), email: wallet?.email };
}

export async function GET() {
  await connection();
  return Response.json(snapshot());
}

/** Starts saving a PayPal account. Demo mode has no PayPal keys, so it saves a labelled simulated one. */
export async function POST(request: NextRequest) {
  const origin = process.env.APP_URL?.replace(/\/$/, "") || request.nextUrl.origin;
  const state = getState();
  try {
    if (!paypalConfigured()) {
      state.wallet = { vaultId: `SIM-${randomUUID().slice(0, 8)}`, connectedAt: new Date().toISOString() };
      saveState();
      return Response.json(snapshot());
    }
    const returnUrl = `${origin}/api/paypal/vault-return`;
    const { setupToken, approvalUrl } = await createSetupToken(returnUrl, `${returnUrl}?cancelled=1`, `setup-${randomUUID()}`);
    state.pendingSetupToken = setupToken;
    saveState();
    return Response.json({ approvalUrl });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not connect PayPal." }, { status: 502 });
  }
}

export async function DELETE() {
  const state = getState();
  try {
    if (state.wallet && paypalConfigured()) await deletePaymentToken(state.wallet.vaultId);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not remove the saved account." }, { status: 502 });
  }
  state.wallet = undefined;
  saveState();
  return Response.json(snapshot());
}
