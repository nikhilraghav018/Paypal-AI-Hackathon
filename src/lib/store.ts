import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_POLICY } from "./policy";
import type { LedgerEntry, Mission, Policy } from "./types";

export interface AppState {
  policy: Policy;
  ledger: LedgerEntry[];
  missions: Record<string, Mission>;
  seenWebhookIds: string[];
  schemaVersion?: number;
}

const DATA_FILE = path.join(process.cwd(), ".data", "state.json");
const holder = globalThis as unknown as { __agentAllowance?: AppState };

const SCHEMA_VERSION = 2;

/** Version 2 allows gift cards, so saved settings and missions blocked for that reason are cleared once. */
function migrate(state: AppState): void {
  if ((state.schemaVersion ?? 1) >= SCHEMA_VERSION) return;
  state.policy.blockedCategories = state.policy.blockedCategories.filter((c) => c !== "gift cards");
  for (const mission of Object.values(state.missions)) {
    if (mission.status === "BLOCKED" && /gift ?card/i.test(mission.prompt)) delete state.missions[mission.id];
  }
  state.schemaVersion = SCHEMA_VERSION;
}

function freshState(): AppState {
  return { policy: { ...DEFAULT_POLICY }, ledger: [], missions: {}, seenWebhookIds: [], schemaVersion: SCHEMA_VERSION };
}

export function getState(): AppState {
  if (holder.__agentAllowance) {
    migrate(holder.__agentAllowance);
    return holder.__agentAllowance;
  }
  let state = freshState();
  if (process.env.NODE_ENV !== "test") {
    try {
      state = { ...state, ...(JSON.parse(readFileSync(DATA_FILE, "utf8")) as AppState) };
    } catch {}
  }
  migrate(state);
  holder.__agentAllowance = state;
  return state;
}

export function saveState(): void {
  if (process.env.NODE_ENV === "test") return;
  try {
    mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    writeFileSync(DATA_FILE, JSON.stringify(getState()));
  } catch {
    // Read-only hosts keep state in memory.
  }
}

export function resetState(): void {
  holder.__agentAllowance = freshState();
}
