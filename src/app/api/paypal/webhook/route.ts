import { applyWebhookEvent, webhookMission } from "@/lib/orchestrator";
import { verifyWebhook, type PayPalWebhookEvent } from "@/lib/paypal";
import { findVisitor, runAsVisitor } from "@/lib/store";

export async function POST(request: Request) {
  const rawBody = await request.text();
  let verified = false;
  try {
    verified = await verifyWebhook(request.headers, rawBody);
  } catch {
    // A non-2xx reply makes PayPal retry later.
    return Response.json({ error: "Could not verify the event." }, { status: 503 });
  }
  if (!verified) return Response.json({ error: "Event not verified." }, { status: 400 });
  const event = JSON.parse(rawBody) as PayPalWebhookEvent;
  // PayPal sends no browser cookie, so the event goes to whichever visitor owns the payment.
  const owner = findVisitor((state) => Boolean(webhookMission(state, event)));
  if (owner) runAsVisitor(owner, () => applyWebhookEvent(event));
  return Response.json({ received: true });
}
