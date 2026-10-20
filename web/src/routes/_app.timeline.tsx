import { Empty, PageHeader, WarnNote } from "@/components/page";
import { Breakdown, Headline } from "@/features/timeline/breakdown";
import { Gantt } from "@/features/timeline/gantt";
import { UnknownGaps } from "@/features/timeline/gaps";
import { Rework } from "@/features/timeline/rework";
import { Workers } from "@/features/timeline/workers";
import { useRun } from "@/hooks/use-run";
import { useI18n } from "@/i18n";
import { hours } from "@/lib/format";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/timeline")({ component: Page });

function Page() {
  const { s, c } = useI18n();
  const m = useRun().data!;
  const t = m.timing;
  const header = <PageHeader title={c.nav.timeline} lead={c.lead.timeline} />;
  if (t.stages.length === 0 || !t.firstTs) {
    return (
      <div className="space-y-6">
        {header}
        <Empty>{s.timeline.noStageSpans}</Empty>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {header}
      <Headline m={m} />
      <Breakdown m={m} />
      <Gantt m={m} />
      <Rework m={m} />
      {t.parallel ? <Workers t={t} /> : null}
      {t.total.unknown.length > 0 ? <UnknownGaps t={t} /> : null}
      {t.total.inferredParkSec > 0 || t.total.parkAnomalies > 0 ? (
        <WarnNote>
          {s.timeline.inferredPark(hours(t.total.inferredParkSec), t.total.parkAnomalies)}
        </WarnNote>
      ) : null}
    </div>
  );
}
