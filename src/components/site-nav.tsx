"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CartLink } from "./cart-link";

interface Status {
  ai: string | null;
  catalog: "channel3" | "sample";
  payments: "sandbox" | "simulated";
}

interface AgentAccess {
  enabled: boolean;
  url?: string;
  key?: string;
}

/** Lets this visitor connect Claude or another MCP client with their own key, which can only ask and check. */
function ConnectAgent() {
  const [access, setAccess] = useState<AgentAccess | null>(null);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    fetch("/api/agent-key")
      .then((res) => res.json())
      .then(setAccess)
      .catch(() => setAccess({ enabled: false }));
  }, []);

  if (!access?.enabled || !access.url || !access.key) return null;
  const command = `claude mcp add --transport http velora ${access.url} --header "Authorization: Bearer ${access.key}"`;
  const copy = (label: string, text: string) =>
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(""), 1500);
    }, () => {});
  const rotate = () => {
    if (!confirm("Make a new key? Agents using the old one will stop working.")) return;
    fetch("/api/agent-key", { method: "POST" })
      .then((res) => res.json())
      .then(setAccess)
      .catch(() => {});
  };

  return (
    <div className="mt-3 border-t border-line pt-3">
      <p className="text-sm font-medium">Connect an AI agent</p>
      <p className="mt-1 text-xs text-muted">Claude or any MCP client can shop here with your key. It can ask and check, but only you approve.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className="btn btn-quiet text-xs" onClick={() => copy("command", command)}>
          {copied === "command" ? "Copied" : "Copy Claude Code command"}
        </button>
        <button type="button" className="btn btn-quiet text-xs" onClick={() => copy("key", access.key!)}>
          {copied === "key" ? "Copied" : "Copy key"}
        </button>
        <button type="button" className="btn btn-quiet text-xs" onClick={rotate}>New key</button>
      </div>
      <p className="mt-2 truncate text-[11px] text-muted" title={access.url}>{access.url}</p>
    </div>
  );
}

/** Shows which services are live and which are simulated, behind one button so the header stays calm. */
function LiveServices() {
  const [status, setStatus] = useState<Status | null>(null);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/status")
      .then((res) => res.json())
      .then(setStatus)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const services = status
    ? [
        { name: "AI", value: status.ai ?? "Rules only", live: Boolean(status.ai) },
        { name: "Catalog", value: status.catalog === "channel3" ? "Channel3" : "Sample data", live: status.catalog === "channel3" },
        { name: "Payments", value: status.payments === "sandbox" ? "PayPal sandbox" : "Simulated", live: status.payments === "sandbox" },
      ]
    : [];
  const allLive = services.length > 0 && services.every((s) => s.live);

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="dialog" className="btn btn-quiet inline-flex items-center gap-2">
        <span className="status-dot" style={{ background: !status ? "var(--muted)" : allLive ? "var(--accent)" : "var(--warn)", width: 8, height: 8 }} aria-hidden />
        Live services
      </button>
      {open && (
        <div role="dialog" aria-label="Live services" className="neu absolute right-0 z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl p-4" style={{ background: "var(--panel)" }}>
          {!status ? (
            <p className="text-sm text-muted">Checking...</p>
          ) : (
            <ul className="space-y-2.5">
              {services.map((s) => (
                <li key={s.name} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted">{s.name}</span>
                  <span className="flex min-w-0 items-center gap-2 font-medium">
                    <span className="truncate">{s.value}</span>
                    <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${s.live ? "bg-accent-soft text-accent" : "bg-warn-soft text-warn"}`}>
                      {s.live ? "Live" : "Demo"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 border-t border-line pt-3 text-xs text-muted">PayPal runs in sandbox only, so no real money moves.</p>
          <ConnectAgent />
        </div>
      )}
    </div>
  );
}

export function SiteNav({ cartCount }: { cartCount: number }) {
  return (
    <nav className="flex flex-wrap items-center gap-2" aria-label="Main">
      <Link href="/dashboard" className="btn btn-quiet inline-flex items-center gap-2">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
        </svg>
        Dashboard
      </Link>
      <CartLink count={cartCount} />
      <LiveServices />
    </nav>
  );
}
