import { AsyncLocalStorage } from "node:async_hooks";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
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
  /** This visitor's personal key for outside AI agents. It can ask and check, never approve. */
  agentKey?: string;
  schemaVersion?: number;
}

/**
 * Every visitor gets their own private state, found by a random ID in a browser cookie. A new
 * browser starts with an empty app, and a returning one sees only its own missions, cart and
 * dashboard. Code that runs without a visitor (tests, scripts) shares one "local" state.
 */
const DATA_DIR = path.join(process.cwd(), ".data");
const VISITOR_DIR = path.join(DATA_DIR, "visitors");
/** The single shared file from before visitors existed. The first browser to visit inherits it. */
const LEGACY_FILE = path.join(DATA_DIR, "state.json");
const LOCAL_VISITOR = "local";
/** Keeps memory bounded on a public host. Evicted visitors reload from disk on their next visit. */
const MAX_CACHED_VISITORS = 500;

const VISITOR_ID = /^[a-f0-9]{32}$/;
export const isVisitorId = (value: unknown): value is string => typeof value === "string" && VISITOR_ID.test(value);

const holder = globalThis as unknown as {
  __veloraStates?: Map<string, AppState>;
  __veloraVisitor?: AsyncLocalStorage<string>;
};
const states = (holder.__veloraStates ??= new Map());
const visitor = (holder.__veloraVisitor ??= new AsyncLocalStorage<string>());

/** Runs work, including anything it starts in the background, as one visitor. */
export function runAsVisitor<T>(id: string, work: () => T): T {
  return visitor.run(id, work);
}

export function currentVisitor(): string {
  return visitor.getStore() ?? LOCAL_VISITOR;
}

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

const fileFor = (id: string) => path.join(VISITOR_DIR, `${id}.json`);
const persists = () => process.env.NODE_ENV !== "test";

/** Hands the old shared file to the first real visitor, so upgrading keeps the owner's history. */
function claimLegacyFile(id: string): void {
  if (!isVisitorId(id) || !existsSync(LEGACY_FILE) || existsSync(fileFor(id))) return;
  try {
    mkdirSync(VISITOR_DIR, { recursive: true });
    renameSync(LEGACY_FILE, fileFor(id));
  } catch {}
}

function load(id: string): AppState {
  let state = freshState();
  if (persists()) {
    claimLegacyFile(id);
    try {
      state = { ...state, ...(JSON.parse(readFileSync(fileFor(id), "utf8")) as AppState) };
    } catch {}
  }
  migrate(state);
  return state;
}

function cache(id: string, state: AppState): void {
  states.delete(id);
  states.set(id, state);
  if (states.size > MAX_CACHED_VISITORS) states.delete(states.keys().next().value!);
}

function stateOf(id: string): AppState {
  const cached = states.get(id);
  if (cached) {
    migrate(cached);
    cache(id, cached);
    return cached;
  }
  const state = load(id);
  cache(id, state);
  return state;
}

export function getState(): AppState {
  return stateOf(currentVisitor());
}

export function saveState(): void {
  if (!persists()) return;
  const id = currentVisitor();
  try {
    mkdirSync(VISITOR_DIR, { recursive: true });
    writeFileSync(fileFor(id), JSON.stringify(stateOf(id)));
  } catch {
    // Read-only hosts keep state in memory.
  }
}

export function resetState(): void {
  states.set(currentVisitor(), freshState());
}

/**
 * Finds the visitor whose state matches, for events with no browser behind them, such as PayPal
 * webhooks. Only saved visitors can match, since a payment always saves its mission first.
 */
export function findVisitor(matches: (state: AppState) => boolean): string | null {
  const ids = new Set(states.keys());
  if (persists()) {
    try {
      for (const file of readdirSync(VISITOR_DIR)) if (file.endsWith(".json")) ids.add(file.slice(0, -5));
    } catch {}
  }
  for (const id of ids) {
    if ((id === LOCAL_VISITOR || isVisitorId(id)) && matches(stateOf(id))) return id;
  }
  return null;
}
