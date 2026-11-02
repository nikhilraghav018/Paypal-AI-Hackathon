import type { Mission } from "@/lib/types";
import type { Outcome } from "./backdrop";

export const OUTCOME_STYLE: Record<Outcome, { dot: string; card: string }> = {
  paid: { dot: "#4ee0a6", card: "rgb(78 224 166 / 0.1)" },
  blocked: { dot: "#ff6b5f", card: "rgb(255 107 95 / 0.1)" },
  cancelled: { dot: "#8b93a1", card: "rgb(139 147 161 / 0.1)" },
  waiting: { dot: "#f0c56c", card: "rgb(240 197 108 / 0.09)" },
  refunded: { dot: "#7db7ff", card: "rgb(125 183 255 / 0.1)" },
};

export const STATUS: Record<Mission["status"], { label: string; tone: string; outcome: Outcome }> = {
  RUNNING: { label: "Running", tone: "bg-line text-ink", outcome: "waiting" },
  NEEDS_HUMAN: { label: "Needs your approval", tone: "bg-warn-soft text-warn", outcome: "waiting" },
  AWAITING_PAYER: { label: "Cleared, awaiting PayPal", tone: "bg-warn-soft text-warn", outcome: "waiting" },
  PAID: { label: "Bought", tone: "bg-accent-soft text-accent", outcome: "paid" },
  REFUNDED: { label: "Refunded", tone: "bg-line text-ink", outcome: "refunded" },
  BLOCKED: { label: "Blocked", tone: "bg-danger-soft text-danger", outcome: "blocked" },
  REJECTED: { label: "Cancelled by you", tone: "bg-line text-ink", outcome: "cancelled" },
  CANCELLED: { label: "Cancelled by you", tone: "bg-line text-ink", outcome: "cancelled" },
  EXPIRED: { label: "Expired before payment", tone: "bg-line text-ink", outcome: "cancelled" },
  FAILED: { label: "Stopped safely", tone: "bg-danger-soft text-danger", outcome: "blocked" },
};
