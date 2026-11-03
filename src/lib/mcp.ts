import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { expireStaleOrders, runMission } from "./orchestrator";
import { committedThisMonth, usd } from "./policy";
import { allowMissionRun } from "./rate-limit";
import { getState } from "./store";
import type { Mission } from "./types";

// Tells the calling agent what it may do next. It can ask and check, but only the owner approves.
const NEXT_STEP: Record<Mission["status"], string> = {
  RUNNING: "Still running. Check again shortly.",
  NEEDS_HUMAN: "This is above what agents may spend alone, so the owner must approve it in Velora. You cannot approve it.",
  AWAITING_PAYER: "Every check passed. The owner finishes payment on PayPal from Velora, because autopay is off or the saved account could not pay.",
  PAID: "Paid with the owner's saved PayPal account. Nothing more to do.",
  REFUNDED: "The owner refunded this purchase.",
  BLOCKED: "Blocked by the owner's rules. Do not retry the same purchase. Tell the owner why it was blocked.",
  REJECTED: "The owner turned this purchase down.",
  CANCELLED: "The owner cancelled this purchase.",
  EXPIRED: "The approval ran out before payment, so nothing was charged.",
  FAILED: "Stopped safely before any money moved.",
};

export function missionReport(mission: Mission, origin: string) {
  return {
    missionId: mission.id,
    status: mission.status,
    items: mission.basket.map((line) => ({ title: line.title, quantity: line.quantity, price: usd(line.priceCents), store: line.domain })),
    total: usd(mission.totalCents),
    explanation: mission.summary ?? null,
    failedChecks: mission.checks.filter((c) => c.outcome !== "pass").map((c) => `${c.rule}: ${c.detail}`),
    nextStep: mission.status === "PAID" && mission.capturePending ? "Paid. PayPal is still settling the payment." : NEXT_STEP[mission.status],
    ownerLink: `${origin}/?mission=${mission.id}`,
  };
}

const reply = (data: object) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] });
const refuse = (text: string) => ({ content: [{ type: "text" as const, text }], isError: true });

/** Agent names show up in the owner's audit trail, so they are kept short and plain. */
export function agentLabel(name: string | undefined): string {
  const cleaned = (name ?? "").replace(/[^\w .-]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
  return cleaned || "An AI agent";
}

/**
 * Lets any MCP client, such as Claude or ChatGPT, shop through Velora. Requests go through the same
 * agents, limits, signed approvals and PayPal flow as the app. There is deliberately no tool to
 * approve, refund or change limits: those stay with the owner.
 */
export function createVeloraServer(origin: string): McpServer {
  const server = new McpServer({ name: "velora", version: "1.0.0" });

  server.registerTool(
    "get_spending_rules",
    {
      title: "Get spending rules",
      description: "Shows the owner's spending limits, how much budget is left this month, blocked categories and whether autopay is on. Call this before planning a purchase.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      expireStaleOrders();
      const { policy, ledger, wallet } = getState();
      const spent = committedThisMonth(ledger, new Date());
      return reply({
        agentsMaySpendAlone: `Up to ${usd(policy.autoApproveLimitCents)} per purchase, and only when autopay is on`,
        largestPurchase: usd(policy.perPurchaseLimitCents),
        monthlyBudget: usd(policy.monthlyBudgetCents),
        leftThisMonth: usd(Math.max(0, policy.monthlyBudgetCents - spent)),
        maxPurchasesPerDay: policy.maxPurchasesPerDay,
        alwaysBlocked: policy.blockedCategories,
        autopay: wallet ? "on" : "off",
        approvals: "Anything above the agent limit waits for the owner. You cannot approve purchases or change limits.",
      });
    },
  );

  server.registerTool(
    "request_purchase",
    {
      title: "Request a purchase",
      description:
        "Asks Velora's agents to find, screen and buy something for the owner, for example \"a black ink pen under $5\". Velora searches real listings, removes scams and unrelated products, checks the owner's rules and pays with PayPal only if every check passes. Returns what was chosen, the decision and what happens next.",
      inputSchema: {
        request: z.string().trim().min(3).max(500).describe("What to buy, in plain words, with a budget if there is one."),
        requested_by: z.string().max(60).optional().describe("Your name as an agent or app, such as Claude. The owner sees it in the audit trail."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ request, requested_by }) => {
      if (!allowMissionRun()) return refuse("Velora's hourly mission limit was reached. Try again later.");
      const mission = await runMission(request, origin, undefined, {}, false, agentLabel(requested_by));
      return reply(missionReport(mission, origin));
    },
  );

  server.registerTool(
    "check_purchase",
    {
      title: "Check a purchase",
      description: "Shows the current status of a purchase requested earlier, for example after the owner approved or paid it.",
      inputSchema: { mission_id: z.string().uuid().describe("The missionId returned by request_purchase.") },
      annotations: { readOnlyHint: true },
    },
    async ({ mission_id }) => {
      expireStaleOrders();
      const mission = getState().missions[mission_id];
      return mission ? reply(missionReport(mission, origin)) : refuse("No purchase has that missionId.");
    },
  );

  return server;
}
