"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export interface Series {
  name: string;
  color: string;
  values: number[];
}

// Ink and chrome for every chart, tuned for Velora's dark panels.
const MUTED = "#8f97a6";
const GRID = "#2a303b";
const BASELINE = "#3b4250";
const SURFACE = "#1a1e26";
const FONT = 11;

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** A round top of the scale with at most four gridlines, so counts never show as 2.5 products. */
function niceMax(value: number): number {
  if (value <= 4) return 4;
  const step = Math.pow(10, Math.floor(Math.log10(value)));
  const nice = [1, 2, 2.5, 5, 10].map((m) => m * step).find((m) => m * 4 >= value) ?? step * 10;
  return nice * 4;
}

const ticks = (max: number) => [0, max / 4, max / 2, (3 * max) / 4, max].filter((t) => Number.isInteger(t));

function roundedTop(x: number, y: number, w: number, h: number, r = 4) {
  const rr = Math.max(0, Math.min(r, h, w / 2));
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

function roundedRight(x: number, y: number, w: number, h: number, r = 4) {
  const rr = Math.max(0, Math.min(r, w, h / 2));
  return `M${x},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h - rr}Q${x + w},${y + h} ${x + w - rr},${y + h}H${x}Z`;
}

function Tooltip({ x, y, title, rows, width }: { x: number; y: number; title: string; rows: { name: string; color?: string; value: string }[]; width: number }) {
  const left = Math.max(4, Math.min(x - 80, width - 164));
  return (
    <div className="pointer-events-none absolute z-10 w-40 rounded-xl border border-line bg-bg/95 px-3 py-2 text-xs shadow-lg" style={{ left, top: Math.max(0, y - 8), transform: "translateY(-100%)" }}>
      <p className="mb-1 font-semibold text-ink">{title}</p>
      {rows.map((row) => (
        <p key={row.name} className="flex items-center justify-between gap-2 text-muted">
          <span className="flex items-center gap-1.5">
            {row.color && <span className="inline-block h-2 w-2 rounded-sm" style={{ background: row.color }} />}
            {row.name}
          </span>
          <span className="font-mono text-ink">{row.value}</span>
        </p>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { name: string; color: string; value?: string }[] }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((item) => (
        <li key={item.name} className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: item.color }} aria-hidden />
          {item.name}
          {item.value !== undefined && <span className="font-mono text-ink">{item.value}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Every chart card can flip to a plain table, so nothing depends on colour or hover alone. */
export function ChartCard({
  title,
  note,
  table,
  empty,
  className = "",
  children,
}: {
  title: string;
  note?: string;
  table: { columns: string[]; rows: (string | number)[][] };
  empty?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className={`neu min-w-0 rounded-3xl p-5 sm:p-6 ${className}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="section-title text-base font-semibold tracking-tight">{title}</h3>
          {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
        </div>
        {!empty && (
          <button type="button" onClick={() => setAsTable((v) => !v)} className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-muted underline underline-offset-2 hover:text-ink">
            {asTable ? "Chart" : "Table"}
          </button>
        )}
      </div>
      {empty ? (
        <p className="flex h-40 items-center justify-center rounded-2xl text-center text-sm text-muted neu-inset">Nothing here yet. Run a mission and this fills in.</p>
      ) : asTable ? (
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-muted">
              <tr>{table.columns.map((c) => <th key={c} className="py-1 pr-3 font-medium">{c}</th>)}</tr>
            </thead>
            <tbody className="font-mono" style={{ fontVariantNumeric: "tabular-nums" }}>
              {table.rows.map((row, i) => (
                <tr key={i} className="border-t border-line">
                  {row.map((cell, j) => <td key={j} className={`py-1.5 pr-3 ${j === 0 ? "font-sans" : ""}`}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </section>
  );
}

export function ColumnChart({ labels, axisLabels = labels, series, height = 220 }: { labels: string[]; axisLabels?: string[]; series: Series[]; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const m = { top: 10, right: 6, bottom: 26, left: 30 };
  const plotW = Math.max(0, width - m.left - m.right);
  const plotH = height - m.top - m.bottom;
  const totals = labels.map((_, i) => series.reduce((sum, s) => sum + s.values[i], 0));
  const max = niceMax(Math.max(...totals));
  const y = (v: number) => m.top + plotH - (v / max) * plotH;
  const band = labels.length ? plotW / labels.length : 0;
  const barW = Math.min(40, band * 0.62);

  return (
    <div ref={ref} className="relative" onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={series.map((s) => s.name).join(" and ")}>
          {ticks(max).map((t) => (
            <g key={t}>
              <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? BASELINE : GRID} />
              <text x={m.left - 8} y={y(t) + 4} textAnchor="end" fontSize={FONT} fill={MUTED} style={{ fontVariantNumeric: "tabular-nums" }}>{t}</text>
            </g>
          ))}
          {labels.map((label, i) => {
            const x = m.left + band * i + (band - barW) / 2;
            let base = 0;
            const visible = series.filter((s) => s.values[i] > 0);
            return (
              <g key={label} opacity={hover === null || hover === i ? 1 : 0.45}>
                {visible.map((s, k) => {
                  const top = y(base + s.values[i]);
                  const h = y(base) - top - (k > 0 ? 2 : 0);
                  base += s.values[i];
                  return k === visible.length - 1
                    ? <path key={s.name} d={roundedTop(x, top, barW, h)} fill={s.color} />
                    : <rect key={s.name} x={x} y={top} width={barW} height={Math.max(0, h)} fill={s.color} />;
                })}
                <text x={x + barW / 2} y={height - 8} textAnchor="middle" fontSize={FONT} fill={MUTED}>{axisLabels[i]}</text>
                <rect x={m.left + band * i} y={m.top} width={band} height={plotH} fill="transparent" onMouseEnter={() => setHover(i)} />
              </g>
            );
          })}
        </svg>
      )}
      {hover !== null && (
        <Tooltip
          x={m.left + band * hover + band / 2}
          y={y(totals[hover])}
          width={width}
          title={labels[hover]}
          rows={[...series.map((s) => ({ name: s.name, color: s.color, value: String(s.values[hover]) })), ...(series.length > 1 ? [{ name: "Total", value: String(totals[hover]) }] : [])]}
        />
      )}
    </div>
  );
}

export function BarChart({ labels, series }: { labels: string[]; series: Series[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const row = 30;
  const labelW = Math.min(180, Math.max(118, width * 0.42));
  const maxChars = Math.floor(labelW / 6.6);
  const valueW = 28;
  const plotW = Math.max(0, width - labelW - valueW);
  const totals = labels.map((_, i) => series.reduce((sum, s) => sum + s.values[i], 0));
  const max = Math.max(1, ...totals);
  const height = labels.length * row;

  return (
    <div ref={ref} className="relative" onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={series.map((s) => s.name).join(" and ")}>
          {labels.map((label, i) => {
            const y = i * row + 7;
            const h = row - 14;
            let base = 0;
            const visible = series.filter((s) => s.values[i] > 0);
            const short = label.length > maxChars ? `${label.slice(0, maxChars - 1)}…` : label;
            return (
              <g key={label} opacity={hover === null || hover === i ? 1 : 0.45}>
                <text x={0} y={y + h / 2 + 4} fontSize={FONT + 1} fill="#c9ced8">{short}</text>
                <line x1={labelW} x2={labelW} y1={i * row} y2={(i + 1) * row} stroke={BASELINE} />
                {visible.map((s, k) => {
                  const x = labelW + (base / max) * plotW + (k > 0 ? 2 : 0);
                  const w = (s.values[i] / max) * plotW - (k > 0 ? 2 : 0);
                  base += s.values[i];
                  return k === visible.length - 1
                    ? <path key={s.name} d={roundedRight(x, y, Math.max(0, w), h)} fill={s.color} />
                    : <rect key={s.name} x={x} y={y} width={Math.max(0, w)} height={h} fill={s.color} />;
                })}
                <text x={labelW + (totals[i] / max) * plotW + 6} y={y + h / 2 + 4} fontSize={FONT} fill={MUTED} style={{ fontVariantNumeric: "tabular-nums" }}>{totals[i]}</text>
                <rect x={0} y={i * row} width={width} height={row} fill="transparent" onMouseEnter={() => setHover(i)} />
              </g>
            );
          })}
        </svg>
      )}
      {hover !== null && (
        <Tooltip
          x={labelW + plotW / 2}
          y={hover * row + 6}
          width={width}
          title={labels[hover]}
          rows={series.map((s) => ({ name: s.name, color: s.color, value: String(s.values[hover]) }))}
        />
      )}
    </div>
  );
}

export function LineChart({ labels, series, height = 220 }: { labels: string[]; series: Series[]; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const m = { top: 12, right: 10, bottom: 26, left: 30 };
  const plotW = Math.max(0, width - m.left - m.right);
  const plotH = height - m.top - m.bottom;
  const max = niceMax(Math.max(...series.flatMap((s) => s.values)));
  const step = labels.length > 1 ? plotW / (labels.length - 1) : 0;
  const x = (i: number) => m.left + step * i;
  const y = (v: number) => m.top + plotH - (v / max) * plotH;
  const every = Math.ceil(labels.length / Math.max(2, Math.floor(plotW / 70)));

  return (
    <div
      ref={ref}
      className="relative"
      onMouseLeave={() => setHover(null)}
      onMouseMove={(event) => {
        const left = event.currentTarget.getBoundingClientRect().left;
        setHover(Math.max(0, Math.min(labels.length - 1, Math.round((event.clientX - left - m.left) / (step || 1)))));
      }}
    >
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={series.map((s) => s.name).join(" and ")}>
          {ticks(max).map((t) => (
            <g key={t}>
              <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? BASELINE : GRID} />
              <text x={m.left - 8} y={y(t) + 4} textAnchor="end" fontSize={FONT} fill={MUTED} style={{ fontVariantNumeric: "tabular-nums" }}>{t}</text>
            </g>
          ))}
          {labels.map((label, i) => ((i % every === 0 && labels.length - 1 - i >= every) || i === labels.length - 1) && (
            <text key={label} x={x(i)} y={height - 8} textAnchor={i === 0 ? "start" : i === labels.length - 1 ? "end" : "middle"} fontSize={FONT} fill={MUTED}>{label}</text>
          ))}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={m.top} y2={m.top + plotH} stroke={BASELINE} />}
          {series.map((s) => (
            <polyline key={s.name} points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {hover !== null && series.map((s) => (
            <circle key={s.name} cx={x(hover)} cy={y(s.values[hover])} r={4.5} fill={s.color} stroke={SURFACE} strokeWidth={2} />
          ))}
        </svg>
      )}
      {hover !== null && (
        <Tooltip
          x={x(hover)}
          y={y(Math.max(...series.map((s) => s.values[hover])))}
          width={width}
          title={labels[hover]}
          rows={series.map((s) => ({ name: s.name, color: s.color, value: String(s.values[hover]) }))}
        />
      )}
    </div>
  );
}

export function Donut({ slices, centerLabel }: { slices: { name: string; color: string; value: number }[]; centerLabel: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const size = 180;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const shown = slices.filter((s) => s.value > 0);
  const gap = shown.length > 1 ? 2 : 0;
  const starts = slices.map((_, i) => slices.slice(0, i).reduce((sum, s) => sum + (s.value / (total || 1)) * circumference, 0));
  const focus = hover !== null ? slices[hover] : null;

  return (
    <div className="flex flex-col items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${centerLabel}: ${slices.map((s) => `${s.name} ${s.value}`).join(", ")}`} className="shrink-0">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {slices.map((s, i) => {
            if (!s.value) return null;
            const length = (s.value / total) * circumference;
            const dash = Math.max(0.5, length - gap);
            return (
              <circle
                key={s.name}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={hover === i ? stroke + 4 : stroke}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-starts[i]}
                opacity={hover === null || hover === i ? 1 : 0.4}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            );
          })}
        </g>
        <text x="50%" y="47%" textAnchor="middle" fontSize={28} fontWeight={700} fill="#f1f3f6">{focus ? focus.value : total}</text>
        <text x="50%" y="60%" textAnchor="middle" fontSize={FONT + 1} fill={MUTED}>{focus ? focus.name : centerLabel}</text>
      </svg>
      <ul className="w-full space-y-1.5 text-sm">
        {slices.map((s, i) => (
          <li key={s.name} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className={`flex items-center justify-between gap-3 rounded-lg px-2 py-1 ${hover === i ? "bg-line" : ""}`}>
            <span className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
              {s.name}
            </span>
            <span className="font-mono text-muted" style={{ fontVariantNumeric: "tabular-nums" }}>
              {s.value}
              {total > 0 && <span className="ml-2 text-xs">{Math.round((s.value / total) * 100)}%</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
