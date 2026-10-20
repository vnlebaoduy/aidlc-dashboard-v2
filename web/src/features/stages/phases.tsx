// Phase → stage list. One collapsible card per phase (open when state.md declares it
// Active); a stage that produced files expands to its artifact list, one with none stays
// a plain row so an empty toggle never invites a dead click.

import { OpenInEditor, ViewLink } from "@/components/art-link";
import {
  Bar,
  STAGE_ICON,
  STAGE_TONE,
  StageIcon,
  TONE_TEXT,
  type Tone,
  ToneBadge,
} from "@/components/status";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useI18n } from "@/i18n";
import { fmtBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DashboardModel } from "@server/model/types";
import type { StageArtifact } from "@server/scan/artifacts";
import type { PhaseInfo, StageStatus } from "@server/scan/parser";
import { ChevronRightIcon } from "lucide-react";
import { type StageRowData, kindIcon, stageRows } from "./stage-files";

/** The phase's declared status (`## Phase Progress`) read onto the stage vocabulary. */
const DECLARED: Record<string, { status: StageStatus; tone: Tone }> = {
  Active: { status: "active", tone: "live" },
  Verified: { status: "done", tone: "ok" },
  Skipped: { status: "skipped", tone: "mute" },
};

function ArtifactItem({ f }: { f: StageArtifact }) {
  const { s } = useI18n();
  const Icon = kindIcon(f);
  const kindTitle =
    f.kind === "artifact"
      ? s.overview.kindArtifact
      : f.kind === "questions"
        ? s.overview.kindQuestions
        : s.overview.kindDiary;
  return (
    <li className="flex min-w-0 items-center gap-2 py-1 pl-1 text-sm">
      <Icon
        className={cn(
          "size-4 shrink-0",
          f.kind === "questions" ? TONE_TEXT.warn : "text-muted-foreground",
        )}
        aria-label={kindTitle}
        role="img"
      >
        <title>{kindTitle}</title>
      </Icon>
      {/* The unit tag is load-bearing: a merged Construction row carries one
          code-generation-plan.md per unit, so the basename alone is ambiguous. */}
      {f.unit ? (
        <Badge variant="outline" className="shrink-0">
          {f.unit}
        </Badge>
      ) : null}
      <ViewLink rel={f.rel} title={f.rel} className="min-w-0">
        <span className="truncate">{f.name}</span>
      </ViewLink>
      <span
        className={cn(
          "ml-auto shrink-0 text-xs tabular",
          f.size > 0 ? "text-muted-foreground" : TONE_TEXT.warn,
        )}
      >
        {fmtBytes(f.size)}
      </span>
      <OpenInEditor rel={f.rel} />
    </li>
  );
}

function StageHead({ row }: { row: StageRowData }) {
  const { s, c } = useI18n();
  return (
    <>
      <StageIcon status={row.status} />
      <span className="min-w-0 font-medium break-words">{row.display}</span>
      <span className={cn("text-xs", TONE_TEXT[STAGE_TONE[row.status]])}>
        {c.stagesPage.status[row.status]}
      </span>
      {row.execute ? null : <Badge variant="muted">SKIP</Badge>}
      {row.unitsTotal > 1 ? (
        <span className="text-xs text-muted-foreground tabular">
          {s.cards.unitsDone(row.unitsDone, row.unitsTotal)}
        </span>
      ) : null}
    </>
  );
}

function StageRow({ row }: { row: StageRowData }) {
  const { c } = useI18n();
  if (row.files.length === 0) {
    return (
      <li className="flex min-h-9 flex-wrap items-center gap-x-2 gap-y-1 rounded-sm px-2 py-1.5">
        <StageHead row={row} />
      </li>
    );
  }
  return (
    <li>
      <Collapsible>
        <CollapsibleTrigger className="group flex min-h-9 w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-sm px-2 py-1.5 text-left outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50">
          <StageHead row={row} />
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground tabular">
            {c.stagesPage.files(row.files.length)}
            <ChevronRightIcon
              className="size-4 transition-transform duration-200 group-data-[state=open]:rotate-90 motion-reduce:transition-none"
              aria-hidden
            />
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="mt-1 mb-2 ml-4 border-l pl-3 sm:ml-6">
            {row.files.map((f) => (
              <ArtifactItem key={f.rel} f={f} />
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}

function PhaseCard({
  p,
  artifacts,
  running,
}: { p: PhaseInfo; artifacts: DashboardModel["artifacts"]; running: boolean }) {
  const { c } = useI18n();
  const declared = DECLARED[p.declaredStatus] ?? { status: "pending", tone: "mute" };
  // "Active" on a finished run is the last phase's label, not work in progress.
  const live = running && p.declaredStatus === "Active";
  const rows = stageRows(p, artifacts);
  return (
    <Card className="gap-0 py-0">
      <Collapsible defaultOpen={p.declaredStatus === "Active"}>
        <CollapsibleTrigger className="group w-full rounded-lg px-5 py-4 text-left outline-none hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <ChevronRightIcon
              className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-90 motion-reduce:transition-none"
              aria-hidden
            />
            <span className="text-base font-semibold">{p.display}</span>
            {p.declaredStatus ? (
              <ToneBadge
                tone={live || declared.status !== "active" ? declared.tone : "mute"}
                icon={STAGE_ICON[declared.status]}
                className={cn(live && "[&>svg]:animate-pulse")}
              >
                {p.declaredStatus}
              </ToneBadge>
            ) : null}
            <span className="ml-auto text-sm text-muted-foreground tabular">
              {p.skipped ? c.stagesPage.status.skipped : `${p.done}/${p.total}`}
            </span>
          </div>
          {p.skipped || p.pct === null ? null : (
            <Bar pct={p.pct} tone={p.pct >= 100 ? "ok" : live ? "live" : "info"} className="mt-3" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="space-y-0.5 border-t px-3 py-2">
            {rows.map((r) => (
              <StageRow key={r.slug} row={r} />
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export function Phases({ m }: { m: DashboardModel }) {
  return (
    <section id="phases" className="scroll-mt-20 space-y-3" aria-labelledby="phases-title">
      {/* "Phase · Stage" is engine vocabulary in both languages, as in v1. */}
      <h2 id="phases-title" className="text-base font-semibold">
        Phase · Stage
      </h2>
      <div className="space-y-3">
        {m.state.phases.map((p) => (
          <PhaseCard key={p.key} p={p} artifacts={m.artifacts} running={!m.state.complete} />
        ))}
      </div>
    </section>
  );
}
