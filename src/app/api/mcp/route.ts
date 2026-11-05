import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { NextRequest } from "next/server";
import { mcpEnabled, visitorForKey } from "@/lib/agent-key";
import { createVeloraServer } from "@/lib/mcp";
import { runAsVisitor } from "@/lib/store";

/** Stateless: every request gets its own server, and acts for the visitor who owns the key. */
export async function POST(request: NextRequest) {
  if (!mcpEnabled()) {
    return Response.json({ error: "MCP access is off on this Velora. The site owner turns it on with VELORA_MCP_TOKEN." }, { status: 503 });
  }
  const key = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const owner = visitorForKey(key);
  if (!owner) {
    return Response.json(
      { error: "Missing or wrong agent key. Copy yours from Live services > Connect an AI agent in Velora." },
      { status: 401, headers: { "WWW-Authenticate": "Bearer" } },
    );
  }
  const origin = process.env.APP_URL?.replace(/\/$/, "") || request.nextUrl.origin;
  return runAsVisitor(owner, async () => {
    const server = createVeloraServer(origin);
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    try {
      return await transport.handleRequest(request);
    } finally {
      await server.close();
    }
  });
}

// A stateless server has no stream to open or session to end.
const notAllowed = () => Response.json({ error: "Use POST." }, { status: 405, headers: { Allow: "POST" } });
export const GET = notAllowed;
export const DELETE = notAllowed;
