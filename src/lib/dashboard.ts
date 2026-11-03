import type { MissionStatus } from "./types";

/** What the dashboard needs from one mission, without its full audit trail. */
export interface DashboardMission {
  id: string;
  createdAt: string;
  status: MissionStatus;
  requestedBy?: string;
  lines: { category: string; priceCents: number; quantity: number }[];
  /** Codes of listings the Risk Sentinel quarantined. */
  quarantined: string[];
}

export interface TrendingProduct {
  missionId: string;
  candidateId: string;
  title: string;
  priceCents: number;
  domain: string;
  url: string;
  imageUrl?: string;
  /** How many of your missions surfaced it. */
  seen: number;
}

export interface DashboardData {
  missions: DashboardMission[];
  spentCents: number;
  monthlyBudgetCents: number;
  trending: {
    category: { name: string; products: TrendingProduct[] } | null;
    priceRange: { name: string; products: TrendingProduct[] } | null;
  };
}

export const PRICE_RANGES = [
  { label: "Under $10", max: 1000 },
  { label: "$10–25", max: 2500 },
  { label: "$25–50", max: 5000 },
  { label: "$50–100", max: 10000 },
  { label: "$100–200", max: 20000 },
  { label: "$200+", max: Infinity },
] as const;

export function priceRange(cents: number): string {
  return PRICE_RANGES.find((range) => cents < range.max)!.label;
}

/** "Apparel & Accessories > Shoes" becomes "Apparel & Accessories". */
export function topCategory(category: string): string {
  const top = category.split(">")[0].trim();
  return top ? top.charAt(0).toUpperCase() + top.slice(1) : "Other";
}

export type Outcome = "Bought" | "Waiting" | "Refunded" | "Cancelled" | "Stopped";

export const OUTCOME_OF: Record<MissionStatus, Outcome> = {
  PAID: "Bought",
  RUNNING: "Waiting",
  NEEDS_HUMAN: "Waiting",
  AWAITING_PAYER: "Waiting",
  REFUNDED: "Refunded",
  REJECTED: "Cancelled",
  CANCELLED: "Cancelled",
  EXPIRED: "Cancelled",
  BLOCKED: "Stopped",
  FAILED: "Stopped",
};

const GUARDRAIL_LABEL: Record<string, string> = {
  PROMPT_INJECTION: "Hidden instructions",
  OFF_PLATFORM_PAYMENT: "Pay outside PayPal",
  INSECURE_LINK: "Insecure link",
  RESTRICTED_CATEGORY: "Restricted goods",
  IMPLAUSIBLE_DISCOUNT: "Fake discount",
};

const TIME_BLOCKS = ["12–4am", "4–8am", "8am–12", "12–4pm", "4–8pm", "8pm–12"];
const DAYS = 14;

const units = (m: DashboardMission) => m.lines.reduce((sum, l) => sum + l.quantity, 0);
const byAgent = (m: DashboardMission) => Boolean(m.requestedBy);

function countInto<K extends string>(order: readonly K[], entries: [K, number][]): number[] {
  return order.map((key) => entries.filter(([k]) => k === key).reduce((sum, [, n]) => sum + n, 0));
}

/** Keeps the biggest groups and folds the rest into "Other", so a chart never needs a ninth colour. */
function topGroups(totals: Map<string, number>, limit: number): string[] {
  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  return sorted.length > limit ? [...sorted.slice(0, limit - 1), "Other"] : sorted;
}

/** Turns missions into chart-ready numbers. Runs in the browser so times use the viewer's clock. */
export function dashboardStats(missions: DashboardMission[], now = new Date()) {
  const bought = missions.filter((m) => m.status === "PAID");
  const boughtUnits = bought.reduce((sum, m) => sum + units(m), 0);

  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Array.from({ length: DAYS }, (_, i) => new Date(dayStart.getTime() - (DAYS - 1 - i) * 86_400_000));
  const dayIndex = (iso: string) => {
    const d = new Date(iso);
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    return Math.round((start - days[0].getTime()) / 86_400_000);
  };
  const daily = (agent: boolean) =>
    days.map((_, i) => missions.filter((m) => byAgent(m) === agent && dayIndex(m.createdAt) === i).length);

  const timeOfDay = (agent: boolean) =>
    TIME_BLOCKS.map((_, i) => missions.filter((m) => byAgent(m) === agent && Math.floor(new Date(m.createdAt).getHours() / 4) === i).length);

  const outcomes: Outcome[] = ["Bought", "Waiting", "Refunded", "Cancelled", "Stopped"];
  const outcomeCounts = countInto(outcomes, missions.map((m) => [OUTCOME_OF[m.status], 1]));

  const chosen = missions.flatMap((m) => m.lines.map((l) => ({ ...l, bought: m.status === "PAID" })));
  const categoryTotals = new Map<string, number>();
  for (const l of chosen) categoryTotals.set(topCategory(l.category), (categoryTotals.get(topCategory(l.category)) ?? 0) + l.quantity);
  const categories = topGroups(categoryTotals, 6);
  const categoryOf = (l: { category: string }) => (categories.includes(topCategory(l.category)) ? topCategory(l.category) : "Other");
  const ranges = PRICE_RANGES.map((r) => r.label);

  const caught = new Map<string, number>();
  for (const code of missions.flatMap((m) => m.quarantined)) {
    const label = GUARDRAIL_LABEL[code] ?? "Other risks";
    caught.set(label, (caught.get(label) ?? 0) + 1);
  }
  const guardrails = [...caught.entries()].sort((a, b) => b[1] - a[1]);

  return {
    tiles: {
      boughtUnits,
      agentUnits: bought.filter(byAgent).reduce((sum, m) => sum + units(m), 0),
      missions: missions.length,
      stopped: missions.filter((m) => OUTCOME_OF[m.status] === "Stopped").length,
      listingsCaught: guardrails.reduce((sum, [, n]) => sum + n, 0),
    },
    daily: {
      labels: days.map((d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" })),
      you: daily(false),
      agents: daily(true),
    },
    timeOfDay: { labels: TIME_BLOCKS, you: timeOfDay(false), agents: timeOfDay(true) },
    outcomes: outcomes.map((name, i) => ({ name, value: outcomeCounts[i] })),
    categories: {
      labels: categories,
      bought: countInto(categories, chosen.filter((l) => l.bought).map((l) => [categoryOf(l), l.quantity])),
      notBought: countInto(categories, chosen.filter((l) => !l.bought).map((l) => [categoryOf(l), l.quantity])),
    },
    priceRanges: {
      labels: ranges,
      bought: countInto(ranges, chosen.filter((l) => l.bought).map((l) => [priceRange(l.priceCents), l.quantity])),
      notBought: countInto(ranges, chosen.filter((l) => !l.bought).map((l) => [priceRange(l.priceCents), l.quantity])),
    },
    guardrails,
  };
}
