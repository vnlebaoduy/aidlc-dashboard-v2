// Overview: is the run moving, what needs me, how far along is it, what did it cost.
// Top to bottom: read warnings, the actionable items, the run's OUTCOMES.md pack when
// there is one, the KPI trio and its chart, then the four summary cards in reading order
// stage → unit → unresolved → health.

import { PageHeader, WarnNote } from "@/components/page";
import { RunPill } from "@/components/run-pill";
import { StageCard, UnitCard, UnresolvedCard } from "@/features/overview/cards";
import { NeedsYou, RunHealthCard } from "@/features/overview/health";
import { KpiStrip } from "@/features/overview/kpi";
import { OutcomesCard } from "@/features/overview/outcomes";
import { useRun } from "@/hooks/use-run";
import { useI18n } from "@/i18n";
import { warningTextIn } from "@/i18n/warnings";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRightIcon } from "lucide-react";

export const Route = createFileRoute("/_app/")({ component: Page });

function Page() {
  const { s, c } = useI18n();
  const m = useRun().data!;
  return (
    <div className="space-y-6">
      <PageHeader title={c.nav.overview} lead={c.lead.overview} />
      {/* The header pill is hidden below lg; those readers get the run state here. */}
      <RunPill m={m} className="max-w-full lg:hidden" />
      {m.warnings.length > 0 ? (
        <WarnNote>
          <p className="font-medium text-foreground">{s.page.warningsHeading}</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {m.warnings.map((w) => (
              <li key={w.code}>{warningTextIn(w, s)}</li>
            ))}
          </ul>
          <Link
            to="/sources"
            search={(p) => p}
            className="mt-2 inline-flex items-center gap-1 font-medium text-brand-blue underline-offset-4 hover:underline"
          >
            {c.overviewPage.readWarnings(m.warnings.length)}
            <ArrowRightIcon aria-hidden className="size-3.5" />
          </Link>
        </WarnNote>
      ) : null}
      {m.signals?.guardRefusals.some((r) => r.pendingAsk) ? (
        <WarnNote>
          <ul className="space-y-1">
            {m.signals.guardRefusals
              .filter((r) => r.pendingAsk)
              .map((r) => (
                <li key={`${r.stage}:${r.unit ?? ""}`}>
                  {c.overviewPage.guardRefusal(r.stage, r.count)}
                </li>
              ))}
          </ul>
        </WarnNote>
      ) : null}
      <NeedsYou m={m} />
      <OutcomesCard m={m} />
      <KpiStrip m={m} />
      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <StageCard m={m} />
        <UnitCard m={m} />
        <UnresolvedCard m={m} />
        <RunHealthCard m={m} />
      </div>
    </div>
  );
}
