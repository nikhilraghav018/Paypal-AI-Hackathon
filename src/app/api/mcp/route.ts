import { createHash, timingSafeEqual } from "node:crypto";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { NextRequest } from "next/server";
import { createVeloraServer } from "@/lib/mcp";

// Anyone holding this token can ask Velora to spend, so short tokens are refused outright.
const MIN_TOKEN_LENGTH = 24;

const digest = (value: string) => createHash("sha256").update(value).digest();

function refusal(request: Request): Response | null {
  const token = process.env.VELORA_MCP_TOKEN ?? "";
  if (token.length < MIN_TOKEN_LENGTH) {
    return Response.json({ error: `MCP access is off. Set VELORA_MCP_TOKEN to a secret of at least ${MIN_TOKEN_LENGTH} characters.` }, { status: 503 });
  }
  const sent = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!timingSafeEqual(digest(sent), digest(token))) {
    return Response.json({ error: "Missing or wrong access token." }, { status: 401, headers: { "WWW-Authenticate": "Bearer" } });
  }
  return null;
}

/** Stateless: every request gets its own server, so nothing is shared between callers. */
export async function POST(request: NextRequest) {
  const refused = refusal(request);
  if (refused) return refused;
  const origin = process.env.APP_URL?.replace(/\/$/, "") || request.nextUrl.origin;
  const server = createVeloraServer(origin);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    await server.close();
  }
}

// A stateless server has no stream to open or session to end.
const notAllowed = () => Response.json({ error: "Use POST." }, { status: 405, headers: { Allow: "POST" } });
export const GET = notAllowed;
export const DELETE = notAllowed;
