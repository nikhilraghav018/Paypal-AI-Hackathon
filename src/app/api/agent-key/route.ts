import type { NextRequest } from "next/server";
import { agentKey, mcpEnabled, rotateAgentKey } from "@/lib/agent-key";
import { forVisitor } from "@/lib/visitor";

function details(request: NextRequest, key: string) {
  const origin = process.env.APP_URL?.replace(/\/$/, "") || request.nextUrl.origin;
  return Response.json({ enabled: true, url: `${origin}/api/mcp`, key }, { headers: { "Cache-Control": "no-store" } });
}

async function handleGET(request: NextRequest) {
  if (!mcpEnabled()) return Response.json({ enabled: false });
  return details(request, agentKey());
}

async function handlePOST(request: NextRequest) {
  if (!mcpEnabled()) return Response.json({ enabled: false });
  return details(request, rotateAgentKey());
}

export const GET = forVisitor(handleGET);
export const POST = forVisitor(handlePOST);
