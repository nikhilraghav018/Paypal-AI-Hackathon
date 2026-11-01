import { basketTotal, riskRules } from "./agents";
import { evaluatePolicy } from "./policy";
import { getState } from "./store";
import type { BasketLine, Candidate, CartItem, Mission, PolicyDecision, RiskFlag } from "./types";

// An estimate shown on the cart and charged in the sandbox order. Real tax depends on where an order ships.
export const TAX_RATE = 0.08;
export const MAX_QUANTITY = 10;
export const MAX_CART_LINES = 20;

export class CartError extends Error {}

export function cartTotals(items: Candidate[]) {
  const subtotalCents = basketTotal(items);
  const taxCents = Math.round(subtotalCents * TAX_RATE);
  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}

/** Prices come from the mission's screened record, never from the browser. */
export function addToCart(missionId: string, candidateId: string): CartItem[] {
  const state = getState();
  const mission = state.missions[missionId];
  if (!mission) throw new CartError("Mission not found.");
  const screened = mission.alternatives?.find((c) => c.id === candidateId) ?? mission.basket.find((l) => l.id === candidateId);
  const flagged = mission.flags.some((f) => f.candidateId === candidateId && f.severity === "critical");
  if (!screened || flagged) throw new CartError("That product is not one of the screened options.");

  const existing = state.cart.find((item) => item.id === candidateId);
  if (existing) {
    existing.quantity = Math.min(MAX_QUANTITY, existing.quantity + 1);
    return state.cart;
  }
  if (state.cart.length >= MAX_CART_LINES) throw new CartError(`A cart can hold ${MAX_CART_LINES} different products.`);
  state.cart.push({
    id: screened.id,
    title: screened.title,
    description: screened.description,
    category: screened.category,
    brand: screened.brand,
    domain: screened.domain,
    url: screened.url,
    imageUrl: screened.imageUrl,
    colors: screened.colors,
    priceCents: screened.priceCents,
    compareAtCents: screened.compareAtCents,
    currency: screened.currency,
    query: screened.query,
    quantity: Math.min(MAX_QUANTITY, screened.quantity),
    sourceMissionId: missionId,
  });
  return state.cart;
}

export function setCartQuantity(itemId: string, quantity: number): CartItem[] {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    throw new CartError(`Quantity must be between 1 and ${MAX_QUANTITY}.`);
  }
  const item = getState().cart.find((i) => i.id === itemId);
  if (!item) throw new CartError("That product is no longer in your cart.");
  item.quantity = quantity;
  return getState().cart;
}

export function removeFromCart(itemId: string): CartItem[] {
  const state = getState();
  state.cart = state.cart.filter((item) => item.id !== itemId);
  return state.cart;
}

/**
 * After a cart order is paid, takes out what was bought and keeps anything added since. The
 * searches behind those items are dropped too, so the cart order alone records the purchase,
 * unless one was itself paid for or still has an item waiting in the cart.
 */
export function removePurchased(basket: BasketLine[]): void {
  const state = getState();
  const sources = state.cart.filter((item) => basket.some((line) => line.id === item.id)).map((item) => item.sourceMissionId);
  state.cart = state.cart.flatMap((item) => {
    const bought = basket.find((line) => line.id === item.id)?.quantity ?? 0;
    return item.quantity > bought ? [{ ...item, quantity: item.quantity - bought }] : [];
  });
  for (const id of sources) {
    if (state.cart.some((item) => item.sourceMissionId === id)) continue;
    const status = state.missions[id]?.status;
    if (!status || status === "PAID" || status === "REFUNDED") continue;
    delete state.missions[id];
    state.ledger = state.ledger.filter((e) => e.missionId !== id);
  }
}

/** Orders a cart checkout replaces, so their budget holds don't count against the cart. */
export function missionsReplacedByCart(): Mission[] {
  const state = getState();
  const sources = new Set(state.cart.map((item) => item.sourceMissionId));
  return Object.values(state.missions).filter(
    (m) => m.status === "AWAITING_PAYER" && (m.fromCart || sources.has(m.id)),
  );
}

export function reviewCart(now: Date): {
  flags: RiskFlag[];
  decision: PolicyDecision;
  checks: ReturnType<typeof evaluatePolicy>["checks"];
} {
  const state = getState();
  const replaced = new Set(missionsReplacedByCart().map((m) => m.id));
  const ledger = state.ledger.filter((e) => !replaced.has(e.missionId));
  const earlierWarnings = state.cart.flatMap((item) =>
    (state.missions[item.sourceMissionId]?.flags ?? []).filter((f) => f.candidateId === item.id && f.severity === "warn"),
  );
  const fresh = riskRules(state.cart, state.policy, ledger, now);
  const flags = [...fresh, ...earlierWarnings.filter((w) => !fresh.some((f) => f.candidateId === w.candidateId && f.code === w.code))];
  const verdict = evaluatePolicy({
    basket: state.cart.map((item) => ({ ...item, reason: "" })),
    totalCents: cartTotals(state.cart).totalCents,
    budgetCents: null,
    flags,
    policy: state.policy,
    ledger,
    now,
  });
  return { flags, ...verdict };
}
