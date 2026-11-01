"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { AgentEvent, AgentName, CartItem, Mission, Policy, StepSource, StreamMessage } from "@/lib/types";
import { AGES, COLORS, CONDITIONS, GENDERS, preferenceLabels, type Preferences } from "@/lib/preferences";
import { AgentCharacter, type CharacterState } from "./agent-character";
import { Backdrop, type Outcome } from "./backdrop";
import { OUTCOME_STYLE, STATUS } from "./mission-status";
import { CartLink } from "./cart-link";

const AGENTS: { name: AgentName; job: string }[] = [
  { name: "Intake", job: "Turns your request into a clear shopping mission" },
  { name: "Scout", job: "Searches product listings" },
  { name: "Risk Sentinel", job: "Quarantines scams and manipulated listings" },
  { name: "Deal Analyst", job: "Chooses the best basket within budget" },
  { name: "Policy Guardian", job: "Applies your limits, using rules and no AI" },
  { name: "Auditor", job: "Explains the decision in plain language" },
  { name: "Treasurer", job: "The only agent allowed to touch PayPal" },
];

/** Where each character stands around the prompt on wide screens. */
const SCATTER: { name: AgentName; style: React.CSSProperties; size: number; delay: string }[] = [
  { name: "Intake", style: { left: "3%", top: "2%" }, size: 118, delay: "0s" },
  { name: "Scout", style: { left: "13%", top: "36%" }, size: 104, delay: "-1.4s" },
  { name: "Risk Sentinel", style: { left: "0%", top: "60%" }, size: 124, delay: "-2.9s" },
  { name: "Deal Analyst", style: { right: "4%", top: "1%" }, size: 112, delay: "-0.8s" },
  { name: "Policy Guardian", style: { right: "13%", top: "35%" }, size: 108, delay: "-3.6s" },
  { name: "Auditor", style: { right: "0%", top: "60%" }, size: 122, delay: "-2.1s" },
  { name: "Treasurer", style: { left: "50%", bottom: "0%", marginLeft: "-58px" }, size: 116, delay: "-4.2s" },
];

const PACE_MS = 550;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const SOURCE_LABEL: Record<StepSource, string> = {
  ai: "Agent",
  rules: "Rules",
  "live-api": "Live API",
  "sample-data": "Sample data",
  simulated: "Simulated",
};

/** Turns a sentence or two into short points. Decimals are safe because a split needs a following space. */
function toBullets(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z$"0-9])/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function Bullets({ text, className = "" }: { text: string; className?: string }) {
  return (
    <ul className={`bullets space-y-0.5 ${className}`}>
      {toBullets(text).map((point, i) => (
        <li key={i}>{point}</li>
      ))}
    </ul>
  );
}

function agentFailed(agent: AgentName, event: AgentEvent): boolean {
  const failure: Partial<Record<AgentName, RegExp>> = {
    Scout: /^Found 0 |None of them are really/,
    "Deal Analyst": /^No safe listing/,
    "Policy Guardian": /^Blocked/,
    Auditor: /^Mission stopped/,
    Treasurer: /^(Refused|Payment could not)/,
  };
  return failure[agent]?.test(event.message) ?? false;
}

type MissionAction = "approve" | "reject" | "cancel" | "refund";

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

interface Status {
  ai: string | null;
  catalog: "channel3" | "sample";
  payments: "sandbox" | "simulated";
}

function Panel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`neu min-w-0 rounded-3xl p-5 sm:p-6 ${className}`}>
      <h2 className="section-title mb-4 text-lg font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function Chip({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <span className={`neu-inset rounded-full px-3 py-1 text-xs ${on ? "text-accent" : "text-muted"}`}>
      {children}
    </span>
  );
}

function SourceTag({ source }: { source: StepSource }) {
  const faded = source === "sample-data" || source === "simulated";
  return (
    <span className={`rounded-md px-1.5 py-0.5 font-mono text-[11px] ${faded ? "bg-warn-soft text-warn" : "bg-bg text-muted"}`}>
      {SOURCE_LABEL[source]}
    </span>
  );
}

function PolicyPanel({
  policy,
  committed,
  onSave,
}: {
  policy: Policy;
  committed: number;
  onSave: (update: Partial<Policy>) => void;
}) {
  const field = (label: string, key: "autoApproveLimitCents" | "perPurchaseLimitCents" | "monthlyBudgetCents") => (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted">{label}</span>
      <span className="flex items-center gap-1">
        $
        <input
          key={policy[key]}
          type="number"
          min={0}
          defaultValue={policy[key] / 100}
          onBlur={(e) => {
            const cents = Math.round(Number(e.target.value) * 100);
            if (Number.isFinite(cents) && cents >= 0 && cents !== policy[key]) onSave({ [key]: cents });
          }}
          className="neu-inset w-24 rounded-xl px-3 py-1.5 text-right font-mono text-sm"
        />
      </span>
    </label>
  );
  const percent = policy.monthlyBudgetCents ? Math.min(100, (committed / policy.monthlyBudgetCents) * 100) : 100;
  return (
    <Panel title="Budget">
      <div className="mb-1 flex justify-between text-sm">
        <span className="font-mono">{money(committed)}</span>
        <span className="text-muted">of {money(policy.monthlyBudgetCents)} this month</span>
      </div>
      <div className="neu-inset mb-5 h-3 overflow-hidden rounded-full" role="img" aria-label={`${Math.round(percent)}% of monthly budget committed`}>
        <div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${percent}%` }} />
      </div>
      <div className="space-y-3">
        {field("Auto-approve up to", "autoApproveLimitCents")}
        {field("Largest purchase", "perPurchaseLimitCents")}
        {field("Monthly budget", "monthlyBudgetCents")}
      </div>
      <p className="mt-4 text-xs text-muted">Always blocked: {policy.blockedCategories.join(", ")}.</p>
    </Panel>
  );
}

function Pipeline({ events, running, live }: { events: AgentEvent[]; running: boolean; live: boolean }) {
  const reached = new Set(events.map((e) => e.agent));
  const activeIndex = running ? AGENTS.findIndex((a) => !reached.has(a.name)) : -1;
  return (
    <ol className="space-y-4">
      {AGENTS.map((agent, index) => {
        const latest = events.filter((e) => e.agent === agent.name).at(-1);
        const active = index === activeIndex;
        const failed = latest ? agentFailed(agent.name, latest) : false;
        const state: CharacterState = active ? "working" : latest && live ? (failed ? "sad" : "jump") : "idle";
        return (
          <li key={agent.name} className="flex gap-3">
            <div className={`shrink-0 ${latest || active ? "" : "opacity-45 grayscale-[35%]"} transition-all duration-500`}>
              <AgentCharacter agent={agent.name} size={58} state={state} />
            </div>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex items-center gap-2">
                <span className="display font-semibold">{agent.name}</span>
                {active && <span className="status-dot status-dot-busy" role="img" aria-label="Working" />}
                {latest && (
                  <span
                    className={`status-dot ${failed ? "status-dot-bad" : "status-dot-ok"}`}
                    role="img"
                    aria-label={failed ? "Did not succeed" : "Finished"}
                  />
                )}
              </div>
              {latest ? (
                <Bullets text={latest.message} className="mt-1 text-sm" />
              ) : (
                <p className="mt-0.5 text-sm text-muted">{agent.job}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function PreferenceSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value?: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string | undefined) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-muted">{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="neu-inset w-full cursor-pointer rounded-xl px-3 py-2 text-sm"
      >
        <option value="">Any</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function AddToCart({
  count,
  busy,
  onAdd,
  full = false,
}: {
  count: number;
  busy: boolean;
  onAdd: () => void;
  full?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${full ? "justify-end" : ""}`}>
      <button type="button" disabled={busy} onClick={onAdd} className="btn btn-quiet px-3 py-1.5 text-xs whitespace-nowrap">
        Add to cart
      </button>
      {count > 0 && <span className="text-xs whitespace-nowrap text-accent">{count} in cart</span>}
    </span>
  );
}

const EXPLORE_PAGE = 5;

function Explore({
  mission,
  query,
  busy,
  onChoose,
  cart,
  onAdd,
  children,
}: {
  mission: Mission;
  query: string;
  busy: boolean;
  onChoose: (query: string, candidateId: string) => void;
  cart: CartItem[];
  onAdd: (candidateId: string) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(EXPLORE_PAGE);
  const options = (mission.alternatives ?? [])
    .filter((c) => c.query === query)
    .sort((a, b) => a.priceCents - b.priceCents);
  const selected = mission.basket.find((l) => l.query === query)?.id;
  const canChange = ["NEEDS_HUMAN", "AWAITING_PAYER", "BLOCKED"].includes(mission.status);
  const others = options.filter((c) => c.id !== selected).length;
  const canExplore = canChange && others > 0;
  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        {canExplore && (
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="btn btn-quiet px-3 py-1.5 text-xs">
            {open ? "Hide products" : `Explore ${others} more product${others === 1 ? "" : "s"}`}
          </button>
        )}
        {children}
      </div>
      {canExplore && open && (
        <fieldset className="mt-3 space-y-2" disabled={busy}>
          <legend className="sr-only">Choose a product for {query}</legend>
          {options.slice(0, shown).map((option) => (
            <label
              key={option.id}
              className={`flex cursor-pointer items-center gap-3 rounded-2xl p-2.5 transition-colors ${
                option.id === selected ? "bg-accent-soft" : "neu-inset"
              }`}
            >
              <input
                type="radio"
                name={`choose-${query}`}
                checked={option.id === selected}
                onChange={() => onChoose(query, option.id)}
                className="h-4 w-4 shrink-0 cursor-pointer accent-[var(--accent)]"
              />
              {option.imageUrl?.startsWith("https://") && (
                // Catalog images come from many retailer hosts, so next/image can't list them.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={option.imageUrl} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-xl bg-white object-contain" />
              )}
              <span className="min-w-0 flex-1 text-sm">
                <span className="block font-medium leading-snug">{option.title}</span>
                <span className="block text-xs text-muted">
                  {option.domain}
                  {option.url.startsWith("https://") && !option.domain.endsWith(".example") && (
                    <>
                      {" · "}
                      <a
                        href={option.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-accent underline underline-offset-2"
                      >
                        View the product
                      </a>
                    </>
                  )}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1.5">
                <span className="font-mono text-sm">{money(option.priceCents * option.quantity)}</span>
                <AddToCart
                  full
                  busy={busy}
                  count={cart.find((item) => item.id === option.id)?.quantity ?? 0}
                  onAdd={() => onAdd(option.id)}
                />
              </span>
            </label>
          ))}
          {shown < options.length && (
            <button type="button" onClick={() => setShown(shown + EXPLORE_PAGE)} className="btn btn-quiet w-full px-3 py-1.5 text-xs">
              Show more
            </button>
          )}
        </fieldset>
      )}
    </div>
  );
}

function Decision({
  mission,
  busy,
  onAction,
  onChoose,
  cart,
  onAdd,
}: {
  mission: Mission;
  busy: boolean;
  onAction: (action: MissionAction) => void;
  onChoose: (query: string, candidateId: string) => void;
  cart: CartItem[];
  onAdd: (candidateId: string) => void;
}) {
  const status =
    mission.status === "BLOCKED" && mission.basket.length === 0 && !mission.flags.some((f) => f.severity === "critical")
      ? { label: "No safe match found", tone: "bg-warn-soft text-warn" }
      : STATUS[mission.status];
  return (
    <Panel title="Decision">
      <span className={`inline-block rounded-xl px-3 py-1 text-sm font-semibold ${status.tone}`}>{status.label}</span>
      {mission.summary && <Bullets text={mission.summary} className="mt-3 text-sm" />}

      {mission.basket.length > 0 && (
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {mission.basket.map((line) => (
            <li key={mission.fromCart ? line.id : line.query} className="py-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="font-medium">
                  {line.quantity > 1 ? `${line.quantity} x ` : ""}
                  {line.title}
                </span>
                <span className="font-mono">{money(line.priceCents * line.quantity)}</span>
              </div>
              <p className="mt-1 text-xs text-muted">
                {line.domain}
                {line.url.startsWith("https://") && !line.domain.endsWith(".example") && (
                  <>
                    {" · "}
                    <a
                      href={line.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-accent underline underline-offset-2"
                    >
                      View the product
                    </a>
                  </>
                )}
              </p>
              <p className="mt-1 text-xs text-muted">{line.reason}</p>
              {!mission.fromCart && (
                <Explore key={line.query} mission={mission} query={line.query} busy={busy} onChoose={onChoose} cart={cart} onAdd={onAdd}>
                  <AddToCart busy={busy} count={cart.find((item) => item.id === line.id)?.quantity ?? 0} onAdd={() => onAdd(line.id)} />
                </Explore>
              )}
            </li>
          ))}
          {Boolean(mission.taxCents) && (
            <li className="py-2 text-sm text-muted">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-mono">{money(mission.totalCents - mission.taxCents!)}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span>Estimated tax</span>
                <span className="font-mono">{money(mission.taxCents!)}</span>
              </div>
            </li>
          )}
          <li className="flex justify-between py-2 text-sm font-semibold">
            <span>Total</span>
            <span className="font-mono">{money(mission.totalCents)}</span>
          </li>
        </ul>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {mission.status === "NEEDS_HUMAN" && (
          <>
            <button disabled={busy} onClick={() => onAction("approve")} className="btn btn-accent">
              Approve {money(mission.totalCents)}
            </button>
            <button disabled={busy} onClick={() => onAction("reject")} className="btn btn-danger">
              Cancel purchase
            </button>
          </>
        )}
        {mission.status === "AWAITING_PAYER" && mission.approvalUrl && (
          <>
            <a href={mission.approvalUrl} className="btn btn-accent">
              {mission.paymentMode === "sandbox" ? "Pay with PayPal sandbox" : "Run simulated payment"}
            </a>
            <button disabled={busy} onClick={() => onAction("cancel")} className="btn btn-danger">
              Cancel purchase
            </button>
          </>
        )}
        {mission.status === "PAID" && (
          <button disabled={busy} onClick={() => onAction("refund")} className="btn btn-quiet">
            Refund and restore budget
          </button>
        )}
      </div>

      {mission.checks.length > 0 && (
        <details className="mt-4 text-sm" open={mission.decision !== "AUTO_APPROVE"}>
          <summary className="cursor-pointer font-medium">Policy checks ({mission.checks.length})</summary>
          <ul className="mt-2 space-y-1.5">
            {mission.checks.map((check) => (
              <li key={check.rule} className="flex gap-2">
                <span
                  className={`w-14 shrink-0 font-mono text-xs ${
                    check.outcome === "pass" ? "text-accent" : check.outcome === "block" ? "text-danger" : "text-warn"
                  }`}
                >
                  {check.outcome === "pass" ? "PASS" : check.outcome === "block" ? "BLOCK" : "REVIEW"}
                </span>
                <span><span className="font-medium">{check.rule}.</span> <span className="text-muted">{check.detail}</span></span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Panel>
  );
}

function AuditTrail({ mission }: { mission: Mission }) {
  const [open, setOpen] = useState(false);
  const [verified, setVerified] = useState<{ count: number; text: string; ok: boolean } | null>(null);
  const shown = verified && verified.count === mission.events.length ? verified : null;
  const verify = async () => {
    const res = await fetch(`/api/missions/${mission.id}/verify`, { method: "POST" });
    const data = (await res.json()) as { events: number; brokenAt: number | null };
    setVerified({
      count: data.events,
      ok: data.brokenAt === null,
      text: data.brokenAt === null ? `All ${data.events} entries verified. Nothing was altered.` : `Entry ${data.brokenAt} was altered.`,
    });
  };
  return (
    <section className="neu min-w-0 rounded-3xl p-5 sm:p-6">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <h2 className="section-title text-lg font-semibold tracking-tight">Audit trail</h2>
        <span className="flex items-center gap-2 text-sm text-muted">
          {open ? "Hide" : `Show ${mission.events.length} entries`}
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            aria-hidden
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="view-enter mt-4">
          <ol className="space-y-3">
            {mission.events.map((event) => (
              <li key={event.seq} className="text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{event.agent}</span>
                  <SourceTag source={event.source} />
                  <span className="font-mono text-[11px] text-muted" title={event.hash}>
                    {new Date(event.at).toLocaleTimeString()} · {event.hash.slice(0, 10)}
                  </span>
                </div>
                <p className="mt-0.5 break-words text-muted">{event.message}</p>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button onClick={verify} className="btn btn-quiet">
              Verify hash chain
            </button>
            {shown && <span className={`text-sm ${shown.ok ? "text-accent" : "text-danger"}`} role="status">{shown.text}</span>}
          </div>
        </div>
      )}
    </section>
  );
}

async function loadSnapshot() {
  const [policyRes, missionsRes, cartRes] = await Promise.all([fetch("/api/policy"), fetch("/api/missions"), fetch("/api/cart")]);
  const { policy, committedCents } = (await policyRes.json()) as { policy: Policy; committedCents: number };
  const { missions } = (await missionsRes.json()) as { missions: Mission[] };
  const { items: cart } = (await cartRes.json()) as { items: CartItem[] };
  return { policy, committedCents, missions, cart };
}

export function Console() {
  const [status, setStatus] = useState<Status | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [committed, setCommitted] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [mission, setMission] = useState<Mission | null>(null);
  const [liveEvents, setLiveEvents] = useState<AgentEvent[]>([]);
  const [history, setHistory] = useState<Mission[]>([]);
  const [preferences, setPreferences] = useState<Preferences>({});
  const [customizing, setCustomizing] = useState(false);
  const [running, setRunning] = useState(false);
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);

  const applySnapshot = useCallback((snapshot: Awaited<ReturnType<typeof loadSnapshot>>) => {
    setPolicy(snapshot.policy);
    setCommitted(snapshot.committedCents);
    setHistory(snapshot.missions);
    setCart(snapshot.cart);
  }, []);

  const refresh = useCallback(async () => applySnapshot(await loadSnapshot()), [applySnapshot]);

  useEffect(() => {
    fetch("/api/status")
      .then((res) => res.json())
      .then(setStatus);
    loadSnapshot().then((snapshot) => {
      applySnapshot(snapshot);
      const params = new URLSearchParams(window.location.search);
      const returned = snapshot.missions.find((m) => m.id === params.get("mission"));
      if (returned) setMission(returned);
      if (params.get("notice")) setNotice(params.get("notice")!);
      if (params.size) window.history.replaceState(null, "", "/");
    });
  }, [applySnapshot]);

  const savePolicy = async (update: Partial<Policy>) => {
    const res = await fetch("/api/policy", { method: "PUT", body: JSON.stringify(update) });
    const data = (await res.json()) as { policy: Policy; committedCents: number };
    setPolicy(data.policy);
    setCommitted(data.committedCents);
  };

  const launch = async () => {
    setRunning(true);
    setLive(true);
    setMission(null);
    setLiveEvents([]);
    setNotice("");
    try {
      const res = await fetch("/api/missions", { method: "POST", body: JSON.stringify({ prompt, preferences }) });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "The mission could not start.");
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const message = JSON.parse(line) as StreamMessage;
          if (message.type === "event") {
            // Paced so each character gets a visible turn, even when the agents finish quickly.
            await sleep(PACE_MS);
            setLiveEvents((events) => [...events, message.event]);
          }
          if (message.type === "mission") setMission(message.mission);
          if (message.type === "error") setNotice(message.message);
        }
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The mission could not start.");
    } finally {
      setRunning(false);
      await refresh();
    }
  };

  const act = async (action: MissionAction) => {
    if (!mission) return;
    setBusy(true);
    setNotice("");
    try {
      const res = await fetch(`/api/missions/${mission.id}/${action}`, { method: "POST" });
      const data = (await res.json()) as { mission?: Mission; error?: string };
      if (data.mission) setMission(data.mission);
      if (data.error) setNotice(data.error);
    } finally {
      setBusy(false);
      await refresh();
    }
  };

  const choose = async (query: string, candidateId: string) => {
    if (!mission) return;
    setBusy(true);
    setNotice("");
    try {
      const res = await fetch(`/api/missions/${mission.id}/choose`, {
        method: "POST",
        body: JSON.stringify({ query, candidateId }),
      });
      const data = (await res.json()) as { mission?: Mission; error?: string };
      if (data.mission) setMission(data.mission);
      if (data.error) setNotice(data.error);
    } finally {
      setBusy(false);
      await refresh();
    }
  };

  const addToCart = async (candidateId: string) => {
    if (!mission) return;
    setNotice("");
    const res = await fetch("/api/cart", { method: "POST", body: JSON.stringify({ missionId: mission.id, candidateId }) });
    const data = (await res.json()) as { items?: CartItem[]; error?: string };
    if (data.items) setCart(data.items);
    if (data.error) setNotice(data.error);
  };

  const goHome = () => {
    setLive(false);
    setMission(null);
    setLiveEvents([]);
    setNotice("");
  };

  const events = mission?.events ?? liveEvents;
  const onLanding = !mission && !running;
  const tone: Outcome = mission ? STATUS[mission.status].outcome : "waiting";
  const canRun = prompt.trim().length >= 3;
  const chosenCount = preferenceLabels(preferences).length;
  const setPreference = (key: keyof Preferences) => (value: string | undefined) =>
    setPreferences((current) => ({ ...current, [key]: value }));
  const requestLabels = preferenceLabels(mission ? mission.preferences : preferences);
  const simulatedParts = status && (status.catalog === "sample" || status.payments === "simulated" || !status.ai);

  const recentMissions = (
    <Panel title="Recent missions">
      {history.length === 0 && <p className="text-sm text-muted">None yet. Your first mission will show up here.</p>}
      <ul className="space-y-2">
        {history.slice(0, 6).map((m) => {
          const info = STATUS[m.status];
          const style = OUTCOME_STYLE[info.outcome];
          return (
            <li key={m.id}>
              <button
                disabled={running}
                aria-current={mission?.id === m.id}
                onClick={() => {
                  setNotice("");
                  setLive(false);
                  setMission(m);
                }}
                style={{ background: style.card, borderLeftColor: style.dot }}
                className="w-full rounded-2xl border-l-4 px-3 py-2 text-left text-sm transition-transform hover:translate-x-1 disabled:opacity-50"
              >
                <span className="block truncate font-medium">{m.prompt}</span>
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  <span className="status-dot" style={{ background: style.dot, width: 8, height: 8 }} aria-hidden />
                  {info.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {history.length > 0 && (
        <Link href="/missions" className="btn btn-quiet mt-4 block text-center">
          View all
        </Link>
      )}
    </Panel>
  );

  return (
    <div className="mx-auto w-full max-w-[86rem] px-4 py-5 sm:px-8">
      <Backdrop tone={onLanding ? undefined : tone} />
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="brand">
          <button onClick={goHome} disabled={running}>Velora</button>
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          {status && (
            <div className="hidden flex-wrap items-center gap-2 sm:flex">
              <Chip on={Boolean(status.ai)}>AI: {status.ai ?? "rules only"}</Chip>
              <Chip on={status.catalog === "channel3"}>Catalog: {status.catalog === "channel3" ? "Channel3" : "sample"}</Chip>
              <Chip on={status.payments === "sandbox"}>Payments: {status.payments === "sandbox" ? "PayPal sandbox" : "simulated"}</Chip>
            </div>
          )}
          <CartLink count={cart.reduce((sum, item) => sum + item.quantity, 0)} />
        </div>
      </header>

      {simulatedParts && (
        <p className="mt-4 rounded-2xl bg-warn-soft px-4 py-2 text-sm text-warn">
          Demo mode: anything tagged Sample data or Simulated is not a live service. Add your free keys to switch each part on.
        </p>
      )}
      {notice && (
        <p className="mt-4 rounded-2xl bg-danger-soft px-4 py-2 text-sm text-danger" role="alert">
          {notice}
        </p>
      )}

      {onLanding ? (
        <main className="view-enter">
          <div className={`relative mt-6 transition-[min-height] duration-300 ${customizing ? "xl:min-h-[46rem]" : "xl:min-h-[39rem]"}`}>
            {SCATTER.map(({ name, style, size, delay }) => (
              <div key={name} className="agent-spot absolute hidden flex-col items-center xl:flex" style={style}>
                <div className="agent-float" style={{ animationDelay: delay }}>
                  <AgentCharacter agent={name} size={size} />
                </div>
              </div>
            ))}

            <div className="relative z-10 mx-auto max-w-2xl pt-10 text-center xl:pt-16">
              <h2 className="text-[clamp(2.5rem,5.4vw,4.3rem)] font-bold leading-[1.03] tracking-tight">
                Purchase with your <span className="text-accent">AI agents.</span>
              </h2>
              <p className="mt-4 text-[clamp(1.05rem,1.7vw,1.3rem)] text-muted">Say what you need. Just pay, no stress.</p>

              <form
                className="neu-inset mt-9 flex items-end gap-2 rounded-[1.75rem] p-2.5 text-left"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (canRun) launch();
                }}
              >
                <label htmlFor="mission-prompt" className="sr-only">What should the agents buy?</label>
                <textarea
                  id="mission-prompt"
                  value={prompt}
                  maxLength={500}
                  rows={2}
                  placeholder="A steel water bottle under $25..."
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (canRun) launch();
                    }
                  }}
                  className="min-w-0 flex-1 resize-none bg-transparent px-3 py-2 text-lg leading-snug outline-none placeholder:text-muted/70"
                />
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setCustomizing(!customizing)}
                    aria-expanded={customizing}
                    className="btn btn-quiet whitespace-nowrap rounded-[1.25rem] px-4 py-3 text-base"
                  >
                    Customize{chosenCount ? ` (${chosenCount})` : ""}
                  </button>
                  <button type="submit" disabled={!canRun} className="btn btn-accent whitespace-nowrap rounded-[1.25rem] px-5 py-3 text-base">
                    Run agents
                  </button>
                </div>
              </form>
              {customizing && (
                <div className="neu view-enter mt-4 grid grid-cols-2 gap-3 rounded-3xl p-4 text-left sm:grid-cols-4">
                  <PreferenceSelect label="Gender" value={preferences.gender} options={GENDERS} onChange={setPreference("gender")} />
                  <PreferenceSelect label="Age group" value={preferences.age} options={AGES} onChange={setPreference("age")} />
                  <PreferenceSelect label="Colour" value={preferences.color} options={COLORS} onChange={setPreference("color")} />
                  <PreferenceSelect label="Condition" value={preferences.condition} options={CONDITIONS} onChange={setPreference("condition")} />
                </div>
              )}
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-3 xl:hidden">
              {AGENTS.map(({ name }) => (
                <AgentCharacter key={name} agent={name} size={66} className="agent-float" />
              ))}
            </div>
          </div>

          <div className="mx-auto mt-8 grid max-w-5xl grid-cols-1 gap-6 pb-10 md:grid-cols-2">
            {policy && <PolicyPanel policy={policy} committed={committed} onSave={savePolicy} />}
            {recentMissions}
          </div>
        </main>
      ) : (
        <main className="view-enter mt-6 grid grid-cols-1 gap-6 pb-10 lg:grid-cols-[19rem_minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="space-y-6">
            {policy && <PolicyPanel policy={policy} committed={committed} onSave={savePolicy} />}
            {recentMissions}
          </div>

          <div className="space-y-6">
            <Panel title="Your request">
              <p className="display break-words text-xl font-medium leading-snug">{mission?.prompt ?? prompt}</p>
              {requestLabels.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {requestLabels.map((label) => (
                    <span key={label} className="neu-inset rounded-full px-3 py-0.5 text-xs text-accent">
                      {label}
                    </span>
                  ))}
                </div>
              )}
              <button
                onClick={goHome}
                disabled={running}
                className="btn btn-quiet mt-4"
              >
                New mission
              </button>
            </Panel>
            <Panel title="Agent team">
              <Pipeline events={events} running={running} live={live} />
            </Panel>
          </div>

          <div className="space-y-6">
            {mission ? (
              <>
                <Decision mission={mission} busy={busy} onAction={act} onChoose={choose} cart={cart} onAdd={addToCart} />
                <AuditTrail key={mission.id} mission={mission} />
              </>
            ) : (
              <Panel title="Decision">
                <p className="text-sm text-muted">The agents are working on it.</p>
              </Panel>
            )}
          </div>
        </main>
      )}
    </div>
  );
}
