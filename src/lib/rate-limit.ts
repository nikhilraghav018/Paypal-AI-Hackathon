import { currentVisitor } from "./store";

// Protects the free AI and catalog quotas if the demo is hosted publicly. The app and the MCP
// server share these limits, so an outside agent can't use them up on its own, and one visitor
// can't use up everyone's share.
const MAX_MISSIONS_PER_HOUR = 40;
const MAX_PER_VISITOR_PER_HOUR = 15;
const HOUR = 3_600_000;
const recentRuns: { at: number; visitor: string }[] = [];

export function allowMissionRun(now = Date.now(), visitor = currentVisitor()): boolean {
  while (recentRuns.length && now - recentRuns[0].at > HOUR) recentRuns.shift();
  if (recentRuns.length >= MAX_MISSIONS_PER_HOUR) return false;
  if (recentRuns.filter((r) => r.visitor === visitor).length >= MAX_PER_VISITOR_PER_HOUR) return false;
  recentRuns.push({ at: now, visitor });
  return true;
}
