import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_POLICY } from "./policy";
import type { BasketLine, CartItem, LedgerEntry, Mission, Policy, Wallet } from "./types";

export interface AppState {
  policy: Policy;
  ledger: LedgerEntry[];
  missions: Record<string, Mission>;
  seenWebhookIds: string[];
  cart: CartItem[];
  wallet?: Wallet;
  /** The setup token waiting for the owner's approval on PayPal. */
  pendingSetupToken?: string;
  schemaVersion?: number;
}

const DATA_FILE = path.join(process.cwd(), ".data", "state.json");
const holder = globalThis as unknown as { __agentAllowance?: AppState };

const SCHEMA_VERSION = 5;

/** Version 2 allows gift cards, so saved settings and missions blocked for that reason are cleared once. */
function migrate(state: AppState): void {
  if ((state.schemaVersion ?? 1) >= SCHEMA_VERSION) return;
  state.cart ??= [];
  delete (state.policy as Policy & { killSwitch?: boolean }).killSwitch;
  // Version 4 keeps only the cart order once a cart is paid, so earlier leftovers are cleared once.
  for (const mission of Object.values(state.missions)) {
    if (!mission.fromCart || (mission.status !== "PAID" && mission.status !== "REFUNDED")) continue;
    for (const line of mission.basket as (BasketLine & { sourceMissionId?: string })[]) {
      const source = line.sourceMissionId ? state.missions[line.sourceMissionId] : undefined;
      if (!source || source.status === "PAID" || source.status === "REFUNDED") continue;
      if (state.cart.some((item) => item.sourceMissionId === source.id)) continue;
      delete state.missions[source.id];
      state.ledger = state.ledger.filter((e) => e.missionId !== source.id);
    }
  }
  state.policy.blockedCategories = state.policy.blockedCategories.filter((c) => c !== "gift cards");
  for (const mission of Object.values(state.missions)) {
    if (mission.status === "BLOCKED" && /gift ?card/i.test(mission.prompt)) delete state.missions[mission.id];
  }
  state.schemaVersion = SCHEMA_VERSION;
}

function freshState(): AppState {
  return { policy: { ...DEFAULT_POLICY }, ledger: [], missions: {}, seenWebhookIds: [], cart: [], schemaVersion: SCHEMA_VERSION };
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
