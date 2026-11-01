import { randomUUID } from "node:crypto";
import { analystAgent, auditorAgent, basketTotal, intakeAgent, riskAgent, scoutAgent, summaryByRules } from "./agents";
import { GENESIS_HASH, hashEvent, issueMandate, mandateProblem } from "./integrity";
import { captureOrder, createOrder, getOrderAmount, paypalConfigured, refundCapture, type PayPalWebhookEvent } from "./paypal";
import { evaluatePolicy, usd } from "./policy";
import { preferenceLabels, type Preferences } from "./preferences";
import { getState, saveState } from "./store";
import type { AgentEvent, AgentName, Mission, StepSource } from "./types";

type Emit = (mission: Mission, event: AgentEvent) => void;

export class MissionError extends Error {}

function record(
  mission: Mission,
  agent: AgentEvent["agent"],
  source: StepSource,
  message: string,
  emit?: Emit,
) {
  const base = {
    seq: mission.events.length + 1,
    at: new Date().toISOString(),
    agent,
    source,
    message,
    prevHash: mission.events.at(-1)?.hash ?? GENESIS_HASH,
  };
  const event: AgentEvent = { ...base, hash: hashEvent(base) };
  mission.events.push(event);
  emit?.(mission, event);
}

function requireMission(id: string): Mission {
  const mission = getState().missions[id];
  if (!mission) throw new MissionError("Mission not found.");
  return mission;
}

function setLedger(missionId: string, status: "reserved" | "captured" | "refunded" | "released", mission: Mission) {
  const { ledger } = getState();
  const entry = ledger.find((e) => e.missionId === missionId);
  if (entry) {
    entry.status = status;
    return;
  }
  ledger.push({
    missionId,
    cents: mission.totalCents,
    at: new Date().toISOString(),
    titles: mission.basket.map((l) => l.title),
    status,
  });
}

/** Runs the agents in order. Each has one job and sees only what it needs. */
export async function runMission(
  prompt: string,
  returnBaseUrl: string,
  emit?: Emit,
  chosenPreferences: Preferences = {},
): Promise<Mission> {
  const state = getState();
  const mission: Mission = {
    id: randomUUID(),
    prompt,
    createdAt: new Date().toISOString(),
    status: "RUNNING",
    budgetCents: null,
    requested: [],
    basket: [],
    totalCents: 0,
    flags: [],
    checks: [],
    events: [],
  };
  state.missions[mission.id] = mission;
  const log = (agent: AgentName, source: StepSource, message: string) => record(mission, agent, source, message, emit);

  try {
    const intake = await intakeAgent(prompt, chosenPreferences);
    mission.requested = intake.requested;
    mission.preferences = intake.preferences;
    const preferenceText = preferenceLabels(intake.preferences).join(", ");
    mission.budgetCents = intake.budgetCents;
    log(
      "Intake",
      intake.source,
      `Understood ${intake.requested.map((i) => `${i.quantity} x ${i.query}`).join(", ")}; budget ${
        intake.budgetCents === null ? "not stated" : usd(intake.budgetCents)
      }.${preferenceText ? ` Preferences: ${preferenceText}.` : ""}`,
    );

    const scout = await scoutAgent(mission.requested, mission.budgetCents, mission.preferences);
    const dropped = scout.found - scout.candidates.length;
    log(
      "Scout",
      scout.source,
      `Found ${scout.found} listing(s)${scout.source === "sample-data" ? " in the sample catalog" : " on Channel3"}${
        scout.note ? ` (live search unavailable: ${scout.note})` : ""
      }.${
        dropped === 0
          ? ""
          : scout.candidates.length
            ? ` Kept ${scout.candidates.length} that are really what you asked for.`
            : " None of them are really what you asked for."
      }`,
    );

    const now = new Date();
    const risk = await riskAgent(scout.candidates, state.policy, state.ledger, now);
    mission.flags = risk.flags;
    mission.alternatives = risk.safe;
    log(
      "Risk Sentinel",
      risk.source,
      risk.quarantined
        ? `Quarantined ${risk.quarantined} listing(s): ${[
            ...new Set(risk.flags.filter((f) => f.severity === "critical").map((f) => f.code)),
          ].join(", ")}. ${risk.safe.length} remain.`
        : `Screened ${scout.candidates.length} listing(s) and quarantined none.`,
    );

    const analyst = await analystAgent(mission.requested, risk.safe, risk.flags, mission.budgetCents);
    mission.basket = analyst.basket;
    mission.totalCents = basketTotal(analyst.basket);
    const missing = mission.requested.length - analyst.basket.length;
    if (missing > 0 && analyst.basket.length > 0) {
      mission.flags.push({
        severity: "warn",
        code: "INCOMPLETE_BASKET",
        detail: `${missing} requested item(s) had no safe listing, so the basket is incomplete.`,
      });
    }
    log(
      "Deal Analyst",
      analyst.source,
      analyst.basket.length
        ? `Selected ${analyst.basket.map((l) => l.title).join(", ")} for ${usd(mission.totalCents)}${
            missing ? `; ${missing} requested item(s) had no safe listing` : ""
          }.`
        : "No safe listing matched the request.",
    );

    const verdict = evaluatePolicy({
      basket: mission.basket,
      totalCents: mission.totalCents,
      budgetCents: mission.budgetCents,
      flags: mission.flags,
      policy: state.policy,
      ledger: state.ledger,
      now,
    });
    mission.decision = verdict.decision;
    mission.checks = verdict.checks;
    const notPassed = verdict.checks.filter((c) => c.outcome !== "pass");
    log(
      "Policy Guardian",
      "rules",
      verdict.decision === "AUTO_APPROVE"
        ? `All ${verdict.checks.length} checks passed.`
        : `${verdict.decision === "BLOCK" ? "Blocked" : "Needs human approval"}: ${notPassed.map((c) => c.rule).join(", ")}.`,
    );

    const audit = await auditorAgent(mission);
    mission.summary = audit.summary;
    log("Auditor", audit.source, audit.summary);

    if (verdict.decision === "BLOCK") mission.status = "BLOCKED";
    else if (verdict.decision === "NEEDS_HUMAN") mission.status = "NEEDS_HUMAN";
    else await startCheckout(mission, returnBaseUrl, emit);
  } catch (error) {
    mission.status = "FAILED";
    log("Auditor", "rules", `Mission stopped safely: ${error instanceof Error ? error.message : "unknown error"}`);
  }
  saveState();
  return mission;
}

/** Re-checks policy immediately before money moves, then hands off to the Treasurer. */
async function startCheckout(mission: Mission, returnBaseUrl: string, emit?: Emit) {
  const state = getState();
  const now = new Date();
  const verdict = evaluatePolicy({
    basket: mission.basket,
    totalCents: mission.totalCents,
    budgetCents: mission.budgetCents,
    flags: mission.flags,
    policy: state.policy,
    ledger: state.ledger,
    now,
    excludeMissionId: mission.id,
  });
  if (verdict.decision === "BLOCK") {
    mission.checks = verdict.checks;
    mission.decision = "BLOCK";
    mission.status = "BLOCKED";
    record(mission, "Policy Guardian", "rules", "Blocked on final re-check before payment.", emit);
    return;
  }

  mission.mandate = issueMandate(mission.id, mission.basket, mission.totalCents, now);
  const problem = mandateProblem(mission.mandate, {
    missionId: mission.id,
    amountCents: mission.totalCents,
    basket: mission.basket,
    now,
  });
  if (problem) throw new MissionError(problem);

  const returnUrl = `${returnBaseUrl}/api/paypal/return?mission=${mission.id}`;
  if (paypalConfigured()) {
    const order = await createOrder({
      missionId: mission.id,
      basket: mission.basket,
      totalCents: mission.totalCents,
      returnUrl,
      cancelUrl: `${returnUrl}&cancelled=1`,
      revision: mission.revision,
    });
    mission.orderId = order.orderId;
    mission.approvalUrl = order.approvalUrl;
    mission.paymentMode = "sandbox";
    record(mission, "Treasurer", "live-api", `Created PayPal sandbox order ${order.orderId} for ${usd(mission.totalCents)}.`, emit);
  } else {
    mission.orderId = `SIM-${mission.id.slice(0, 8)}`;
    mission.approvalUrl = `${returnUrl}&token=${mission.orderId}`;
    mission.paymentMode = "simulated";
    record(mission, "Treasurer", "simulated", `Prepared a simulated order for ${usd(mission.totalCents)} because no sandbox keys are set.`, emit);
  }
  setLedger(mission.id, "reserved", mission);
  mission.status = "AWAITING_PAYER";
}

export async function approveMission(id: string, returnBaseUrl: string): Promise<Mission> {
  const mission = requireMission(id);
  if (mission.status !== "NEEDS_HUMAN") throw new MissionError("This mission is not waiting for approval.");
  record(mission, "Human", "rules", `Approved ${usd(mission.totalCents)} for this mission.`);
  mission.summary = `${mission.summary ?? ""} You approved this purchase.`.trim();
  try {
    await startCheckout(mission, returnBaseUrl);
  } catch (error) {
    mission.status = "FAILED";
    record(mission, "Treasurer", "rules", `Payment could not start: ${error instanceof Error ? error.message : "unknown error"}`);
  }
  saveState();
  return mission;
}

/** Swaps a basket item for another screened listing, then runs policy and checkout again. */
export async function chooseProduct(id: string, query: string, candidateId: string, returnBaseUrl: string): Promise<Mission> {
  const mission = requireMission(id);
  if (!["NEEDS_HUMAN", "AWAITING_PAYER", "BLOCKED"].includes(mission.status)) {
    throw new MissionError("This purchase can no longer be changed.");
  }
  // Price and details come from the screened record, never from the browser.
  const candidate = mission.alternatives?.find((c) => c.id === candidateId && c.query === query);
  if (!candidate) throw new MissionError("That product is not one of the screened options.");

  const state = getState();
  state.ledger = state.ledger.filter((e) => e.missionId !== id);
  const line = { ...candidate, reason: "You chose this one." };
  const position = mission.basket.findIndex((l) => l.query === query);
  if (position >= 0) mission.basket[position] = line;
  else mission.basket.push(line);
  mission.totalCents = basketTotal(mission.basket);
  mission.mandate = undefined;
  mission.orderId = undefined;
  mission.approvalUrl = undefined;
  mission.revision = (mission.revision ?? 0) + 1;
  record(mission, "Human", "rules", `Chose ${candidate.title} for ${usd(candidate.priceCents * candidate.quantity)}.`);

  const verdict = evaluatePolicy({
    basket: mission.basket,
    totalCents: mission.totalCents,
    budgetCents: mission.budgetCents,
    flags: mission.flags,
    policy: state.policy,
    ledger: state.ledger,
    now: new Date(),
    excludeMissionId: id,
  });
  mission.decision = verdict.decision;
  mission.checks = verdict.checks;
  mission.summary = summaryByRules(mission);
  try {
    if (verdict.decision === "BLOCK") mission.status = "BLOCKED";
    else if (verdict.decision === "NEEDS_HUMAN") mission.status = "NEEDS_HUMAN";
    else await startCheckout(mission, returnBaseUrl);
  } catch (error) {
    mission.status = "FAILED";
    record(mission, "Treasurer", "rules", `Payment could not start: ${error instanceof Error ? error.message : "unknown error"}`);
  }
  saveState();
  return mission;
}

export function rejectMission(id: string): Mission {
  const mission = requireMission(id);
  if (mission.status !== "NEEDS_HUMAN") throw new MissionError("This mission is not waiting for approval.");
  mission.status = "REJECTED";
  record(mission, "Human", "rules", "Rejected this purchase. No payment was started.");
  saveState();
  return mission;
}

export function cancelCheckout(id: string): Mission {
  const mission = requireMission(id);
  if (mission.status !== "AWAITING_PAYER") return mission;
  mission.status = "CANCELLED";
  setLedger(id, "released", mission);
  record(mission, "Human", "rules", "Cancelled this purchase. The reserved budget was released.");
  saveState();
  return mission;
}

/** Runs when the payer returns from PayPal. Verifies everything again before capturing. */
export async function completePayment(id: string, token: string | null): Promise<Mission> {
  const mission = requireMission(id);
  if (mission.status === "PAID") return mission;
  if (mission.status !== "AWAITING_PAYER") throw new MissionError("This mission is not awaiting payment.");
  if (!token || token !== mission.orderId) throw new MissionError("The returned order does not match this mission.");

  const fail = (reason: string) => {
    mission.status = "FAILED";
    setLedger(id, "released", mission);
    record(mission, "Treasurer", "rules", `Refused to capture: ${reason}`);
    saveState();
    return mission;
  };

  if (getState().policy.killSwitch) return fail("the kill switch was turned on before capture.");
  const problem = mandateProblem(mission.mandate, {
    missionId: id,
    amountCents: mission.totalCents,
    basket: mission.basket,
    now: new Date(),
  });
  if (problem) return fail(problem);

  try {
    if (mission.paymentMode === "sandbox") {
      const order = await getOrderAmount(token);
      if (order.cents !== mission.totalCents || order.currency !== "USD") {
        return fail(`PayPal order is ${order.cents} cents ${order.currency}, but the mandate allows ${mission.totalCents} cents USD.`);
      }
      const { captureId } = await captureOrder(token, id);
      mission.captureId = captureId;
      record(mission, "Treasurer", "live-api", `Captured ${usd(mission.totalCents)} in PayPal sandbox (capture ${captureId}).`);
    } else {
      mission.captureId = `SIMCAP-${id.slice(0, 8)}`;
      record(mission, "Treasurer", "simulated", `Simulated capture of ${usd(mission.totalCents)}. No PayPal call was made.`);
    }
  } catch (error) {
    return fail(error instanceof Error ? error.message : "capture failed");
  }

  mission.status = "PAID";
  setLedger(id, "captured", mission);
  saveState();
  return mission;
}

export async function refundMission(id: string): Promise<Mission> {
  const mission = requireMission(id);
  if (mission.status !== "PAID" || !mission.captureId) throw new MissionError("Only a paid mission can be refunded.");
  if (mission.paymentMode === "sandbox") {
    await refundCapture(mission.captureId, id);
    record(mission, "Treasurer", "live-api", `Refunded ${usd(mission.totalCents)} in PayPal sandbox and restored the budget.`);
  } else {
    record(mission, "Treasurer", "simulated", `Simulated a refund of ${usd(mission.totalCents)} and restored the budget.`);
  }
  mission.status = "REFUNDED";
  setLedger(id, "refunded", mission);
  saveState();
  return mission;
}

/** Applies a signature-verified PayPal event, so changes made outside the app still reach the budget. */
export function applyWebhookEvent(event: PayPalWebhookEvent): void {
  const state = getState();
  if (state.seenWebhookIds.includes(event.id)) return;
  state.seenWebhookIds.push(event.id);

  const resource = event.resource;
  const parentCapture = resource?.links?.find((l) => l.rel === "up")?.href?.split("/").pop();
  const captureId = event.event_type === "PAYMENT.CAPTURE.REFUNDED" ? parentCapture : resource?.id;
  const mission = Object.values(state.missions).find(
    (m) => (captureId && m.captureId === captureId) || (resource?.custom_id && m.id === resource.custom_id),
  );
  if (!mission) {
    saveState();
    return;
  }

  const cents = resource?.amount?.value === undefined ? null : Math.round(Number(resource.amount.value) * 100);
  const label = event.event_type.replace("PAYMENT.CAPTURE.", "").toLowerCase();
  if (event.event_type === "PAYMENT.CAPTURE.REFUNDED" || event.event_type === "PAYMENT.CAPTURE.REVERSED") {
    if (mission.status === "PAID" && cents === mission.totalCents) {
      mission.status = "REFUNDED";
      setLedger(mission.id, "refunded", mission);
      record(mission, "Treasurer", "live-api", `PayPal reported this payment ${label}. The budget was restored.`);
    } else if (mission.status === "PAID") {
      record(mission, "Treasurer", "live-api", `PayPal reported a partial ${label} of ${cents === null ? "an unknown amount" : usd(cents)}. The budget was not changed.`);
    }
  } else if (event.event_type === "PAYMENT.CAPTURE.DENIED" && mission.status === "PAID") {
    mission.status = "FAILED";
    setLedger(mission.id, "released", mission);
    record(mission, "Treasurer", "live-api", "PayPal denied this payment after capture. The budget was restored.");
  }
  saveState();
}
