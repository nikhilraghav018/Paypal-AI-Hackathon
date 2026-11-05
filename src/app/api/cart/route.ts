import { connection } from "next/server";
import { CartError, MAX_QUANTITY, TAX_RATE, addToCart, cartTotals, removeFromCart, reviewCart, setCartQuantity } from "@/lib/cart";
import { getState, saveState } from "@/lib/store";
import { forVisitor } from "@/lib/visitor";

function snapshot() {
  const { cart } = getState();
  const review = reviewCart(new Date());
  return {
    items: cart,
    ...cartTotals(cart),
    taxRate: TAX_RATE,
    maxQuantity: MAX_QUANTITY,
    decision: review.decision,
    reasons: review.checks.filter((c) => c.outcome === (review.decision === "BLOCK" ? "block" : "escalate")).map((c) => c.detail),
  };
}

async function respond(change: (body: Record<string, unknown>) => void, request: Request) {
  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  try {
    change(body);
    saveState();
    return Response.json(snapshot());
  } catch (error) {
    if (error instanceof CartError) return Response.json({ error: error.message }, { status: 409 });
    throw error;
  }
}

async function handleGET() {
  await connection();
  return Response.json(snapshot());
}

function handlePOST(request: Request) {
  return respond((body) => addToCart(String(body.missionId), String(body.candidateId)), request);
}

function handlePATCH(request: Request) {
  return respond((body) => setCartQuantity(String(body.itemId), Number(body.quantity)), request);
}

function handleDELETE(request: Request) {
  return respond((body) => removeFromCart(String(body.itemId)), request);
}

export const GET = forVisitor(handleGET);
export const POST = forVisitor(handlePOST);
export const PATCH = forVisitor(handlePATCH);
export const DELETE = forVisitor(handleDELETE);
