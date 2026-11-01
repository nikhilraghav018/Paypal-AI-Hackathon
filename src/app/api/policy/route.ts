import { z } from "zod";
import { committedThisMonth } from "@/lib/policy";
import { getState, saveState } from "@/lib/store";

const cents = z.number().int().min(0).max(100_000_00);

const PolicyUpdate = z
  .object({
    autoApproveLimitCents: cents,
    perPurchaseLimitCents: cents,
    monthlyBudgetCents: cents,
    maxPurchasesPerDay: z.number().int().min(0).max(100),
    blockedCategories: z.array(z.string().trim().min(1).max(40)).max(30),
    blockedDomains: z.array(z.string().trim().toLowerCase().min(1).max(100)).max(50),
  })
  .partial();

function snapshot() {
  const { policy, ledger } = getState();
  return { policy, committedCents: committedThisMonth(ledger, new Date()) };
}

export async function GET() {
  return Response.json(snapshot());
}

export async function PUT(request: Request) {
  const parsed = PolicyUpdate.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid policy." }, { status: 400 });
  const state = getState();
  state.policy = { ...state.policy, ...parsed.data };
  saveState();
  return Response.json(snapshot());
}
