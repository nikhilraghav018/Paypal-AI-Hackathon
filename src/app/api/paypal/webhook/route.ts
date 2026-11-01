import { applyWebhookEvent } from "@/lib/orchestrator";
import { verifyWebhook, type PayPalWebhookEvent } from "@/lib/paypal";

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
  applyWebhookEvent(JSON.parse(rawBody) as PayPalWebhookEvent);
  return Response.json({ received: true });
}
