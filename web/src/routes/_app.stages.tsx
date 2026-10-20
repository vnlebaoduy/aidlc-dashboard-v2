import { PageHeader } from "@/components/page";
import { Hero } from "@/features/stages/hero";
import { Matrix } from "@/features/stages/matrix";
import { Phases } from "@/features/stages/phases";
import { UnitProgressTable } from "@/features/stages/unit-progress";
import { useRun } from "@/hooks/use-run";
import { useI18n } from "@/i18n";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/stages")({ component: Page });

function Page() {
  const { c } = useI18n();
  const m = useRun().data!;
  const up = m.state.unitProgress;
  // Only a well-formed, non-empty table is the authority worth a section, as in v1.
  const units = up && !up.malformed && up.rows.length > 0 ? up : undefined;
  const anchors = [
    { id: "phases", label: c.stagesPage.phases },
    ...(units ? [{ id: "unit-progress", label: c.stagesPage.units }] : []),
    { id: "matrix", label: c.stagesPage.matrix },
  ];
  return (
    <div className="space-y-6">
      <PageHeader title={c.nav.stages} lead={c.lead.stages} />
      <nav aria-label={c.stagesPage.navLabel}>
        <ul className="flex flex-wrap gap-2">
          {anchors.map((a) => (
            <li key={a.id}>
              <a
                href={`#${a.id}`}
                className="inline-flex h-7 items-center rounded-full border bg-card px-3 text-xs font-medium text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {a.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <Hero m={m} />
      <Phases m={m} />
      {units ? <UnitProgressTable up={units} /> : null}
      <Matrix mx={m.matrix} />
    </div>
  );
}
