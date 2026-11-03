"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { dashboardStats, type DashboardData, type TrendingProduct } from "@/lib/dashboard";
import type { CartItem } from "@/lib/types";
import { Backdrop } from "./backdrop";
import { BarChart, ChartCard, ColumnChart, Donut, Legend, LineChart } from "./charts";
import { SiteNav } from "./site-nav";

// Validated for colour-blind separation on Velora's dark panel. Each colour keeps one meaning page-wide.
const YOU = "#3987e5";
const AGENTS = "#d95926";
const BOUGHT = "#199e70";
const NOT_BOUGHT = "#c98500";
const OUTCOME_COLOR = { Bought: "#0ca30c", Waiting: "#fab219", Refunded: "#9085e9", Cancelled: "#6b7383", Stopped: "#d03b3b" };
const CAUGHT = "#ec835a";

const REFRESH_MS = 10_000;
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

function Tile({ label, value, detail, meter }: { label: string; value: string; detail: string; meter?: number }) {
  return (
    <div className="neu min-w-0 rounded-3xl p-5">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="display mt-1 text-3xl font-bold tracking-tight">{value}</p>
      {meter !== undefined && (
        <div className="neu-inset mt-3 h-2 overflow-hidden rounded-full" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(meter * 100)} aria-label={label}>
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, meter * 100)}%`, background: meter > 0.85 ? "#d03b3b" : BOUGHT }} />
        </div>
      )}
      <p className="mt-2 text-xs text-muted">{detail}</p>
    </div>
  );
}

function TrendingRow({ title, note, products, onAdd, adding }: { title: string; note: string; products: TrendingProduct[]; onAdd: (p: TrendingProduct) => void; adding: string | null }) {
  return (
    <section className="neu min-w-0 rounded-3xl p-5 sm:p-6">
      <h3 className="section-title text-base font-semibold tracking-tight">{title}</h3>
      <p className="mt-0.5 text-xs text-muted">{note}</p>
      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {products.map((p) => (
          <li key={p.candidateId} className="neu-inset flex min-w-0 flex-col gap-3 rounded-2xl p-3">
            <div className="flex min-w-0 gap-3">
              {p.imageUrl?.startsWith("https://") ? (
                // Catalog images come from many retailer hosts, so next/image can't list them.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imageUrl} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-xl bg-white object-contain" />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-line text-xl font-semibold text-muted" aria-hidden>{p.title.charAt(0)}</div>
              )}
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-medium leading-snug">{p.title}</p>
                <p className="mt-1 font-mono text-sm">{money(p.priceCents)}</p>
                <p className="truncate text-xs text-muted">{p.domain}{p.seen > 1 ? ` · seen in ${p.seen} missions` : ""}</p>
              </div>
            </div>
            <div className="mt-auto flex items-center gap-3">
              <button type="button" disabled={adding !== null} onClick={() => onAdd(p)} className="btn btn-quiet px-3 py-1.5 text-xs">
                {adding === p.candidateId ? "Adding..." : "Add to cart"}
              </button>
              {!p.domain.endsWith(".example") && (
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-accent underline underline-offset-2">View</a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [notice, setNotice] = useState("");
  const [adding, setAdding] = useState<string | null>(null);

  const load = useCallback(
    () =>
      Promise.all([
        fetch("/api/dashboard").then((r) => r.json() as Promise<DashboardData>),
        fetch("/api/cart").then((r) => r.json() as Promise<{ items: CartItem[] }>),
      ]).then(
        ([dashboard, cart]) => {
          setData(dashboard);
          setCartCount(cart.items.reduce((n, item) => n + item.quantity, 0));
          setUpdated(new Date());
        },
        // Keeps the last numbers on screen if one refresh fails.
        () => {},
      ),
    [],
  );

  // Refreshes while the page is open, so a mission that finishes elsewhere shows up on its own.
  useEffect(() => {
    load();
    const timer = setInterval(() => document.visibilityState === "visible" && load(), REFRESH_MS);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  const stats = useMemo(() => (data ? dashboardStats(data.missions) : null), [data]);

  const add = async (product: TrendingProduct) => {
    setAdding(product.candidateId);
    setNotice("");
    try {
      const res = await fetch("/api/cart", { method: "POST", body: JSON.stringify({ missionId: product.missionId, candidateId: product.candidateId }) });
      const body = (await res.json()) as { error?: string };
      setNotice(body.error ?? `Added ${product.title} to your cart.`);
      await load();
    } finally {
      setAdding(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[86rem] px-4 py-5 sm:px-8">
      <Backdrop tone="waiting" />
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="brand">
          <Link href="/">Velora</Link>
        </h1>
        <SiteNav cartCount={cartCount} />
      </header>

      <main className="view-enter pb-10">
        <div className="mt-8 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="section-title text-3xl font-bold tracking-tight sm:text-4xl">Dashboard</h2>
            <p className="mt-1 text-sm text-muted">
              Updates by itself as missions finish{updated ? ` · last updated ${updated.toLocaleTimeString()}` : ""}
            </p>
          </div>
          <Link href="/" className="text-sm font-medium text-accent underline underline-offset-2">Back to home</Link>
        </div>

        {notice && <p className="mt-4 rounded-2xl bg-accent-soft px-4 py-2 text-sm text-accent" role="status">{notice}</p>}

        {!data || !stats ? (
          <p className="mt-6 text-sm text-muted">Loading your dashboard...</p>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Tile
                label="Spent this month"
                value={money(data.spentCents)}
                meter={data.spentCents / Math.max(1, data.monthlyBudgetCents)}
                detail={`of ${money(data.monthlyBudgetCents)} budget · ${money(Math.max(0, data.monthlyBudgetCents - data.spentCents))} left`}
              />
              <Tile label="Products bought" value={String(stats.tiles.boughtUnits)} detail={`across ${stats.tiles.missions} mission${stats.tiles.missions === 1 ? "" : "s"}`} />
              <Tile
                label="Bought by AI agents"
                value={String(stats.tiles.agentUnits)}
                detail={stats.tiles.boughtUnits ? `${Math.round((stats.tiles.agentUnits / stats.tiles.boughtUnits) * 100)}% of products, asked through MCP` : "Purchases asked for through MCP"}
              />
              <Tile
                label="Stopped by guardrails"
                value={String(stats.tiles.stopped + stats.tiles.listingsCaught)}
                detail={`${stats.tiles.stopped} mission${stats.tiles.stopped === 1 ? "" : "s"} blocked · ${stats.tiles.listingsCaught} risky listing${stats.tiles.listingsCaught === 1 ? "" : "s"} quarantined`}
              />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <ChartCard
                className="lg:col-span-2"
                title="Shopping over time"
                note="Missions per day for the last 14 days, by who asked"
                empty={sum([...stats.daily.you, ...stats.daily.agents]) === 0}
                table={{ columns: ["Day", "You", "AI agents"], rows: stats.daily.labels.map((d, i) => [d, stats.daily.you[i], stats.daily.agents[i]]) }}
              >
                <LineChart height={300} labels={stats.daily.labels} series={[{ name: "You", color: YOU, values: stats.daily.you }, { name: "AI agents", color: AGENTS, values: stats.daily.agents }]} />
                <Legend items={[{ name: "You", color: YOU }, { name: "AI agents (MCP)", color: AGENTS }]} />
              </ChartCard>

              <ChartCard
                title="Mission outcomes"
                note="What happened to every mission"
                empty={stats.tiles.missions === 0}
                table={{ columns: ["Outcome", "Missions"], rows: stats.outcomes.map((o) => [o.name, o.value]) }}
              >
                <Donut centerLabel="missions" slices={stats.outcomes.map((o) => ({ ...o, color: OUTCOME_COLOR[o.name] }))} />
              </ChartCard>

              <ChartCard
                title="When you shop"
                note="Missions by time of day"
                empty={stats.tiles.missions === 0}
                table={{ columns: ["Time", "You", "AI agents"], rows: stats.timeOfDay.labels.map((t, i) => [t, stats.timeOfDay.you[i], stats.timeOfDay.agents[i]]) }}
              >
                <ColumnChart labels={stats.timeOfDay.labels} axisLabels={["12am", "4am", "8am", "12pm", "4pm", "8pm"]} series={[{ name: "You", color: YOU, values: stats.timeOfDay.you }, { name: "AI agents", color: AGENTS, values: stats.timeOfDay.agents }]} />
                <Legend items={[{ name: "You", color: YOU }, { name: "AI agents (MCP)", color: AGENTS }]} />
              </ChartCard>

              <ChartCard
                title="Price ranges"
                note="Products chosen in each price range"
                empty={sum([...stats.priceRanges.bought, ...stats.priceRanges.notBought]) === 0}
                table={{ columns: ["Price", "Bought", "Not bought"], rows: stats.priceRanges.labels.map((l, i) => [l, stats.priceRanges.bought[i], stats.priceRanges.notBought[i]]) }}
              >
                <ColumnChart labels={stats.priceRanges.labels} axisLabels={["<$10", "$10+", "$25+", "$50+", "$100+", "$200+"]} series={[{ name: "Bought", color: BOUGHT, values: stats.priceRanges.bought }, { name: "Not bought", color: NOT_BOUGHT, values: stats.priceRanges.notBought }]} />
                <Legend items={[{ name: "Bought", color: BOUGHT }, { name: "Chosen, not bought", color: NOT_BOUGHT }]} />
              </ChartCard>

              <ChartCard
                title="Guardrails at work"
                note="Risky listings quarantined before any agent could pick them"
                empty={stats.guardrails.length === 0}
                table={{ columns: ["Reason", "Listings"], rows: stats.guardrails }}
              >
                <BarChart labels={stats.guardrails.map(([label]) => label)} series={[{ name: "Quarantined", color: CAUGHT, values: stats.guardrails.map(([, n]) => n) }]} />
              </ChartCard>

              <ChartCard
                className="lg:col-span-3"
                title="Product categories"
                note="Products chosen in each catalog category"
                empty={stats.categories.labels.length === 0}
                table={{ columns: ["Category", "Bought", "Not bought"], rows: stats.categories.labels.map((l, i) => [l, stats.categories.bought[i], stats.categories.notBought[i]]) }}
              >
                <BarChart labels={stats.categories.labels} series={[{ name: "Bought", color: BOUGHT, values: stats.categories.bought }, { name: "Not bought", color: NOT_BOUGHT, values: stats.categories.notBought }]} />
                <Legend items={[{ name: "Bought", color: BOUGHT }, { name: "Chosen, not bought", color: NOT_BOUGHT }]} />
              </ChartCard>
            </div>

            {(data.trending.category || data.trending.priceRange) && (
              <div className="mt-4 grid grid-cols-1 gap-4">
                {data.trending.category && (
                  <TrendingRow
                    title={`Trending in ${data.trending.category.name}`}
                    note="Your top category. Picked from listings your missions already screened as safe."
                    products={data.trending.category.products}
                    onAdd={add}
                    adding={adding}
                  />
                )}
                {data.trending.priceRange && (
                  <TrendingRow
                    title={`Trending at ${data.trending.priceRange.name}`}
                    note="The price range you buy in most. Also from screened listings only."
                    products={data.trending.priceRange.products}
                    onAdd={add}
                    adding={adding}
                  />
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
