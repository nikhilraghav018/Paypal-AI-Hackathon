/**
 * The app has no login, so another website could otherwise make a visitor's browser spend from
 * their budget. Tools with no browser origin aren't affected, and PayPal's webhooks prove themselves
 * with a signature.
 */
export function isCrossSite(request: Request): boolean {
  if (request.method === "GET" || request.method === "HEAD") return false;
  if (new URL(request.url).pathname === "/api/paypal/webhook") return false;
  if (request.headers.get("sec-fetch-site") === "cross-site") return true;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}
