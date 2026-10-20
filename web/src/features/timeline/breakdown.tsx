// The headline (window total — the DENOMINATOR, not a sixth bucket) and the five-bucket
// bar with a legend carrying both the hours and the share, then the date range, what
// the run is on right now, and the merged-view warning.

import { Note, Section, Stat, WarnNote } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useI18n } from "@/i18n";
import { hours, shortTs } from "@/lib/format";
import { Rich, esc } from "@/lib/rich";
import { cn } from "@/lib/utils";
import type { DashboardModel } from "@server/model/types";
import { ChartBarStackedIcon } from "lucide-react";
import { Swatch, bucketsOf, pctOf } from "./shared";

/**
 * The window total stands alone because it is what everything else is a part of; the
 * classified span sits beside it because THAT is what the percentages divide by. The
 * gap between the two (the unrecorded stretch) is named once, in the date-range note.
 */
export function Headline({ m }: { m: DashboardModel }) {
  const { s, c } = useI18n();
  const x = s.timeline;
  const t = m.timing;
  const classified = t.elapsedSec - t.sinceLastEventSec;
  const windowTip =
    t.sinceLastEventSec > 0 ? x.windowTipOpen(hours(t.sinceLastEventSec)) : x.windowTipClosed;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Stat
        label={t.parallel ? x.windowTeam : x.windowSolo}
        value={
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="cursor-help rounded-sm underline decoration-muted-foreground/40 decoration-dotted underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {hours(t.elapsedSec)}
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">{windowTip}</TooltipContent>
          </Tooltip>
        }
        sub={`${pctOf(classified, t.elapsedSec)}% ${c.timelinePage.classifiedShare}`}
      />
      <Stat
        label={c.timelinePage.classified}
        value={hours(classified)}
        sub={<Rich html={x.windowSub(esc(hours(classified)))} />}
      />
    </div>
  );
}

export function Breakdown({ m }: { m: DashboardModel }) {
  const { s, c } = useI18n();
  const x = s.timeline;
  const t = m.timing;
  // Shares are OF THE CLASSIFIED SPAN: nothing past the last event is classified, so
  // dividing by the window would shrink every share on each poll of a quiet tree.
  const classified = t.elapsedSec - t.sinceLastEventSec;
  const parts = bucketsOf(t.total, x);
  const inFlight = t.stages.filter((sp) => sp.endKind === "in-flight");
  const nowLine = `${
    inFlight.length
      ? x.inFlight(
          inFlight.map((sp) => `<b>${esc(sp.stage)}</b> ${esc(hours(sp.elapsedSec))}`).join(" · "),
        )
      : esc(x.noneInFlight)
  } · ${t.awaitingStage ? x.awaiting(esc(t.awaitingStage)) : x.awaitingNone}${
    m.rework.provisional ? esc(x.reworkPending) : ""
  }`;

  return (
    <Section
      title={c.timelinePage.breakdown}
      icon={<ChartBarStackedIcon />}
      contentClassName="space-y-4"
    >
      <div
        role="img"
        aria-label={parts.map((p) => `${p.label} ${pctOf(p.sec, classified)}%`).join(", ")}
        className="flex h-4 w-full overflow-hidden rounded-full bg-muted"
      >
        {parts
          .filter((p) => p.sec > 0)
          .map((p) => (
            <span
              key={p.kind}
              className={cn("h-full", p.swatch)}
              style={{ width: `${pctOf(p.sec, classified)}%` }}
              title={`${p.label} ${hours(p.sec)} (${pctOf(p.sec, classified)}%)`}
            />
          ))}
      </div>

      <ul className="flex flex-wrap gap-x-6 gap-y-2">
        {parts.map((p) => (
          <li key={p.kind} className="min-w-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex cursor-help items-baseline gap-1.5 rounded-sm text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <Swatch className={cn("self-center", p.swatch)} />
                  <strong className="font-semibold tabular">{hours(p.sec)}</strong>
                  <span>{p.label}</span>
                  <span className="text-muted-foreground tabular">{pctOf(p.sec, classified)}%</span>
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">{p.tip}</TooltipContent>
            </Tooltip>
          </li>
        ))}
      </ul>

      <Note className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="tabular">
          {shortTs(t.firstTs)} ~ {shortTs(t.lastEventTs ?? t.lastTs)}
        </span>
        {t.sinceLastEventSec > 0 ? (
          <Badge variant="warning">{x.unrecordedPill(hours(t.sinceLastEventSec))}</Badge>
        ) : null}
        {t.parallel ? <Badge variant="warning">{x.clonesPill(t.clones)}</Badge> : null}
        <span>{x.delegated(hours(t.total.delegatedSec))}</span>
      </Note>
      <p className="text-sm">
        <Rich html={nowLine} />
      </p>
      {t.parallel ? (
        <WarnNote>
          <Rich html={x.mergedNote(t.workers.length, t.clones)} />
        </WarnNote>
      ) : null}
    </Section>
  );
}
