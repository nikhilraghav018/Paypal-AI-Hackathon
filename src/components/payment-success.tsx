"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const SHOW_MS = 4600;
const COLORS = ["#6fdcb9", "#f0c56c", "#ff7eb0", "#7db7ff", "#b79cff", "#ff8f70"];

/** Fixed integer hash, so the server and browser render exactly the same confetti. */
const spread = (i: number, salt: number) => {
  let hash = Math.imul(i * 31 + salt * 131 + 7, 2654435761);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 2246822519);
  hash ^= hash >>> 13;
  return (hash >>> 0) % 1000 / 1000;
};

const fixed = (value: number) => value.toFixed(2);

type Piece = { left: string; top: string; style: Record<string, string>; shape: string };

const PIECES: Piece[] = Array.from({ length: 96 }, (_, i) => {
  const source = i % 3; // A popper from each lower corner, and a shower falling onto the tick.
  const r = (salt: number) => spread(i, salt);
  const up = 34 + r(1) * 44;
  const reach = 18 + r(2) * 34;
  const peakX = source === 2 ? (r(2) - 0.5) * 46 : source === 0 ? reach : -reach;
  const peakY = source === 2 ? -6 - r(1) * 6 : -up;
  return {
    left: source === 2 ? `${fixed(50 + (r(3) - 0.5) * 16)}%` : source === 0 ? "4%" : "96%",
    top: source === 2 ? "-4%" : "100%",
    shape: ["confetti-rect", "confetti-dot", "confetti-ribbon"][i % 3 === 0 ? 0 : Math.floor(r(4) * 3)],
    style: {
      "--peak-x": `${fixed(peakX)}vw`,
      "--peak-y": `${fixed(peakY)}vh`,
      "--end-x": `${fixed(peakX + (r(5) - 0.5) * 14)}vw`,
      "--end-y": source === 2 ? `${fixed(50 + r(6) * 50)}vh` : `${fixed(peakY + 40 + r(6) * 40)}vh`,
      "--spin": `${fixed((r(7) > 0.5 ? 1 : -1) * (360 + r(8) * 900))}deg`,
      background: COLORS[Math.floor(r(9) * COLORS.length)],
      animationDelay: `${fixed((source === 2 ? 1.05 : 0.85) + r(10) * 0.5)}s`,
      animationDuration: `${fixed(2 + r(11) * 0.9)}s`,
    },
  };
});

export function PaymentSuccess() {
  const router = useRouter();

  useEffect(() => {
    const mission = new URLSearchParams(window.location.search).get("mission");
    const timer = setTimeout(() => {
      router.replace(mission ? `/?mission=${encodeURIComponent(mission)}` : "/");
    }, SHOW_MS);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main className="paid-screen" role="status">
      <div className="confetti" aria-hidden>
        {PIECES.map((piece, i) => (
          <span key={i} className={`confetti-piece ${piece.shape}`} style={{ left: piece.left, top: piece.top, ...piece.style }} />
        ))}
      </div>
      <svg className="paid-tick" viewBox="0 0 120 120" width="148" height="148" aria-hidden>
        <circle className="paid-disc" cx="60" cy="60" r="52" />
        <circle className="paid-ring" cx="60" cy="60" r="52" pathLength="1" />
        <path className="paid-check" d="M37 62 L53 78 L84 44" pathLength="1" />
      </svg>
      <h1 className="paid-caption">Payment successful</h1>
    </main>
  );
}
