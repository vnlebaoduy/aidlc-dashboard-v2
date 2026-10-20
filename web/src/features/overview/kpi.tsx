// The KPI trio and the one chart the selected tile drives (v1 render/kpi.ts).
//
// THREE TILES, EACH FROM ONE SOURCE. Progress is state.md's checkbox count, usage is the
// harness's own usage source (Kiro credits over ACP, or Claude Code's measured tokens),
// and time is the audit ledger's classified work + conversation. None is combined with
// another into a score.
//
// The time figure is `observedSec + conversationSec` over the MERGED timeline — the same
// basis as the Stage card and the Timeline page. It leaves out human waits, parked time
// and unclassified gaps; the unclassified part is stated under the tile, never dropped.
// On a multi-shard run merged time is the team's clock, so person-time is stated beside it.
//
// Both timing charts share one time axis: the recorded span, then a FIXED-WIDTH band for
// the stretch after the last event, labelled with its real length (see `axisOf`).

import { ChartFrame, Legend, LineChart, trendAria, windowLabel } from "@/components/charts";
import { Note, Section } from "@/components/page";
import { type Strings, useI18n } from "@/i18n";
import { hours } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DashboardModel } from "@server/model/types";
import { BIN_SEC, type TimingReport } from "@server/scan/timing";
import { Link } from "@tanstack/react-router";
import {
  ArrowRightIcon,
  ChartLineIcon,
  ChartNoAxesColumnIcon,
  ChartSplineIcon,
} from "lucide-react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { type ReactNode, useState } from "react";

// Close to the chart's rendered width on a laptop screen, so 11-unit text renders near 11px.
const W = 1160;
const H = 200;
const PAD = { top: 12, right: 12, bottom: 24, left: 44 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;
/** Width of the band standing for the silence after the last event, in SVG units. */
const SILENCE_W = 64;

const SWATCH = { work: "bg-chart-1", chat: "bg-chart-2", silence: "bg-muted-foreground/35" };

/** Locale-independent compact count, as v1: 12,345,678 → 12.3M; under 10k in full. */
function compactCount(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (a >= 1e4) return `${(n / 1e3).toFixed(1)}k`;
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** `MM-DD` in local time — the timeline axis uses the same form. */
function day(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** `MM-DD HH:00` in local time, for a bin's hover text and short-span ticks. */
function dayHour(ms: number): string {
  return `${day(ms)} ${String(new Date(ms).getHours()).padStart(2, "0")}:00`;
}

interface Axis {
  from: number;
  /** End of the RECORDED span: the last event. */
  to: number;
  /** Right edge of the recorded span in SVG units; the silence band starts here. */
  recordedRight: number;
  xOf(ms: number): number;
}

/**
 * The axis covers first event to LAST EVENT; the silence after it gets a fixed-width band
 * rather than its true length, so a tree opened weeks later does not squash the run into
 * a sliver. The band's label states the real length, so the scale break is said.
 */
function axisOf(t: TimingReport): Axis | undefined {
  if (t.bins.length === 0 || !t.firstTs || !t.lastEventTs) return undefined;
  const from = Date.parse(t.firstTs);
  // A 0-second run still gets an axis; everything on it lands at the left edge.
  const to = Math.max(Date.parse(t.lastEventTs), from + 1);
  const recordedRight = PAD.left + PLOT_W - (t.sinceLastEventSec > 0 ? SILENCE_W : 0);
  return {
    from,
    to,
    recordedRight,
    xOf: (ms) => PAD.left + ((ms - from) / (to - from)) * (recordedRight - PAD.left),
  };
}

/** Frame, date ticks over the recorded span, and the band after the last event. */
function Frame({ t, ax, s, yTop }: { t: TimingReport; ax: Axis; s: Strings; yTop: string }) {
  const base = PAD.top + PLOT_H;
  // Ticks sit on bin boundaries (whole local hours 00/06/12/18), so a label never rounds
  // the time it marks. A span under about four days carries the hour too.
  const label = ax.to - ax.from < 4 * 86400 * 1000 ? dayHour : day;
  const edges: number[] = [];
  const first = t.bins[0] ? Date.parse(t.bins[0].start) : ax.from;
  for (let ms = first; ms <= ax.to; ms += BIN_SEC * 1000) if (ms >= ax.from) edges.push(ms);
  const step = Math.max(1, Math.ceil(edges.length / 5));
  const ticks = edges.filter((_, k) => k % step === 0);
  const silence = hours(t.sinceLastEventSec);
  const bx = ax.recordedRight + 2;
  return (
    <>
      {t.sinceLastEventSec > 0 ? (
        <g>
          <title>{s.timeline.axisSilenceTip(silence)}</title>
          <rect
            x={bx}
            y={PAD.top}
            width={SILENCE_W - 2}
            height={PLOT_H}
            className="fill-muted-foreground opacity-10"
          />
          <text x={bx + (SILENCE_W - 2) / 2} y={PAD.top + PLOT_H / 2} textAnchor="middle">
            +{silence}
          </text>
        </g>
      ) : null}
      <line x1={PAD.left} y1={base} x2={ax.recordedRight} y2={base} className="stroke-border" />
      <text x={PAD.left - 6} y={PAD.top + 9} textAnchor="end">
        {yTop}
      </text>
      <text x={PAD.left - 6} y={base} textAnchor="end">
        0
      </text>
      {ticks.map((ms) => {
        const px = ax.xOf(ms);
        const anchor = px < PAD.left + 40 ? "start" : px > ax.recordedRight - 40 ? "end" : "middle";
        return (
          <text key={ms} x={px.toFixed(1)} y={H - 6} textAnchor={anchor}>
            {label(ms)}
          </text>
        );
      })}
    </>
  );
}

/**
 * First completion time of each stage slug, oldest first. A stage re-completed after
 * rework is counted once, at its FIRST completion.
 */
function completions(t: TimingReport): number[] {
  const out: number[] = [];
  for (const st of t.stages) {
    const done = st.segments.find((g) => g.endKind === "completed");
    if (done) out.push(Date.parse(done.endedAt));
  }
  return out.filter(Number.isFinite).sort((a, b) => a - b);
}

function ProgressChart({ t, s }: { t: TimingReport; s: Strings }) {
  const ax = axisOf(t);
  if (!ax) return <Note>{s.kpi.noEvents}</Note>;
  const done = completions(t);
  const top = Math.max(done.length, 1);
  const yOf = (n: number) => PAD.top + PLOT_H - (n / top) * PLOT_H;
  // A step, not a slope: the count is constant between completions.
  const pts = [`${ax.xOf(ax.from).toFixed(1)},${yOf(0).toFixed(1)}`];
  done.forEach((ms, i) => {
    pts.push(`${ax.xOf(ms).toFixed(1)},${yOf(i).toFixed(1)}`);
    pts.push(`${ax.xOf(ms).toFixed(1)},${yOf(i + 1).toFixed(1)}`);
  });
  // The line stops at the last event; the band after it says why it goes no further.
  pts.push(`${ax.xOf(ax.to).toFixed(1)},${yOf(done.length).toFixed(1)}`);
  return (
    <>
      <ChartFrame aria={s.kpi.progressChartAria(done.length)} width={W} height={H}>
        <Frame t={t} ax={ax} s={s} yTop={String(top)} />
        <polyline fill="none" strokeWidth={2} points={pts.join(" ")} className="stroke-chart-1" />
      </ChartFrame>
      <Legend items={[{ swatch: SWATCH.silence, label: s.kpi.legendSilence }]} />
      <Note className="mt-2">{s.kpi.progressChartNote}</Note>
    </>
  );
}

function TimeChart({ t, s }: { t: TimingReport; s: Strings }) {
  const ax = axisOf(t);
  const k = s.kpi;
  if (!ax) return <Note>{k.noEvents}</Note>;
  const peak = Math.max(0, ...t.bins.map((b) => b.observedSec + b.conversationSec));
  const base = PAD.top + PLOT_H;
  const hOf = (sec: number) => (peak > 0 ? (sec / peak) * PLOT_H : 0);
  const total = t.total.observedSec + t.total.conversationSec;
  return (
    <>
      <ChartFrame aria={k.timeChartAria(hours(total), t.bins.length)} width={W} height={H}>
        <Frame t={t} ax={ax} s={s} yTop={hours(peak)} />
        {t.bins.map((b) => {
          // Clipped to the recorded span: the first bin starts before the first event and
          // the last one runs past the last, and neither part was recorded.
          const start = Date.parse(b.start);
          const x0 = ax.xOf(Math.max(start, ax.from));
          const bw = Math.max(1, ax.xOf(Math.min(start + BIN_SEC * 1000, ax.to)) - x0 - 1);
          const hw = hOf(b.observedSec);
          const hc = hOf(b.conversationSec);
          const tip = k.binTip(
            dayHour(start),
            hours(b.observedSec),
            hours(b.conversationSec),
            hours(b.humanWaitSec),
            hours(b.parkedSec),
            hours(b.unknownSec),
          );
          // One group per bin so the hover text covers the whole column, empty or not.
          return (
            <g key={b.start}>
              <title>{tip}</title>
              <rect x={x0} y={PAD.top} width={bw} height={PLOT_H} fill="transparent" />
              {hw > 0 ? (
                <rect x={x0} y={base - hw} width={bw} height={hw} className="fill-chart-1" />
              ) : null}
              {hc > 0 ? (
                <rect x={x0} y={base - hw - hc} width={bw} height={hc} className="fill-chart-2" />
              ) : null}
            </g>
          );
        })}
      </ChartFrame>
      <Legend
        items={[
          { swatch: SWATCH.work, label: k.legendWork },
          { swatch: SWATCH.chat, label: k.legendChat },
          { swatch: SWATCH.silence, label: k.legendSilence },
        ]}
      />
    </>
  );
}

interface Tile {
  key: string;
  label: string;
  value: string;
  sub: string;
  /** Second small line — an exclusion or a caveat. */
  note?: string;
  tip?: string;
  /** Dashed: no record behind the tile, which must not read as a figure. */
  missing?: boolean;
  chartTitle: string;
  chartIcon: ReactNode;
  /** Page holding the full view of this tile's source. */
  more: "/stages" | "/usage" | "/timeline";
  chart: ReactNode;
}

function progressTile(m: DashboardModel, s: Strings): Tile {
  const st = m.state;
  return {
    key: "progress",
    label: s.kpi.progressLabel,
    value: `${st.overallPct}%`,
    sub: s.kpi.progressSub(st.overallDone, st.overallTotal),
    chartTitle: s.kpi.progressChartTitle,
    chartIcon: <ChartLineIcon />,
    more: "/stages",
    chart: <ProgressChart t={m.timing} s={s} />,
  };
}

function usageTile(m: DashboardModel, s: Strings): Tile {
  const k = s.kpi;
  const base = {
    key: "usage",
    label: k.usageLabel,
    chartIcon: <ChartSplineIcon />,
    more: "/usage",
  } as const;
  if (m.usage.kind === "claude") {
    const tk = m.usage.tokens;
    const w = windowLabel(tk.trend.window, s);
    const sum = tk.trend.summary;
    const aria =
      sum.count === 0
        ? s.usage.tokenChartEmpty(w)
        : s.usage.tokenChartSummary(
            w,
            sum.count,
            compactCount(sum.min ?? 0),
            compactCount(sum.max ?? 0),
            compactCount(sum.latest ?? 0),
          );
    const none = tk.status === "none";
    return {
      ...base,
      value: none ? "—" : compactCount(tk.grandTotal),
      sub: none ? k.usageNone : k.tokenSub(w),
      missing: none,
      chartTitle: s.usage.tokenSection,
      chart: <LineChart series={tk.trend} s={s} aria={aria} width={W} height={H} />,
    };
  }
  const cur = m.usage.credit.current;
  const used = cur?.usedAmount ?? null;
  const limit = cur?.planLimit ?? null;
  // The source's own ratio first (ACP's percentage / 100); a ratio of the two measured
  // amounts only when it sent none. Never clamped: an overage is real.
  const ratio =
    cur?.usageRatio ?? (used !== null && limit !== null && limit > 0 ? used / limit : null);
  const pct = ratio === null || limit === null ? undefined : `${(ratio * 100).toFixed(1)}%`;
  const trend = m.usage.credit.trend;
  return {
    ...base,
    value: used === null ? "—" : compactCount(used),
    sub:
      used === null
        ? k.usageNone
        : k.creditSub(limit === null || pct === undefined ? undefined : compactCount(limit), pct),
    missing: used === null,
    chartTitle: s.usage.creditSection,
    chart: <LineChart series={trend} s={s} aria={trendAria(trend, s)} width={W} height={H} />,
  };
}

function timeTile(m: DashboardModel, s: Strings): Tile {
  const t = m.timing;
  const k = s.kpi;
  const none = t.bins.length === 0;
  const notes: string[] = [];
  if (t.total.unknownSec > 0) notes.push(k.timeExcluded(hours(t.total.unknownSec)));
  // Same gate as the timeline's merged-view note (`parallel`), not overlap: even a
  // sequential handover puts cross-clone gaps into the merged timeline. "At once" is
  // claimed only when the windows actually overlapped.
  if (t.parallel) {
    notes.push(
      k.personTime(
        hours(t.personObservedSec + t.personConversationSec),
        t.clones,
        t.overlapSec > 0,
      ),
    );
  }
  return {
    key: "time",
    label: k.timeLabel,
    value: none ? "—" : hours(t.total.observedSec + t.total.conversationSec),
    sub: none ? k.noEvents : k.timeSub(hours(t.total.observedSec), hours(t.total.conversationSec)),
    note: notes.length > 0 ? notes.join(" · ") : undefined,
    tip: k.timeTip,
    missing: none,
    chartTitle: k.timeChartTitle,
    chartIcon: <ChartNoAxesColumnIcon />,
    more: "/timeline",
    chart: <TimeChart t={t} s={s} />,
  };
}

export function KpiStrip({ m }: { m: DashboardModel }) {
  const { s, c } = useI18n();
  // Default is the first tile; the reader's pick sticks across polls (state is local).
  const [picked, setPicked] = useState("progress");
  const tiles = [progressTile(m, s), usageTile(m, s), timeTile(m, s)];
  return (
    <TabsPrimitive.Root value={picked} onValueChange={setPicked} className="space-y-4">
      <TabsPrimitive.List aria-label={s.kpi.heading} className="grid min-w-0 gap-4 md:grid-cols-3">
        {tiles.map((t) => (
          <TabsPrimitive.Trigger
            key={t.key}
            value={t.key}
            title={t.tip}
            className={cn(
              "group relative flex min-w-0 flex-col items-start gap-1 overflow-hidden rounded-lg border bg-card px-5 py-4 text-left outline-none transition-colors hover:border-foreground/30 focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=active]:border-foreground/60",
              t.missing && "border-dashed",
            )}
          >
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-1 bg-primary opacity-0 transition-opacity group-data-[state=active]:opacity-100"
            />
            <span className="text-xs font-medium text-muted-foreground">{t.label}</span>
            <span
              className={cn(
                "text-3xl leading-10 font-semibold tabular",
                t.missing && "text-muted-foreground",
              )}
            >
              {t.value}
            </span>
            <span className="text-xs text-muted-foreground">{t.sub}</span>
            {t.note ? (
              <span className="border-l-2 border-warning pl-2 text-xs text-muted-foreground">
                {t.note}
              </span>
            ) : null}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {tiles.map((t) => (
        <TabsPrimitive.Content key={t.key} value={t.key} className="min-w-0 outline-none">
          <Section
            title={t.chartTitle}
            icon={t.chartIcon}
            action={
              <Link
                to={t.more}
                search={(p) => p}
                className="inline-flex items-center gap-1 text-sm font-medium text-brand-blue underline-offset-4 hover:underline"
              >
                {c.openFull}
                <ArrowRightIcon aria-hidden className="size-3.5" />
              </Link>
            }
          >
            {t.chart}
          </Section>
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}
