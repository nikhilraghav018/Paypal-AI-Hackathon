import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { AgentEvent, BasketLine, Mandate } from "./types";
import { RESERVATION_MS } from "./policy";

export const GENESIS_HASH = "0".repeat(64);

const processSecret = randomBytes(32).toString("hex");

function secret(): string {
  return process.env.MANDATE_SECRET || processSecret;
}

export function hashEvent(event: Omit<AgentEvent, "hash">): string {
  return createHash("sha256")
    .update(JSON.stringify([event.seq, event.at, event.agent, event.source, event.message, event.prevHash]))
    .digest("hex");
}

/** Returns the seq of the first altered event, or null if the chain is intact. */
export function firstBrokenEvent(events: AgentEvent[]): number | null {
  let prev = GENESIS_HASH;
  for (const event of events) {
    const { hash, ...rest } = event;
    if (event.prevHash !== prev || hashEvent(rest) !== hash) return event.seq;
    prev = hash;
  }
  return null;
}

export function basketHash(basket: BasketLine[]): string {
  const canonical = basket.map((l) => [l.id, l.title, l.domain, l.priceCents, l.quantity, l.currency]);
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

function sign(fields: Omit<Mandate, "signature">): string {
  return createHmac("sha256", secret())
    .update(JSON.stringify([fields.missionId, fields.amountCents, fields.basketHash, fields.expiresAt]))
    .digest("hex");
}

/** Only the Policy Guardian's approval path issues these; the Treasurer cannot pay without one. */
export function issueMandate(missionId: string, basket: BasketLine[], amountCents: number, now: Date): Mandate {
  const fields = {
    missionId,
    amountCents,
    basketHash: basketHash(basket),
    expiresAt: new Date(now.getTime() + RESERVATION_MS).toISOString(),
  };
  return { ...fields, signature: sign(fields) };
}

export function mandateProblem(
  mandate: Mandate | undefined,
  expected: { missionId: string; amountCents: number; basket: BasketLine[]; now: Date },
): string | null {
  if (!mandate) return "No spending mandate has been issued.";
  const { signature, ...fields } = mandate;
  const actual = Buffer.from(signature, "hex");
  const valid = Buffer.from(sign(fields), "hex");
  if (actual.length !== valid.length || !timingSafeEqual(actual, valid)) return "Mandate signature is invalid.";
  if (mandate.missionId !== expected.missionId) return "Mandate belongs to another mission.";
  if (mandate.amountCents !== expected.amountCents) return "Mandate amount does not match the basket.";
  if (mandate.basketHash !== basketHash(expected.basket)) return "Basket changed after approval.";
  if (new Date(mandate.expiresAt).getTime() <= expected.now.getTime()) return "Mandate has expired.";
  return null;
}
