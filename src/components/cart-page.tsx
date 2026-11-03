"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CartItem, Mission, PolicyDecision } from "@/lib/types";
import { Backdrop } from "./backdrop";
import { SiteNav } from "./site-nav";

interface Cart {
  items: CartItem[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  taxRate: number;
  maxQuantity: number;
  decision: PolicyDecision;
  reasons: string[];
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function CartLine({
  item,
  max,
  busy,
  onQuantity,
  onRemove,
}: {
  item: CartItem;
  max: number;
  busy: boolean;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
}) {
  const linkable = item.url.startsWith("https://") && !item.domain.endsWith(".example");
  return (
    <li className="flex gap-4 py-5 first:pt-0 last:pb-0">
      {item.imageUrl?.startsWith("https://") ? (
        // Catalog images come from many retailer hosts, so next/image can't list them.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.imageUrl} alt="" loading="lazy" className="h-24 w-24 shrink-0 rounded-2xl bg-white object-contain sm:h-28 sm:w-28" />
      ) : (
        <div className="neu-inset flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl text-2xl font-semibold text-muted sm:h-28 sm:w-28" aria-hidden>
          {item.title.charAt(0)}
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <p className="font-medium leading-snug break-words">{item.title}</p>
            <p className="mt-1 text-xs text-muted">
              {item.domain}
              {linkable && (
                <>
                  {" · "}
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-medium text-accent underline underline-offset-2">
                    View the product
                  </a>
                </>
              )}
            </p>
          </div>
          <div className="shrink-0 sm:text-right">
            <p className="font-mono font-semibold">{money(item.priceCents * item.quantity)}</p>
            {item.quantity > 1 && <p className="font-mono text-xs text-muted">{money(item.priceCents)} each</p>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="neu-inset inline-flex items-center rounded-xl">
            <button
              type="button"
              disabled={busy || item.quantity <= 1}
              onClick={() => onQuantity(item.quantity - 1)}
              aria-label={`Decrease quantity of ${item.title}`}
              className="h-9 w-9 rounded-xl text-lg disabled:opacity-35"
            >
              −
            </button>
            <span className="w-7 text-center font-mono text-sm" aria-label="Quantity">{item.quantity}</span>
            <button
              type="button"
              disabled={busy || item.quantity >= max}
              onClick={() => onQuantity(item.quantity + 1)}
              aria-label={`Increase quantity of ${item.title}`}
              className="h-9 w-9 rounded-xl text-lg disabled:opacity-35"
            >
              +
            </button>
          </div>
          <button type="button" disabled={busy} onClick={onRemove} className="text-sm font-medium text-danger underline underline-offset-2 disabled:opacity-45">
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}

export function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<Cart | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch("/api/cart")
      .then((res) => res.json())
      .then(setCart);
  }, []);

  const change = async (method: "PATCH" | "DELETE", body: object) => {
    setBusy(true);
    setNotice("");
    try {
      const res = await fetch("/api/cart", { method, body: JSON.stringify(body) });
      const data = (await res.json()) as Cart & { error?: string };
      if (data.error) setNotice(data.error);
      else setCart(data);
    } finally {
      setBusy(false);
    }
  };

  const pay = async () => {
    if (!cart) return;
    setBusy(true);
    setNotice("");
    try {
      const res = await fetch("/api/cart/checkout", { method: "POST", body: JSON.stringify({ totalCents: cart.totalCents }) });
      const data = (await res.json()) as { mission?: Mission; error?: string };
      if (data.error || !data.mission) {
        setNotice(data.error ?? "Checkout failed.");
        setCart(await fetch("/api/cart").then((r) => r.json()));
        setBusy(false);
        return;
      }
      const { status, approvalUrl, id, capturePending, autopayFailed } = data.mission;
      const missionId = encodeURIComponent(id);
      // When autopay failed, the order page explains why before sending the owner to PayPal.
      if (status === "AWAITING_PAYER" && approvalUrl && !autopayFailed) window.location.assign(approvalUrl);
      else router.push(status === "PAID" && !capturePending ? `/paid?mission=${missionId}` : `/?mission=${missionId}`);
    } catch {
      setNotice("Checkout failed. Nothing was charged.");
      setBusy(false);
    }
  };

  const units = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const blocked = cart?.decision === "BLOCK";

  return (
    <div className="mx-auto w-full max-w-[86rem] px-4 py-5 sm:px-8">
      <Backdrop tone="waiting" />
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="brand">
          <Link href="/">Velora</Link>
        </h1>
        <SiteNav cartCount={units} />
      </header>

      <main className="view-enter mx-auto max-w-6xl pb-10">
        <div className="mt-8 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="section-title text-3xl font-bold tracking-tight sm:text-4xl">Your cart</h2>
          <Link href="/" className="text-sm font-medium text-accent underline underline-offset-2">
            Continue shopping
          </Link>
        </div>

        {notice && (
          <p className="mt-4 rounded-2xl bg-danger-soft px-4 py-2 text-sm text-danger" role="alert">
            {notice}
          </p>
        )}

        {!cart ? (
          <p className="mt-6 text-sm text-muted">Loading your cart...</p>
        ) : cart.items.length === 0 ? (
          <section className="neu mt-6 rounded-3xl px-6 py-14 text-center">
            <p className="display text-xl font-semibold">Your cart is empty</p>
            <p className="mt-2 text-sm text-muted">Run a mission, then add the products you like.</p>
            <Link href="/" className="btn btn-accent mt-6 inline-block">
              Start a mission
            </Link>
          </section>
        ) : (
          <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <section className="neu min-w-0 rounded-3xl p-5 sm:p-6">
              <ul className="divide-y divide-line">
                {cart.items.map((item) => (
                  <CartLine
                    key={item.id}
                    item={item}
                    max={cart.maxQuantity}
                    busy={busy}
                    onQuantity={(quantity) => change("PATCH", { itemId: item.id, quantity })}
                    onRemove={() => change("DELETE", { itemId: item.id })}
                  />
                ))}
              </ul>
            </section>

            <aside className="neu min-w-0 rounded-3xl p-5 sm:p-6 lg:sticky lg:top-5">
              <h3 className="display section-title text-lg font-semibold tracking-tight">Order summary</h3>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Items ({units})</dt>
                  <dd className="font-mono">{money(cart.subtotalCents)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Estimated tax ({Math.round(cart.taxRate * 100)}%)</dt>
                  <dd className="font-mono">{money(cart.taxCents)}</dd>
                </div>
                <div className="flex justify-between gap-3 border-t border-line pt-3 text-base font-semibold">
                  <dt>Total</dt>
                  <dd className="font-mono">{money(cart.totalCents)}</dd>
                </div>
              </dl>

              {cart.decision !== "AUTO_APPROVE" && (
                <div className={`mt-4 rounded-2xl p-3 text-sm ${blocked ? "bg-danger-soft text-danger" : "bg-warn-soft text-warn"}`}>
                  <p className="font-medium">{blocked ? "Your limits block this order" : "Paying counts as your approval"}</p>
                  <ul className="bullets mt-1 space-y-0.5">
                    {cart.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}

              <button type="button" disabled={busy || blocked} onClick={pay} className="btn btn-accent mt-5 w-full py-3 text-base">
                {busy ? "Working..." : `Pay ${money(cart.totalCents)} with PayPal`}
              </button>
              <p className="mt-3 text-center text-xs text-muted">PayPal sandbox only, so no real money moves.</p>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
