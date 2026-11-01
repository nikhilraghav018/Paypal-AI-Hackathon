import type { BasketLine } from "./types";

// Deliberately not configurable. This app can never reach PayPal's live API,
// so it cannot move real money even if live credentials are pasted in.
export const PAYPAL_BASE_URL = "https://api-m.sandbox.paypal.com";

let cachedToken: { value: string; expiresAt: number } | null = null;

export function paypalConfigured(): boolean {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value;
  const credentials = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal sandbox sign-in failed (${res.status}). Check your sandbox client ID and secret.`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

async function call<T>(path: string, init: { method: string; body?: unknown; requestId?: string }): Promise<T> {
  const res = await fetch(`${PAYPAL_BASE_URL}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json",
      ...(init.requestId ? { "PayPal-Request-Id": init.requestId } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text.slice(0, 300);
    try {
      const parsed = JSON.parse(text) as { name?: string; message?: string; details?: { issue?: string }[] };
      detail = [parsed.name, parsed.details?.[0]?.issue, parsed.message].filter(Boolean).join(": ");
    } catch {}
    throw new Error(`PayPal sandbox ${res.status}: ${detail}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

function money(cents: number) {
  return { currency_code: "USD", value: (cents / 100).toFixed(2) };
}

export function buildOrderBody(input: {
  missionId: string;
  basket: BasketLine[];
  totalCents: number;
  returnUrl: string;
  cancelUrl: string;
}) {
  return {
    intent: "CAPTURE",
    purchase_units: [
      {
        custom_id: input.missionId,
        description: "Agent Allowance sandbox purchase",
        amount: {
          ...money(input.totalCents),
          breakdown: { item_total: money(input.totalCents) },
        },
        items: input.basket.map((line) => ({
          name: line.title.slice(0, 127),
          quantity: String(line.quantity),
          unit_amount: money(line.priceCents),
        })),
      },
    ],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: "Agent Allowance",
          shipping_preference: "NO_SHIPPING",
          user_action: "PAY_NOW",
          return_url: input.returnUrl,
          cancel_url: input.cancelUrl,
        },
      },
    },
  };
}

interface OrderResponse {
  id: string;
  status: string;
  links?: { rel: string; href: string }[];
  purchase_units?: {
    amount?: { value?: string; currency_code?: string };
    payments?: { captures?: { id: string; status: string }[] };
  }[];
}

export async function createOrder(input: Parameters<typeof buildOrderBody>[0] & { revision?: number }) {
  const order = await call<OrderResponse>("/v2/checkout/orders", {
    method: "POST",
    body: buildOrderBody(input),
    requestId: `order-${input.missionId}-${input.revision ?? 0}`,
  });
  const approvalUrl = order.links?.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href;
  if (!approvalUrl) throw new Error("PayPal sandbox did not return an approval link.");
  return { orderId: order.id, approvalUrl };
}

export async function getOrderAmount(orderId: string) {
  const order = await call<OrderResponse>(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, { method: "GET" });
  const amount = order.purchase_units?.[0]?.amount;
  return { cents: Math.round(Number(amount?.value) * 100), currency: amount?.currency_code, status: order.status };
}

export async function captureOrder(orderId: string, missionId: string) {
  const order = await call<OrderResponse>(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST",
    body: {},
    requestId: `capture-${missionId}`,
  });
  const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
  if (!capture || capture.status !== "COMPLETED") {
    throw new Error(`PayPal sandbox capture did not complete (${capture?.status ?? order.status}).`);
  }
  return { captureId: capture.id };
}

export async function refundCapture(captureId: string, missionId: string) {
  await call(`/v2/payments/captures/${encodeURIComponent(captureId)}/refund`, {
    method: "POST",
    body: {},
    requestId: `refund-${missionId}`,
  });
}

export interface PayPalWebhookEvent {
  id: string;
  event_type: string;
  resource?: {
    id?: string;
    custom_id?: string;
    amount?: { value?: string };
    links?: { rel: string; href: string }[];
  };
}

/** Asks PayPal whether a webhook is genuine. Without a webhook ID, every event is refused. */
export async function verifyWebhook(headers: Headers, rawBody: string): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId || !paypalConfigured()) return false;
  const fields = {
    auth_algo: headers.get("paypal-auth-algo"),
    cert_url: headers.get("paypal-cert-url"),
    transmission_id: headers.get("paypal-transmission-id"),
    transmission_sig: headers.get("paypal-transmission-sig"),
    transmission_time: headers.get("paypal-transmission-time"),
    webhook_id: webhookId,
  };
  if (Object.values(fields).some((value) => !value)) return false;
  // The event is inserted as raw text because re-encoding it can break the signature.
  const res = await fetch(`${PAYPAL_BASE_URL}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
    body: `${JSON.stringify(fields).slice(0, -1)},"webhook_event":${rawBody}}`,
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { verification_status?: string };
  return data.verification_status === "SUCCESS";
}
