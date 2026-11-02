import type { Preferences } from "./preferences";

export type AgentName =
  | "Intake"
  | "Scout"
  | "Risk Sentinel"
  | "Deal Analyst"
  | "Policy Guardian"
  | "Treasurer"
  | "Auditor";

/** How a step was produced, shown in the UI so nothing simulated looks real. */
export type StepSource = "ai" | "rules" | "live-api" | "sample-data" | "simulated";

export interface Policy {
  autoApproveLimitCents: number;
  perPurchaseLimitCents: number;
  monthlyBudgetCents: number;
  maxPurchasesPerDay: number;
  blockedCategories: string[];
  blockedDomains: string[];
}

export interface RequestedItem {
  query: string;
  quantity: number;
}

export interface Candidate {
  id: string;
  title: string;
  description: string;
  category: string;
  brand: string;
  domain: string;
  url: string;
  imageUrl?: string;
  /** Main colours as hex, when the catalog knows them. */
  colors?: string[];
  priceCents: number;
  compareAtCents?: number;
  currency: string;
  query: string;
  quantity: number;
}

export type RiskSeverity = "warn" | "critical";

export interface RiskFlag {
  candidateId?: string;
  title?: string;
  severity: RiskSeverity;
  code: string;
  detail: string;
}

export interface BasketLine extends Candidate {
  reason: string;
}

export type PolicyDecision = "AUTO_APPROVE" | "NEEDS_HUMAN" | "BLOCK";

export interface PolicyCheck {
  rule: string;
  outcome: "pass" | "escalate" | "block";
  detail: string;
}

export interface LedgerEntry {
  missionId: string;
  cents: number;
  at: string;
  titles: string[];
  status: "reserved" | "captured" | "refunded" | "released";
}

export interface Mandate {
  missionId: string;
  amountCents: number;
  basketHash: string;
  expiresAt: string;
  signature: string;
}

export type MissionStatus =
  | "RUNNING"
  | "NEEDS_HUMAN"
  | "AWAITING_PAYER"
  | "PAID"
  | "REFUNDED"
  | "BLOCKED"
  | "REJECTED"
  | "CANCELLED"
  | "EXPIRED"
  | "FAILED";

export interface AgentEvent {
  seq: number;
  at: string;
  agent: AgentName | "Human";
  source: StepSource;
  message: string;
  prevHash: string;
  hash: string;
}

/** A PayPal account the owner saved so agents can pay without the approval page. */
export interface Wallet {
  vaultId: string;
  email?: string;
  connectedAt: string;
}

export interface CartItem extends Candidate {
  /** The mission whose screening cleared this product. */
  sourceMissionId: string;
}

export interface Mission {
  id: string;
  /** Bought from the cart page rather than by a shopping mission. */
  fromCart?: boolean;
  /** A test mission with a fake scam listing planted among the results. */
  safetyTest?: boolean;
  /** PayPal took the payment but has not finished settling it. */
  capturePending?: boolean;
  /** Autopay tried the saved account first and could not pay; "revoked" means the owner removed it in PayPal. */
  autopayFailed?: "revoked" | "failed";
  /** Times PayPal declined the funding source, so a retry counts as a new capture. */
  declines?: number;
  /** Part of totalCents. Only cart orders carry tax. */
  taxCents?: number;
  prompt: string;
  createdAt: string;
  status: MissionStatus;
  budgetCents: number | null;
  requested: RequestedItem[];
  preferences?: Preferences;
  /** Every listing that passed relevance and risk screening, for the user to explore. */
  alternatives?: Candidate[];
  /** Goes up when the user picks another product, so PayPal treats the new order as new. */
  revision?: number;
  basket: BasketLine[];
  totalCents: number;
  flags: RiskFlag[];
  decision?: PolicyDecision;
  checks: PolicyCheck[];
  mandate?: Mandate;
  orderId?: string;
  captureId?: string;
  approvalUrl?: string;
  paymentMode?: "sandbox" | "simulated";
  summary?: string;
  events: AgentEvent[];
}

export type StreamMessage =
  | { type: "event"; missionId: string; event: AgentEvent }
  | { type: "mission"; mission: Mission }
  | { type: "error"; message: string };
