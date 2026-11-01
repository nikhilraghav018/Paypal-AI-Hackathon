import type { NextRequest } from "next/server";
import { z } from "zod";
import { runMission } from "@/lib/orchestrator";
import { AGES, COLORS, CONDITIONS, GENDERS } from "@/lib/preferences";
import { getState } from "@/lib/store";
import type { StreamMessage } from "@/lib/types";

const oneOf = <T extends { value: string }>(options: readonly T[]) =>
  z.enum(options.map((option) => option.value) as [T["value"], ...T["value"][]]).optional();

const Body = z.object({
  prompt: z.string().trim().min(3).max(500),
  preferences: z
    .object({ gender: oneOf(GENDERS), age: oneOf(AGES), color: oneOf(COLORS), condition: oneOf(CONDITIONS) })
    .optional(),
});

// Protects the free AI and catalog quotas if the demo is hosted publicly.
const MAX_MISSIONS_PER_HOUR = 40;
const recentRuns: number[] = [];

export async function GET() {
  const missions = Object.values(getState().missions).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return Response.json({ missions: missions.slice(0, 20) });
}

export async function POST(request: NextRequest) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Describe what to buy in 3 to 500 characters." }, { status: 400 });

  const now = Date.now();
  while (recentRuns.length && now - recentRuns[0] > 3_600_000) recentRuns.shift();
  if (recentRuns.length >= MAX_MISSIONS_PER_HOUR) {
    return Response.json({ error: "Demo limit reached. Please try again in a while." }, { status: 429 });
  }
  recentRuns.push(now);

  const origin = process.env.APP_URL?.replace(/\/$/, "") || request.nextUrl.origin;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (message: StreamMessage) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(message)}\n`));
        } catch {
          // The viewer disconnected. The mission still finishes and is saved.
        }
      };
      try {
        const mission = await runMission(
          parsed.data.prompt,
          origin,
          (m, event) => send({ type: "event", missionId: m.id, event }),
          parsed.data.preferences,
        );
        send({ type: "mission", mission });
      } catch (error) {
        send({ type: "error", message: error instanceof Error ? error.message : "Mission failed." });
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}
