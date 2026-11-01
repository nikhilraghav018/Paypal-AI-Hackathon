import type {
  BasketLine,
  LedgerEntry,
  Policy,
  PolicyCheck,
  PolicyDecision,
  RiskFlag,
} from "./types";

export const RESERVATION_MS = 15 * 60 * 1000;

export const DEFAULT_POLICY: Policy = {
  autoApproveLimitCents: 5000,
  perPurchaseLimitCents: 20000,
  monthlyBudgetCents: 50000,
  maxPurchasesPerDay: 5,
  blockedCategories: ["alcohol", "tobacco", "gambling", "weapons", "crypto"],
  blockedDomains: [],
  killSwitch: false,
};

const CATEGORY_TERMS: Record<string, RegExp> = {
  alcohol: /\b(alcohol|beer|wine|whisk(e)?y|vodka|tequila|liquor)\b/i,
  tobacco: /\b(tobacco|cigar(ette)?s?|vape|nicotine)\b/i,
  gambling: /\b(gambling|casino|lottery|betting)\b/i,
  weapons: /\b(firearm|handgun|rifle|ammunition|ammo)\b/i,
  crypto: /\b(crypto(currency)?|bitcoin|ethereum|nft)\b/i,
};

// Whole catalog path segments, so "Wine Glasses" and "Food, Beverages & Tobacco" don't count.
const CATEGORY_SEGMENTS: Record<string, RegExp> = {
  alcohol: /^(alcoholic beverages|beer|wine|liquor|spirits|liquor & spirits|hard cider)$/i,
  tobacco: /^(tobacco|tobacco products|cigarettes|cigars|vaporizers|vapes|e-cigarettes|electronic cigarettes)$/i,
  gambling: /^(gambling|lottery tickets)$/i,
  weapons: /^(firearms|guns|ammunition|weapons)$/i,
  crypto: /^(cryptocurrency|crypto)$/i,
};

export function matchesCategory(category: string, text: string): boolean {
  const terms = CATEGORY_TERMS[category.toLowerCase()];
  if (terms) return terms.test(text);
  return text.toLowerCase().includes(category.toLowerCase());
}

/**
 * A catalog path says what a product is, while a title may only mention a word: the band
 * "Cigarettes After Sex" is Music and "Coffee Is My Morning Wine" socks are Clothing. Title
 * words only decide when there is no path. The Risk Sentinel's AI can still add a block.
 */
export function restrictedCategory(line: { title: string; category: string }, blocked: string[]) {
  if (line.category.includes(">")) {
    const segments = line.category.split(">").map((segment) => segment.trim());
    return blocked.find((category) => {
      const pattern = CATEGORY_SEGMENTS[category.toLowerCase()];
      return segments.some((segment) => (pattern ? pattern.test(segment) : segment.toLowerCase() === category.toLowerCase()));
    });
  }
  const text = `${line.title} ${line.category}`;
  return blocked.find((category) => matchesCategory(category, text));
}

export function usd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function isActive(entry: LedgerEntry, now: Date): boolean {
  if (entry.status === "captured") return true;
  return entry.status === "reserved" && now.getTime() - new Date(entry.at).getTime() < RESERVATION_MS;
}

export function committedThisMonth(ledger: LedgerEntry[], now: Date, excludeMissionId?: string): number {
  return ledger
    .filter((e) => {
      const at = new Date(e.at);
      return (
        e.missionId !== excludeMissionId &&
        isActive(e, now) &&
        at.getUTCFullYear() === now.getUTCFullYear() &&
        at.getUTCMonth() === now.getUTCMonth()
      );
    })
    .reduce((sum, e) => sum + e.cents, 0);
}

export function purchasesLast24h(ledger: LedgerEntry[], now: Date, excludeMissionId?: string): number {
  return ledger.filter(
    (e) =>
      e.missionId !== excludeMissionId &&
      isActive(e, now) &&
      now.getTime() - new Date(e.at).getTime() < 24 * 60 * 60 * 1000,
  ).length;
}

/**
 * The spending decision. Deterministic on purpose: no model output can reach
 * this function except as a basket of priced items, so prompt injection cannot
 * talk its way past a limit.
 */
export function evaluatePolicy(input: {
  basket: BasketLine[];
  totalCents: number;
  budgetCents: number | null;
  flags: RiskFlag[];
  policy: Policy;
  ledger: LedgerEntry[];
  now: Date;
  excludeMissionId?: string;
}): { decision: PolicyDecision; checks: PolicyCheck[] } {
  const { basket, totalCents, budgetCents, flags, policy, ledger, now, excludeMissionId } = input;
  const checks: PolicyCheck[] = [];
  const add = (rule: string, outcome: PolicyCheck["outcome"], detail: string) =>
    checks.push({ rule, outcome, detail });

  add(
    "Kill switch",
    policy.killSwitch ? "block" : "pass",
    policy.killSwitch ? "Kill switch is on, so all agent spending is frozen." : "Spending is enabled.",
  );

  add(
    "Basket present",
    basket.length > 0 && totalCents > 0 ? "pass" : "block",
    basket.length > 0 ? `${basket.length} item(s) totalling ${usd(totalCents)}.` : "No eligible items to buy.",
  );

  const nonUsd = basket.filter((l) => l.currency !== "USD");
  add(
    "Currency",
    nonUsd.length ? "block" : "pass",
    nonUsd.length ? `Non-USD price on: ${nonUsd.map((l) => l.title).join(", ")}.` : "All prices are in USD.",
  );

  if (budgetCents !== null) {
    add(
      "Mission budget",
      totalCents > budgetCents ? "block" : "pass",
      `${usd(totalCents)} against the ${usd(budgetCents)} you asked for.`,
    );
  }

  add(
    "Per-purchase limit",
    totalCents > policy.perPurchaseLimitCents ? "block" : "pass",
    `${usd(totalCents)} against a ${usd(policy.perPurchaseLimitCents)} limit.`,
  );

  const committed = committedThisMonth(ledger, now, excludeMissionId);
  add(
    "Monthly budget",
    committed + totalCents > policy.monthlyBudgetCents ? "block" : "pass",
    `${usd(committed)} already committed plus ${usd(totalCents)}, against ${usd(policy.monthlyBudgetCents)}.`,
  );

  const count = purchasesLast24h(ledger, now, excludeMissionId);
  add(
    "Purchase velocity",
    count >= policy.maxPurchasesPerDay ? "block" : "pass",
    `${count} purchase(s) in 24 hours, limit ${policy.maxPurchasesPerDay}.`,
  );

  const restricted = basket.flatMap((l) => {
    const category = restrictedCategory(l, policy.blockedCategories);
    return category ? [`${l.title} (${category})`] : [];
  });
  add(
    "Restricted categories",
    restricted.length ? "block" : "pass",
    restricted.length ? `Blocked: ${restricted.join(", ")}.` : "No restricted categories.",
  );

  const domains = basket.filter((l) =>
    policy.blockedDomains.some((d) => l.domain === d || l.domain.endsWith(`.${d}`)),
  );
  add(
    "Blocked merchants",
    domains.length ? "block" : "pass",
    domains.length ? `Blocked: ${domains.map((l) => l.domain).join(", ")}.` : "No blocked merchants.",
  );

  const basketIds = new Set(basket.map((l) => l.id));
  const relevant = flags.filter((f) => !f.candidateId || basketIds.has(f.candidateId));
  const critical = relevant.filter((f) => f.severity === "critical");
  const warnings = relevant.filter((f) => f.severity === "warn");
  add(
    "Risk signals",
    critical.length ? "block" : warnings.length ? "escalate" : "pass",
    relevant.length ? relevant.map((f) => f.detail).join(" ") : "No risk signals on the chosen items.",
  );

  add(
    "Auto-approve limit",
    totalCents > policy.autoApproveLimitCents ? "escalate" : "pass",
    `${usd(totalCents)} against a ${usd(policy.autoApproveLimitCents)} auto-approve limit.`,
  );

  const decision: PolicyDecision = checks.some((c) => c.outcome === "block")
    ? "BLOCK"
    : checks.some((c) => c.outcome === "escalate")
      ? "NEEDS_HUMAN"
      : "AUTO_APPROVE";

  return { decision, checks };
}
