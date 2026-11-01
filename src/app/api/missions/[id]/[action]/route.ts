import type { NextRequest } from "next/server";
import { firstBrokenEvent } from "@/lib/integrity";
import { MissionError, approveMission, cancelCheckout, chooseProduct, refundMission, rejectMission } from "@/lib/orchestrator";
import { getState } from "@/lib/store";

export async function POST(request: NextRequest, { params }: RouteContext<"/api/missions/[id]/[action]">) {
  const { id, action } = await params;
  const origin = process.env.APP_URL?.replace(/\/$/, "") || request.nextUrl.origin;
  try {
    if (action === "approve") return Response.json({ mission: await approveMission(id, origin) });
    if (action === "reject") return Response.json({ mission: rejectMission(id) });
    if (action === "choose") {
      const body = (await request.json().catch(() => null)) as { query?: unknown; candidateId?: unknown } | null;
      if (typeof body?.query !== "string" || typeof body.candidateId !== "string") {
        return Response.json({ error: "Choose a product." }, { status: 400 });
      }
      return Response.json({ mission: await chooseProduct(id, body.query, body.candidateId, origin) });
    }
    if (action === "cancel") return Response.json({ mission: cancelCheckout(id) });
    if (action === "refund") return Response.json({ mission: await refundMission(id) });
    if (action === "verify") {
      const mission = getState().missions[id];
      if (!mission) return Response.json({ error: "Mission not found." }, { status: 404 });
      return Response.json({ events: mission.events.length, brokenAt: firstBrokenEvent(mission.events) });
    }
    return Response.json({ error: "Unknown action." }, { status: 404 });
  } catch (error) {
    const known = error instanceof MissionError;
    return Response.json(
      { error: error instanceof Error ? error.message : "Action failed." },
      { status: known ? 409 : 502 },
    );
  }
}
