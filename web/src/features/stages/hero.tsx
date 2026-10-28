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
  // Only what the record actually carries; a legacy state shows no row rather than dashes.
  const candidates: { label: string; value?: string }[] = [
    { label: c.stagesPage.settings.depth, value: state.depth },
    { label: c.stagesPage.settings.testStrategy, value: state.testStrategy },
    { label: c.stagesPage.settings.guardPolicy, value: state.guardPolicy },
    { label: c.stagesPage.settings.sensors, value: state.sensors },
    { label: c.stagesPage.settings.planApproval, value: state.planApproval },
    { label: c.stagesPage.settings.collaborators, value: state.collaborators },
  ];
  const settings = candidates.filter((x): x is { label: string; value: string } =>
    Boolean(x.value),
  );
  return (
    <Section title={s.overview.sectionProgress} icon={<GaugeIcon />}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <div className="min-w-0 space-y-0.5">
            <div className="text-lg font-semibold leading-7 break-words">
              {state.lifecyclePhase || "—"}
            </div>
            {meta ? <div className="text-sm text-muted-foreground break-words">{meta}</div> : null}
            {settings.length > 0 ? (
              <ul className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5 text-xs text-muted-foreground">
                {settings.map((setting) => (
                  <li key={setting.label} className="min-w-0">
                    <span className="font-medium">{setting.label}</span> {setting.value}
                  </li>
                ))}
              </ul>
            ) : null}
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
