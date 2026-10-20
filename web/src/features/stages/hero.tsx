// Where the run is and how far along. The percentage is state.md's flat checkbox count,
// deliberately the same number the engine's own status line reports.

import { Section } from "@/components/page";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/i18n";
import { shortTs } from "@/lib/format";
import type { DashboardModel } from "@server/model/types";
import { GaugeIcon } from "lucide-react";

export function Hero({ m }: { m: DashboardModel }) {
  const { s, c } = useI18n();
  const { state, identity } = m;
  const meta = [identity.scope ?? state.scope, state.projectType, identity.status]
    .filter((x) => x && x.length > 0)
    .join(" · ");
  const now = state.complete
    ? s.overview.runComplete
    : `${state.currentStageDisplay || "—"}${
        state.activeAgentDisplay ? ` · ${state.activeAgentDisplay}` : ""
      }`;
  return (
    <Section title={s.overview.sectionProgress} icon={<GaugeIcon />}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <div className="min-w-0 space-y-0.5">
            <div className="text-lg font-semibold leading-7 break-words">
              {state.lifecyclePhase || "—"}
            </div>
            {meta ? <div className="text-sm text-muted-foreground break-words">{meta}</div> : null}
          </div>
          <div className="text-4xl font-semibold leading-none tabular">{state.overallPct}%</div>
        </div>
        <Progress
          value={state.overallPct}
          live={!state.complete}
          aria-label={`${state.overallPct}%`}
        />
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
          <div className="min-w-0 break-words">
            <span className="font-medium text-muted-foreground">{s.overview.nowLabel}</span> {now}
          </div>
          <div className="text-muted-foreground tabular">
            {c.stagesPage.stageCount(state.overallDone, state.overallTotal)}
          </div>
        </div>
        <div className="text-xs text-muted-foreground break-all">
          {identity.record} · {s.overview.updatedLabel} {shortTs(state.lastUpdated)}
        </div>
      </div>
    </Section>
  );
}
