// Charts: hand-drawn SVG on the theme's chart tokens. Fixed viewBox geometry (so the
// v1 rules — axis ends at the last event, silence band, markers only on sparse series —
// carry over unchanged), a floor width so 11-unit labels stay legible, and horizontal
// scroll inside the card on narrow screens.

import type { Strings } from "@/i18n";
import { fullTs } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TrendSeries, TrendWindow } from "@server/credit/trend/trend";
import type { ReactNode } from "react";

export const CHART_W = 1160;
export const CHART_H = 200;

/** SVG frame shared by every chart. Text uses `fill-muted-foreground` at 11 units. */
export function ChartFrame({
  aria,
  children,
  width = CHART_W,
  height = CHART_H,
  minWidth = 720,
  className,
}: {
  aria: string;
  children: ReactNode;
  width?: number;
  height?: number;
  minWidth?: number;
  className?: string;
}) {
  return (
    <div className={cn("-mx-1 overflow-x-auto px-1 pb-1", className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={aria}
        preserveAspectRatio="xMidYMid meet"
        className="h-auto w-full text-[11px] [&_text]:fill-muted-foreground"
        style={{ minWidth }}
      >
        {children}
      </svg>
    </div>
  );
}

export function windowLabel(w: TrendWindow, s: Strings): string {
  return w === "7d"
    ? s.usage.windowLong7d
    : w === "30d"
      ? s.usage.windowLong30d
      : s.usage.windowLongAll;
}

function fmt(n: number | null): string {
  if (n === null) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** Screen-reader summary of a trend (also the chart's aria-label). */
export function trendAria(series: TrendSeries, s: Strings): string {
  const w = windowLabel(series.window, s);
  const { summary } = series;
  if (summary.count === 0) return s.usage.chartEmpty(w);
  return s.usage.chartSummary(w, fmt(summary.min), fmt(summary.max), fmt(summary.latest));
}

/**
 * Trend line. A null value breaks the line; a flat series gets ±1 padding; markers only
 * at 60 points or fewer (a 5-minute poll is 288/day and markers would blot the line).
 */
export function LineChart({
  series,
  s,
  aria,
  width = CHART_W,
  height = CHART_H,
  format = fmt,
}: {
  series: TrendSeries;
  s: Strings;
  aria?: string;
  width?: number;
  height?: number;
  format?: (n: number) => string;
}) {
  const pad = { top: 12, right: 12, bottom: 24, left: 56 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const label = aria ?? trendAria(series, s);
  const valued = series.points.filter((p) => p.value !== null);

  if (valued.length === 0) {
    return (
      <ChartFrame aria={label} width={width} height={height}>
        <text x={width / 2} y={height / 2} textAnchor="middle" fontSize={13}>
          {s.usage.chartNoData}
        </text>
      </ChartFrame>
    );
  }

  const times = valued.map((p) => Date.parse(p.ts)).filter((t) => !Number.isNaN(t));
  const tMin = Math.min(...times);
  const tMax = Math.max(...times);
  const values = valued.map((p) => p.value as number);
  let vMin = Math.min(...values);
  let vMax = Math.max(...values);
  if (vMin === vMax) {
    vMin -= 1;
    vMax += 1;
  }
  const xOf = (ts: string) =>
    tMax === tMin
      ? pad.left + plotW / 2
      : pad.left + ((Date.parse(ts) - tMin) / (tMax - tMin)) * plotW;
  const yOf = (v: number) => pad.top + plotH - ((v - vMin) / (vMax - vMin)) * plotH;

  const segments: string[] = [];
  let cur: string[] = [];
  for (const p of series.points) {
    if (p.value === null) {
      if (cur.length > 0) segments.push(cur.join(" "));
      cur = [];
      continue;
    }
    cur.push(`${xOf(p.ts).toFixed(1)},${yOf(p.value).toFixed(1)}`);
  }
  if (cur.length > 0) segments.push(cur.join(" "));

  return (
    <ChartFrame aria={label} width={width} height={height}>
      <line
        x1={pad.left}
        y1={pad.top}
        x2={pad.left}
        y2={pad.top + plotH}
        className="stroke-border"
      />
      <line
        x1={pad.left}
        y1={pad.top + plotH}
        x2={pad.left + plotW}
        y2={pad.top + plotH}
        className="stroke-border"
      />
      <text x={pad.left - 6} y={pad.top + 4} textAnchor="end">
        {format(vMax)}
      </text>
      <text x={pad.left - 6} y={pad.top + plotH} textAnchor="end">
        {format(vMin)}
      </text>
      {segments.map((pts) => (
        <polyline
          key={pts.slice(0, 32)}
          fill="none"
          strokeWidth={2}
          points={pts}
          className="stroke-chart-1"
        />
      ))}
      {valued.length <= 60
        ? valued.map((p) => (
            <circle
              key={p.ts}
              cx={xOf(p.ts)}
              cy={yOf(p.value as number)}
              r={2.5}
              className="fill-chart-1"
            >
              <title>{`${fullTs(p.ts)} · ${format(p.value as number)}`}</title>
            </circle>
          ))
        : null}
    </ChartFrame>
  );
}

/** Legend row under a chart. */
export function Legend({ items }: { items: { swatch: string; label: ReactNode }[] }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((i, n) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static legend, never reorders
        <span key={n} className="inline-flex items-center gap-1.5">
          <span aria-hidden className={cn("inline-block size-2.5 rounded-sm", i.swatch)} />
          {i.label}
        </span>
      ))}
    </div>
  );
}
