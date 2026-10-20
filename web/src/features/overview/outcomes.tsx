// The run's OUTCOMES.md handover pack, when there is one. Hidden when neither the
// record nor the workspace root holds the file: an empty card would say nothing.
// A root copy is flagged, because the next intent's run overwrites it.

import { Section } from "@/components/page";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { fmtBytes, fullTs } from "@/lib/format";
import type { DashboardModel } from "@server/model/types";
import { Link } from "@tanstack/react-router";
import { ArrowRightIcon, FileTextIcon, TriangleAlertIcon } from "lucide-react";

export function OutcomesCard({ m }: { m: DashboardModel }) {
  const { c } = useI18n();
  const t = c.overviewPage;
  const o = m.outcomes;
  if (!o) return null;
  return (
    <Section
      title={t.outcomesTitle}
      icon={<FileTextIcon />}
      description={t.outcomesLead}
      action={
        <Button variant="outline" size="sm" asChild>
          <Link to="/view" search={{ rel: o.rel, mode: "preview", from: "/" }}>
            {t.outcomesOpen}
            <ArrowRightIcon aria-hidden />
          </Link>
        </Button>
      }
      contentClassName="space-y-2 text-sm"
    >
      <p className="font-mono text-xs text-muted-foreground tabular-nums">
        {t.outcomesMeta(fmtBytes(o.sizeBytes), fullTs(o.modifiedAt))}
      </p>
      {o.where === "workspace" ? (
        <p className="flex gap-2 text-warning-foreground">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{t.outcomesFromWorkspace}</span>
        </p>
      ) : null}
    </Section>
  );
}
