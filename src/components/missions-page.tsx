"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CartItem, Mission } from "@/lib/types";
import { Backdrop } from "./backdrop";
import { CartLink } from "./cart-link";
import { OUTCOME_STYLE, STATUS } from "./mission-status";

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function MissionCard({ mission }: { mission: Mission }) {
  const info = STATUS[mission.status];
  const style = OUTCOME_STYLE[info.outcome];
  return (
    <li className="neu min-w-0 rounded-3xl border-l-4 p-5 sm:p-6" style={{ borderLeftColor: style.dot }}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 className="display text-lg leading-snug font-semibold break-words">{mission.prompt}</h3>
          <p className="mt-1 text-xs text-muted">{new Date(mission.createdAt).toLocaleString()}</p>
        </div>
        <span className={`rounded-xl px-3 py-1 text-sm font-semibold whitespace-nowrap ${info.tone}`}>{info.label}</span>
      </div>

      {mission.basket.length > 0 ? (
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {mission.basket.map((line) => (
            <li key={line.id} className="flex items-center gap-3 py-3 text-sm">
              {line.imageUrl?.startsWith("https://") && (
                // Catalog images come from many retailer hosts, so next/image can't list them.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={line.imageUrl} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-xl bg-white object-contain" />
              )}
              <div className="min-w-0 flex-1">
                <p className="leading-snug font-medium break-words">
                  {line.quantity > 1 ? `${line.quantity} x ` : ""}
                  {line.title}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {line.domain}
                  {line.url.startsWith("https://") && !line.domain.endsWith(".example") && (
                    <>
                      {" · "}
                      <a href={line.url} target="_blank" rel="noopener noreferrer" className="font-medium text-accent underline underline-offset-2">
                        View the product
                      </a>
                    </>
                  )}
                </p>
              </div>
              <span className="shrink-0 font-mono">{money(line.priceCents * line.quantity)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted">No product was chosen.</p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/?mission=${encodeURIComponent(mission.id)}`} className="btn btn-quiet px-3 py-1.5 text-xs">
          Open details
        </Link>
        {mission.basket.length > 0 && (
          <p className="text-sm">
            {Boolean(mission.taxCents) && <span className="mr-3 text-muted">Includes {money(mission.taxCents!)} tax</span>}
            <span className="font-semibold">Total </span>
            <span className="font-mono font-semibold">{money(mission.totalCents)}</span>
          </p>
        )}
      </div>
    </li>
  );
}

export function MissionsPage() {
  const [missions, setMissions] = useState<Mission[] | null>(null);
  const [units, setUnits] = useState(0);

  useEffect(() => {
    fetch("/api/missions")
      .then((res) => res.json())
      .then((data: { missions: Mission[] }) => setMissions(data.missions));
    fetch("/api/cart")
      .then((res) => res.json())
      .then((data: { items: CartItem[] }) => setUnits(data.items.reduce((sum, item) => sum + item.quantity, 0)));
  }, []);

  return (
    <div className="mx-auto w-full max-w-[86rem] px-4 py-5 sm:px-8">
      <Backdrop tone="waiting" />
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="brand">
          <Link href="/">Velora</Link>
        </h1>
        <CartLink count={units} />
      </header>

      <main className="view-enter mx-auto max-w-4xl pb-10">
        <div className="mt-8 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="section-title text-3xl font-bold tracking-tight sm:text-4xl">All missions</h2>
          <Link href="/" className="text-sm font-medium text-accent underline underline-offset-2">
            Back to home
          </Link>
        </div>

        {!missions ? (
          <p className="mt-6 text-sm text-muted">Loading your missions...</p>
        ) : missions.length === 0 ? (
          <section className="neu mt-6 rounded-3xl px-6 py-14 text-center">
            <p className="display text-xl font-semibold">No missions yet</p>
            <p className="mt-2 text-sm text-muted">Your searches and cart checkouts will show up here.</p>
          </section>
        ) : (
          <ul className="mt-6 space-y-5">
            {missions.map((mission) => (
              <MissionCard key={mission.id} mission={mission} />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
