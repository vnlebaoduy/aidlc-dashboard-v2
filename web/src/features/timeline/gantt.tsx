// The Gantt: one row per stage, each segment placed on the run's own clock. A bar's
// LENGTH is calendar occupancy; its FILL is that stretch's own split (so a night of
// parking never looks like a night of work); its OUTLINE is how the segment ended.
// The minutes per stage sit in a table below, which is also the accessible reading.

import { Note, Section, WarnNote } from "@/components/page";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type Strings, useI18n } from "@/i18n";
import { hours, mins, shortTs } from "@/lib/format";
import { LEGEND, Rich } from "@/lib/rich";
import { cn } from "@/lib/utils";
import type { DashboardModel } from "@server/model/types";
import type { StageEndKind, StageSpan, TimingReport } from "@server/scan/timing";
import { ChartGanttIcon } from "lucide-react";
import { Swatch, bucketsOf } from "./shared";

/**
 * The track's clock. Bars live on the RECORDED span (first event → last event); the
 * silence after the last event gets a fixed-width band at the right instead of its true
 * length — the KPI chart's rule. Drawn to scale, one long quiet stretch (6643h of 6677h on
 * the reference run) squeezes every bar into the first pixel.
 */
interface Clock {
  start: number;
  /** Recorded seconds the bar area spans. */
  span: number;
  /** % of the track the bar area occupies (100 without silence). */
  barPct: number;
  silenceSec: number;
}

const SILENCE_PCT = 8;

function clockOf(t: TimingReport): Clock {
  const silenceSec = Math.max(0, t.sinceLastEventSec);
  const recorded = t.elapsedSec - silenceSec;
  return recorded > 0 && silenceSec > 0
    ? { start: Date.parse(t.firstTs!), span: recorded, barPct: 100 - SILENCE_PCT, silenceSec }
    : { start: Date.parse(t.firstTs!), span: t.elapsedSec, barPct: 100, silenceSec: 0 };
}

/**
 * Track offset + width as percentages of the track. A 0-second stage (the bootstrap
 * stages stamp STARTED and COMPLETED in the same second) gets a tick, not a bar: the
 * 0.4% floor that keeps a short bar visible would make a 0.0min stage as wide as a
 * 30min one.
 */
function trackGeometry(
  startedAt: string,
  elapsedSec: number,
  k: Clock,
): { left: number; width: number; tick: boolean } {
  if (k.span <= 0) return { left: 0, width: k.barPct, tick: false };
  const left = Math.min(
    k.barPct,
    Math.max(0, ((Date.parse(startedAt) - k.start) / 1000 / k.span) * k.barPct),
  );
  // A segment still open runs into the silence; it is cut at the recorded edge.
  const width = Math.min(k.barPct - left, (elapsedSec / k.span) * k.barPct);
  if (elapsedSec <= 0) return { left, width: 0, tick: true };
  return { left, width: Math.max(0.4, width), tick: false };
}

/** Outline per end kind, as `ganttLegend` names them: teal, grey, orange, blue, dashed. */
const OUTLINE: Record<StageEndKind, string> = {
  completed: "ring-2 ring-chart-2",
  skipped: "ring-2 ring-muted-foreground opacity-55",
  "awaiting-approval": "ring-2 ring-warning",
  "in-flight": "ring-2 ring-chart-1",
  superseded: "outline-2 outline-dashed outline-muted-foreground opacity-60",
};

const TICK: Record<StageEndKind, string> = {
  completed: "bg-chart-2",
  skipped: "bg-muted-foreground",
  "awaiting-approval": "bg-warning",
  "in-flight": "bg-chart-1",
  superseded: "bg-muted-foreground",
};

/** The silence band: fixed width at the right edge, outside every bar. */
const BAND = { left: `${100 - SILENCE_PCT}%`, width: `${SILENCE_PCT}%` };

function Track({ sp, k, x }: { sp: StageSpan; k: Clock; x: Strings["timeline"] }) {
  return (
    <div className="overflow-hidden px-1 py-1">
      <div className="relative h-4">
        {k.silenceSec > 0 ? (
          <span aria-hidden className="absolute inset-y-0 bg-muted" style={BAND} />
        ) : null}
        <span aria-hidden className="absolute inset-x-0 top-1/2 h-px bg-border" />
        {sp.segments.map((g) => {
          const geo = trackGeometry(g.startedAt, g.elapsedSec, k);
          const tip = x.segmentTip(
            sp.stage,
            x.endKinds[g.endKind],
            shortTs(g.startedAt),
            shortTs(g.endedAt),
            x.splitLine(
              mins(g.humanWaitSec),
              mins(g.parkedSec),
              mins(g.observedSec),
              mins(g.conversationSec),
              mins(g.unknownSec),
            ),
          );
          if (geo.tick) {
            return (
              <span
                key={`${g.startedAt}-${g.endKind}`}
                title={`${tip}\n${x.zeroSecondTip}`}
                className={cn(
                  "absolute inset-y-0 w-0.5 -translate-x-1/2 cursor-help",
                  TICK[g.endKind],
                )}
                style={{ left: `${geo.left.toFixed(2)}%` }}
              />
            );
          }
          const total =
            g.humanWaitSec + g.parkedSec + g.observedSec + g.conversationSec + g.unknownSec;
          return (
            <span
              key={`${g.startedAt}-${g.endKind}`}
              title={tip}
              className={cn(
                "absolute top-0.5 flex h-3 cursor-help overflow-hidden rounded-full bg-border ring-offset-1 ring-offset-card",
                OUTLINE[g.endKind],
              )}
              style={{ left: `${geo.left.toFixed(2)}%`, width: `${geo.width.toFixed(2)}%` }}
            >
              {total > 0
                ? bucketsOf(g, x)
                    .filter((b) => b.sec > 0)
                    .map((b) => (
                      <i
                        key={b.kind}
                        className={cn("block h-full min-w-px", b.swatch)}
                        style={{ width: `${((b.sec / total) * 100).toFixed(2)}%` }}
                      />
                    ))
                : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** Four local-date ticks across the recorded span, then the silence band labelled +Nh. */
function Axis({ k }: { k: Clock }) {
  const { s } = useI18n();
  const ticks = 4;
  return (
    <div className="px-1">
      <div className="relative h-5 text-xs text-muted-foreground tabular">
        {k.silenceSec > 0 ? (
          <span
            title={s.timeline.axisSilenceTip(hours(k.silenceSec))}
            className="absolute inset-y-0 flex cursor-help items-center justify-center rounded-sm border border-dashed border-muted-foreground/40 bg-muted text-[11px] leading-none"
            style={BAND}
          >
            +{hours(k.silenceSec)}
          </span>
        ) : null}
        {Array.from({ length: ticks + 1 }, (_, i) => {
          const at = new Date(k.start + (k.span * 1000 * i) / ticks);
          const date = `${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
          // Under four days the date alone repeats; show the hour like the KPI axis.
          const label =
            k.span < 4 * 86400 ? `${date} ${String(at.getHours()).padStart(2, "0")}:00` : date;
          return (
            <span
              key={label + String(i)}
              className={cn(
                "absolute top-0.5 whitespace-nowrap leading-4",
                i === 0 ? "" : i === ticks ? "-translate-x-full" : "-translate-x-1/2",
                i % 2 === 1 && "hidden md:inline",
              )}
              style={{ left: `${((i / ticks) * k.barPct).toFixed(2)}%` }}
            >
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** Abbreviated so the cell stays one line; the full text is the cell's tooltip. */
function workloadText(sp: StageSpan, x: Strings["timeline"]): string {
  const w = sp.workload;
  return [
    w.artifacts ? x.loadArtifacts(w.artifacts) : "",
    // `sensor` is the engine's own noun and reads the same in both languages.
    w.sensors ? `sensor ${w.sensors}` : "",
    w.sensorFailures ? x.loadFailures(w.sensorFailures) : "",
    w.delegations ? x.loadDelegations(w.delegations) : "",
    w.humanTurns ? x.loadHumanTurns(w.humanTurns) : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

export function Gantt({ m }: { m: DashboardModel }) {
  const { s, c } = useI18n();
  const x = s.timeline;
  const t = m.timing;
  const k = clockOf(t);
  const num = "text-right tabular";
  const head = (label: string, swatch?: string, tip?: string) => (
    <TableHead className="text-right" title={tip}>
      <span className="inline-flex items-center gap-1.5">
        {swatch ? <Swatch className={swatch} /> : null}
        {label}
      </span>
    </TableHead>
  );

  return (
    <Section title={c.timelinePage.gantt} icon={<ChartGanttIcon />} contentClassName="space-y-4">
      <div className="space-y-2">
        <div className="hidden gap-4 sm:grid sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]">
          <div className="text-xs font-medium text-muted-foreground">{x.colStage}</div>
          <div className="space-y-1">
            <div className="px-1 text-xs font-medium text-muted-foreground">{x.colTrack}</div>
            <Axis k={k} />
          </div>
        </div>
        <div className="sm:hidden">
          <Axis k={k} />
        </div>
        <ul className="divide-y">
          {t.stages.map((sp) => (
            <li
              key={sp.stage}
              className="grid gap-x-4 py-1.5 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] sm:items-center"
            >
              <span
                className="flex min-w-0 items-center gap-2 text-sm font-medium"
                title={sp.stage}
              >
                <StageNumber n={m.stageNumbers[sp.stage]} />
                <span className="truncate">{sp.stage}</span>
              </span>
              <Track sp={sp} k={k} x={x} />
            </li>
          ))}
        </ul>
      </div>
      <Note>
        <Rich html={x.ganttLegend} />
      </Note>
      <WarnNote>
        <Rich html={x.observedCaveat} />
      </WarnNote>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">{c.timelinePage.figures}</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{x.colStage}</TableHead>
              {head(x.colTotalMin)}
              {head(x.colWait, LEGEND.wait)}
              {head(x.colParked, LEGEND.parked)}
              {head(x.colObserved, LEGEND.observed)}
              {head(x.colConversation, LEGEND.conv, x.colConversationTip)}
              {head(x.colUnknown, LEGEND.unknown)}
              {head(x.colWorkEstimate, undefined, x.colWorkEstimateTip)}
              <TableHead>{x.colWorkload}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {t.stages.map((sp) => {
              const load = workloadText(sp, x);
              return (
                <TableRow key={sp.stage}>
                  <TableHead scope="row" className="font-medium">
                    <span className="inline-flex items-center gap-2">
                      <StageNumber n={m.stageNumbers[sp.stage]} />
                      {sp.stage}
                    </span>
                  </TableHead>
                  <TableCell className={num}>{mins(sp.elapsedSec)}</TableCell>
                  <TableCell className={num}>{mins(sp.humanWaitSec)}</TableCell>
                  <TableCell className={num}>{mins(sp.parkedSec)}</TableCell>
                  <TableCell className={num}>{mins(sp.observedSec)}</TableCell>
                  <TableCell className={num}>{mins(sp.conversationSec)}</TableCell>
                  <TableCell className={num}>{mins(sp.unknownSec)}</TableCell>
                  <TableCell className={cn(num, "font-semibold")}>{mins(sp.workSec)}</TableCell>
                  <TableCell className="max-w-64 truncate text-muted-foreground" title={load}>
                    {load}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Section>
  );
}

/**
 * The engine's PHASE.STAGE number ("1.3"), so a stage's place in the lifecycle reads at a
 * glance. Fixed width so the names line up; nothing when the catalogue gave no number.
 */
function StageNumber({ n }: { n: string | undefined }) {
  if (!n) return null;
  return (
    <span className="inline-flex h-5 w-9 shrink-0 items-center justify-center rounded-sm bg-muted font-mono text-xs text-muted-foreground tabular">
      {n}
    </span>
  );
}
