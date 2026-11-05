import { isVisitorId, runAsVisitor } from "./store";

/** Set by the proxy on every request it passes on, replacing anything the browser sent. */
export const VISITOR_HEADER = "x-velora-visitor";

/** The visitor behind a browser request, taken from the header the proxy sets. */
export function visitorOf(request: Request): string | null {
  const id = request.headers.get(VISITOR_HEADER);
  return isVisitorId(id) ? id : null;
}

/** Wraps a route handler so everything it does reads and writes the calling visitor's own state. */
export function forVisitor<Req extends Request = Request, Ctx = unknown>(
  handler: (request: Req, context: Ctx) => Promise<Response> | Response,
) {
  return async (request: Req, context: Ctx): Promise<Response> => {
    const id = visitorOf(request);
    if (!id) return Response.json({ error: "Your browser session is missing. Reload the page." }, { status: 400 });
    return runAsVisitor(id, () => handler(request, context));
  };
}
