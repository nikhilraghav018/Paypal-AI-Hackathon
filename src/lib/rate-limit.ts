// Protects the free AI and catalog quotas if the demo is hosted publicly. The app and the MCP
// server share one limit, so an outside agent can't use them up on its own.
const MAX_MISSIONS_PER_HOUR = 40;
const recentRuns: number[] = [];

export function allowMissionRun(now = Date.now()): boolean {
  while (recentRuns.length && now - recentRuns[0] > 3_600_000) recentRuns.shift();
  if (recentRuns.length >= MAX_MISSIONS_PER_HOUR) return false;
  recentRuns.push(now);
  return true;
}
