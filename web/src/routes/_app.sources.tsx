import { Empty, PageHeader, Section } from "@/components/page";
import { IdentityCard } from "@/features/sources/identity-card";
import { SourcesTable } from "@/features/sources/sources-table";
import { useRun } from "@/hooks/use-run";
import { useI18n } from "@/i18n";
import { warningTextIn } from "@/i18n/warnings";
import { createFileRoute } from "@tanstack/react-router";
import { CircleCheckIcon, DatabaseIcon, TriangleAlertIcon } from "lucide-react";

export const Route = createFileRoute("/_app/sources")({ component: Page });

function Page() {
  const { s, c } = useI18n();
  const m = useRun().data!;
  return (
    <div className="space-y-6">
      <PageHeader title={c.nav.sources} lead={c.lead.sources} />

      {m.warnings.length > 0 ? (
        <Section
          title={s.page.warningsHeading}
          icon={<TriangleAlertIcon className="text-warning-foreground" />}
          className="border-warning/40"
        >
          <ul className="space-y-2">
            {m.warnings.map((w, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: warnings are a per-read list, never reordered
              <li key={i} className="flex gap-2 text-sm">
                <TriangleAlertIcon
                  aria-hidden
                  className="mt-0.5 size-4 shrink-0 text-warning-foreground"
                />
                <span className="min-w-0 break-words">{warningTextIn(w, s)}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : (
        <Empty className="flex items-center justify-center gap-2 py-4">
          <CircleCheckIcon aria-hidden className="size-4 text-success-foreground" />
          {c.sourcesPage.noWarnings}
        </Empty>
      )}

      <Section title={c.sourcesPage.freshness} icon={<DatabaseIcon />}>
        <SourcesTable m={m} />
      </Section>

      <IdentityCard id={m.identity} />
    </div>
  );
}
