import { priceRange, topCategory, type DashboardData, type TrendingProduct } from "./dashboard";
import { committedThisMonth } from "./policy";
import type { AppState } from "./store";

const TRENDING_COUNT = 3;

/** Picks the most frequent key among weighted entries. */
function mostCommon(entries: [string, number][]): string | null {
  const totals = new Map<string, number>();
  for (const [key, n] of entries) totals.set(key, (totals.get(key) ?? 0) + n);
  return [...totals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/**
 * Trending products come only from listings your missions already screened as safe, ranked by how
 * often they came up and then by price. They follow what you buy most, or what you chose if
 * nothing has been bought yet.
 */
function trending(state: AppState, exclude: Set<string>) {
  const missions = Object.values(state.missions);
  const bought = missions.filter((m) => m.status === "PAID").flatMap((m) => m.basket);
  const basis = bought.length ? bought : missions.flatMap((m) => m.basket);

  const pool = new Map<string, TrendingProduct & { category: string }>();
  for (const mission of missions) {
    for (const c of mission.alternatives ?? []) {
      if (exclude.has(c.id) || !c.url.startsWith("https://")) continue;
      const existing = pool.get(c.id);
      if (existing) existing.seen += 1;
      else {
        pool.set(c.id, {
          missionId: mission.id, candidateId: c.id, title: c.title, priceCents: c.priceCents,
          domain: c.domain, url: c.url, imageUrl: c.imageUrl, seen: 1, category: c.category,
        });
      }
    }
  }
  const ranked = [...pool.values()].sort((a, b) => b.seen - a.seen || a.priceCents - b.priceCents);
  const pick = (match: (p: (typeof ranked)[number]) => boolean, skip = new Set<string>()) =>
    ranked.filter((p) => match(p) && !skip.has(p.candidateId)).slice(0, TRENDING_COUNT);

  const category = mostCommon(basis.map((l) => [topCategory(l.category), l.quantity]));
  const range = mostCommon(basis.map((l) => [priceRange(l.priceCents), l.quantity]));
  const byCategory = category ? pick((p) => topCategory(p.category) === category) : [];
  const shown = new Set(byCategory.map((p) => p.candidateId));
  const byRange = range ? pick((p) => priceRange(p.priceCents) === range, shown) : [];
  return {
    category: category && byCategory.length ? { name: category, products: byCategory } : null,
    priceRange: range && byRange.length ? { name: range, products: byRange } : null,
  };
}

export function buildDashboard(state: AppState, now = new Date()): DashboardData {
  const missions = Object.values(state.missions).filter((m) => m.status !== "RUNNING");
  const owned = new Set(missions.filter((m) => m.status === "PAID").flatMap((m) => m.basket.map((l) => l.id)));
  for (const item of state.cart) owned.add(item.id);
  return {
    missions: missions.map((m) => ({
      id: m.id,
      createdAt: m.createdAt,
      status: m.status,
      requestedBy: m.requestedBy,
      lines: m.basket.map((l) => ({ category: l.category, priceCents: l.priceCents, quantity: l.quantity })),
      quarantined: m.flags.filter((f) => f.severity === "critical" && f.candidateId).map((f) => f.code),
    })),
    spentCents: committedThisMonth(state.ledger, now),
    monthlyBudgetCents: state.policy.monthlyBudgetCents,
    trending: trending(state, owned),
  };
}
