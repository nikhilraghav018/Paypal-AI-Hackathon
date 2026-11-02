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

// Rate limits and server errors are usually brief. PayPal's advice is to retry with the same request ID.
const RETRY_DELAYS_MS = [400, 1200];
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

async function call<T>(path: string, init: { method: string; body?: unknown; requestId?: string; fullResponse?: boolean }): Promise<T> {
  const send = async () =>
    fetch(`${PAYPAL_BASE_URL}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${await accessToken()}`,
        "Content-Type": "application/json",
        ...(init.requestId ? { "PayPal-Request-Id": init.requestId } : {}),
        ...(init.fullResponse ? { Prefer: "return=representation" } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  // A POST without a request ID could charge twice if repeated, so only safe calls are retried.
  const canRetry = init.method !== "POST" || Boolean(init.requestId);
  let res = await send();
  for (const delay of RETRY_DELAYS_MS) {
    if (!canRetry || !RETRYABLE.has(res.status)) break;
    await new Promise((resolve) => setTimeout(resolve, delay));
    res = await send();
  }
  const text = await res.text();
  if (!res.ok) {
    let detail = text.slice(0, 300);
    try {
      const parsed = JSON.parse(text) as { name?: string; message?: string; details?: { issue?: string }[] };
      detail = [parsed.name, parsed.details?.[0]?.issue, parsed.message].filter(Boolean).join(": ");
    } catch {}
    const debugId = res.headers.get("paypal-debug-id");
    throw new Error(`PayPal sandbox ${res.status}: ${detail}${debugId ? ` (debug ID ${debugId})` : ""}`);
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
  taxCents?: number;
  returnUrl: string;
  cancelUrl: string;
  /** Pays with a saved PayPal account, so no approval page or URLs are involved. */
  vaultId?: string;
}) {
  const taxCents = input.taxCents ?? 0;
  return {
    intent: "CAPTURE",
    purchase_units: [
      {
        custom_id: input.missionId,
        description: "Velora sandbox purchase",
        amount: {
          ...money(input.totalCents),
          breakdown: {
            item_total: money(input.totalCents - taxCents),
            ...(taxCents ? { tax_total: money(taxCents) } : {}),
          },
        },
        items: input.basket.map((line) => ({
          name: line.title.slice(0, 127),
          quantity: String(line.quantity),
          unit_amount: money(line.priceCents),
        })),
      },
    ],
    payment_source: {
      paypal: input.vaultId
        ? { vault_id: input.vaultId }
        : {
            experience_context: {
              brand_name: "Velora",
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

function captureResult(order: OrderResponse) {
  const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
  // A pending capture has taken the money, so it must not be treated as a failure.
  if (!capture || (capture.status !== "COMPLETED" && capture.status !== "PENDING")) {
    throw new Error(`PayPal sandbox capture did not complete (${capture?.status ?? order.status}).`);
  }
  return { captureId: capture.id, pending: capture.status === "PENDING" };
}

export async function captureOrder(orderId: string, missionId: string, attempt = 0) {
  const order = await call<OrderResponse>(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST",
    body: {},
    requestId: `capture-${missionId}${attempt ? `-${attempt}` : ""}`,
  });
  return captureResult(order);
}

/** Creates and pays an order in one call, using the owner's saved PayPal account. */
export async function chargeSavedAccount(input: Parameters<typeof buildOrderBody>[0] & { vaultId: string; revision?: number }) {
  const order = await call<OrderResponse>("/v2/checkout/orders", {
    method: "POST",
    body: buildOrderBody(input),
    requestId: `charge-${input.missionId}-${input.revision ?? 0}`,
    fullResponse: true,
  });
  return { orderId: order.id, ...captureResult(order) };
}

/** Starts saving a PayPal account. The owner approves it once on PayPal's page. */
export async function createSetupToken(returnUrl: string, cancelUrl: string, requestId: string) {
  const token = await call<OrderResponse>("/v3/vault/setup-tokens", {
    method: "POST",
    requestId,
    body: {
      payment_source: {
        paypal: {
          usage_type: "MERCHANT",
          experience_context: {
            brand_name: "Velora",
            shipping_preference: "NO_SHIPPING",
            return_url: returnUrl,
            cancel_url: cancelUrl,
          },
        },
      },
    },
  });
  const approvalUrl = token.links?.find((l) => l.rel === "approve")?.href;
  if (!approvalUrl) throw new Error("PayPal sandbox did not return an approval link.");
  return { setupToken: token.id, approvalUrl };
}

export async function createPaymentToken(setupToken: string) {
  const token = await call<{ id: string; payment_source?: { paypal?: { email_address?: string } } }>("/v3/vault/payment-tokens", {
    method: "POST",
    requestId: `save-${setupToken}`,
    body: { payment_source: { token: { id: setupToken, type: "SETUP_TOKEN" } } },
  });
  return { vaultId: token.id, email: token.payment_source?.paypal?.email_address };
}

export async function deletePaymentToken(vaultId: string) {
  await call(`/v3/vault/payment-tokens/${encodeURIComponent(vaultId)}`, { method: "DELETE" });
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
