// Stage, Unit and Unresolved summary cards (v1 render/cards.ts). A card is a summary,
// not a second copy of a page: a handful of bar-backed rows that answer one question,
// and a link to the page with the rest.
//
// Two rules carry over from the panels they summarise:
//   - A number that was not measured is not drawn. A stage with no audit span shows "—",
//     not 0h; a unit with no contract shows the files it has, not a fraction.
//   - Stage time is WORK + CONVERSATION (`observedSec + conversationSec`), never elapsed.

import { ViewLink } from "@/components/art-link";
import { CELL_TONE, CellIcon, STAGE_TONE, StageIcon } from "@/components/status";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UnitDetails } from "@/components/unit-details";
import { FOLLOW_UP_ICON, OWNER_ICON } from "@/features/decisions/faces";
import { cellTip } from "@/features/stages/matrix";
import { type Strings, useI18n } from "@/i18n";
import { dur, hours, share } from "@/lib/format";
import type { DashboardModel } from "@server/model/types";
import type { MatrixCell, MatrixStage } from "@server/scan/matrix";
import type { PhaseInfo, StageInfo, StageStatus } from "@server/scan/parser";
import { BoxesIcon, ListChecksIcon, MessageCircleQuestionIcon } from "lucide-react";
import { CARD_ROWS, type Row, RowList, TabbedCard } from "./row-list";

// ── Stage ────────────────────────────────────────────────────────────────────

/**
 * One row per stage SLUG: Construction repeats its per-unit stages once per unit, and
 * the audit's timing is keyed by slug. The folded status is the most urgent one present;
 * a stage is only "done" when every executed copy is.
 */
function foldStatus(copies: StageInfo[]): StageStatus {
  const run = copies.filter((c) => c.execute && c.status !== "skipped");
  if (run.length === 0) return "skipped";
  if (run.every((c) => c.status === "done")) return "done";
  // A gate waiting on the human outranks a unit that is merely working.
  for (const st of ["awaiting", "revising", "active"] as const) {
    if (run.some((c) => c.status === st)) return st;
  }
  // Some units finished it, the rest have not started, and none is on it now: that is
  // pending, not active. The row's "units n/m" note carries the partial progress.
  return "pending";
}

function stageRows(phase: PhaseInfo, m: DashboardModel, s: Strings): Row[] {
  const bySlug = new Map<string, StageInfo[]>();
  for (const st of phase.stages) {
    const list = bySlug.get(st.slug);
    if (list) list.push(st);
    else bySlug.set(st.slug, [st]);
  }
  const timeOf = (slug: string): number | undefined => {
    const sp = m.timing.stages.find((t) => t.stage === slug);
    return sp ? sp.observedSec + sp.conversationSec : undefined;
  };
  const times = [...bySlug.keys()].map(timeOf).filter((t): t is number => t !== undefined);
  const max = Math.max(0, ...times);
  return [...bySlug.entries()].map(([slug, copies]) => {
    const status = foldStatus(copies);
    const first = copies[0] as StageInfo;
    // Same set foldStatus judges: a unit that skipped the stage leaves the denominator.
    const units = copies.filter((c) => c.bolt !== undefined && c.execute && c.status !== "skipped");
    const t = timeOf(slug);
    return {
      key: slug,
      icon: <StageIcon status={status} />,
      label: first.display,
      sub:
        units.length > 1
          ? ` · ${s.cards.unitsDone(units.filter((c) => c.status === "done").length, units.length)}`
          : undefined,
      value: hours(t),
      pct: t === undefined ? undefined : share(t, max),
      tone: STAGE_TONE[status],
      dim: status === "skipped",
      tip: slug,
    };
  });
}

/** The phase holding the current stage; else the latest phase with progress; else the first. */
function currentPhaseIndex(phases: PhaseInfo[], current: string): number {
  const at = phases.findIndex((p) => p.stages.some((st) => st.slug === current));
  if (at >= 0) return at;
  for (let i = phases.length - 1; i >= 0; i--) if ((phases[i] as PhaseInfo).done > 0) return i;
  return 0;
}

export function StageCard({ m }: { m: DashboardModel }) {
  const { s, c } = useI18n();
  const phases = m.state.phases.filter((p) => p.stages.length > 0);
  return (
    <TabbedCard
      id="card-stage"
      title={s.cards.stageTitle}
      icon={<ListChecksIcon />}
      tabs={phases.map((p) => ({
        label: p.display,
        count: { text: `${p.done}/${p.total}` },
        body: (
          <RowList
            rows={stageRows(p, m, s)}
            head={[s.cards.colStage, s.cards.colWorkChat]}
            headTip={s.cards.workChatTip}
            max={CARD_ROWS}
            empty={s.cards.noStages}
          />
        ),
      }))}
      selected={currentPhaseIndex(phases, m.state.currentStage)}
      empty={s.cards.noStages}
      links={[
        { to: "/stages", label: c.nav.stages },
        { to: "/timeline", label: s.cards.moreTimeline },
      ]}
    />
  );
}

// ── Unit ─────────────────────────────────────────────────────────────────────

/**
 * REQUIRED artifacts met, as a fraction — the set the cell's state is judged on
 * (`expected` also holds optional files, which never block coverage). With no required
 * set there is no denominator: the figure is the file count, and no bar is drawn.
 */
function cellFigure(cell: MatrixCell): { value: string; pct?: number } {
  if (cell.state === "n/a") return { value: "—" };
  const total = cell.required.length;
  if (total === 0) return { value: String(cell.present.length) };
  const met = total - cell.missing.length;
  return { value: `${met}/${total}`, pct: share(met, total) };
}

/** The stage the run is on; else the latest with any progress; else the first. */
function pickUnitStage(stages: MatrixStage[], current: string): MatrixStage {
  let pick = stages.find((st) => st.slug === current);
  if (!pick) {
    for (const st of stages) if (st.complete + st.partial + st.unsettled > 0) pick = st;
  }
  return pick ?? (stages[0] as MatrixStage);
}

export function UnitCard({ m }: { m: DashboardModel }) {
  const { s } = useI18n();
  const stages = m.matrix?.stages.filter((st) => st.execute) ?? [];
  // One stage, not a tab per stage: Construction's per-unit stages have long names that
  // do not fit as tabs in a half-width card; the full matrix is one click away.
  const st = stages.length > 0 ? pickUnitStage(stages, m.state.currentStage) : undefined;
  return (
    <TabbedCard
      id="card-unit"
      title={s.cards.unitTitle}
      icon={<BoxesIcon />}
      tabs={
        st
          ? [
              {
                label: st.display,
                count: { text: `${st.complete}/${st.total - st.notApplicable}` },
                body: (
                  <RowList
                    rows={st.cells.map((cell) => {
                      const fig = cellFigure(cell);
                      const unit = m.matrix?.units.find((u) => u.name === cell.unit);
                      const state = cellTip(
                        cell.state,
                        cell.missing,
                        cell.present,
                        s,
                        cell.receiptReason,
                      );
                      return {
                        key: cell.unit,
                        icon: <CellIcon state={cell.state} />,
                        // What the unit IS on hover (unit-of-work.md), with this cell's
                        // artifact state under it — the same card the matrix header shows.
                        label: unit ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="max-w-full truncate rounded-sm text-left underline decoration-muted-foreground/40 decoration-dotted underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                              >
                                {cell.unit}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              align="start"
                              className="max-w-sm py-2 text-left"
                            >
                              <UnitDetails u={unit} extra={state} />
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          cell.unit
                        ),
                        sub: ` · ${s.cards.cellLabel[cell.state]}`,
                        value: fig.value,
                        pct: fig.pct,
                        tone: CELL_TONE[cell.state],
                        dim: cell.state === "n/a",
                        tip: unit ? undefined : state,
                      };
                    })}
                    head={[s.cards.colUnit, s.cards.colArtifacts]}
                    max={CARD_ROWS}
                  />
                ),
              },
            ]
          : []
      }
      empty={s.overview.noUnits}
      links={[{ to: "/stages", label: s.cards.moreMatrix }]}
    />
  );
}

// ── Unresolved ───────────────────────────────────────────────────────────────

function decisionRows(m: DashboardModel, s: Strings): Row[] {
  const items = m.deferrals.items;
  const max = Math.max(0, ...items.map((it) => it.ageSec ?? 0));
  return items.map((it, i) => {
    const Icon = OWNER_ICON[it.ownerStatus];
    const face = s.deferrals.faces[it.ownerStatus];
    return {
      key: `${it.rel}#${i}`,
      icon: <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />,
      label: <ViewLink rel={it.rel}>{it.item}</ViewLink>,
      sub: ` → ${it.ownerStage ?? face.label}`,
      value: dur(it.ageSec),
      pct: it.ageSec === undefined ? undefined : share(it.ageSec, max),
      tone: it.ownerStatus === "passed" ? "warn" : it.ownerStatus === "current" ? "info" : "mute",
      tip: face.tip,
    };
  });
}

function openQuestionRows(m: DashboardModel): Row[] {
  const now = Date.parse(m.generatedAt);
  const open = m.diaries.records
    .filter((r) => r.axis === "openQuestions" && r.questionStatus !== "resolved")
    // Follow-ups first: the same order the full list uses.
    .sort((a, b) =>
      a.questionStatus === b.questionStatus ? 0 : a.questionStatus === "followUp" ? -1 : 1,
    );
  const ages = open.map((r) => (r.ts ? (now - Date.parse(r.ts)) / 1000 : undefined));
  const max = Math.max(0, ...ages.filter((a): a is number => a !== undefined && a > 0));
  return open.map((r, i) => {
    const age = ages[i];
    const known = age !== undefined && age >= 0;
    const follow = r.questionStatus === "followUp";
    return {
      key: `${r.rel}#${i}`,
      icon: follow ? (
        <FOLLOW_UP_ICON aria-hidden className="size-4 shrink-0 text-warning-foreground" />
      ) : undefined,
      label: <ViewLink rel={r.rel}>{r.text}</ViewLink>,
      sub: ` · ${r.unit ? `${r.stage} · ${r.unit}` : r.stage}`,
      value: known ? dur(age) : "—",
      pct: known ? share(age, max) : undefined,
      tone: follow ? "warn" : "mute",
    };
  });
}

export function UnresolvedCard({ m }: { m: DashboardModel }) {
  const { s, c } = useI18n();
  const decisions = decisionRows(m, s);
  const questions = openQuestionRows(m);
  return (
    <TabbedCard
      id="card-unresolved"
      title={s.cards.unresolvedTitle}
      icon={<MessageCircleQuestionIcon />}
      tabs={[
        {
          label: s.cards.decisionsTab,
          count: { text: String(decisions.length) },
          body: (
            <RowList
              rows={decisions}
              head={[s.cards.colItemOwner, s.cards.colAge]}
              max={CARD_ROWS}
              empty={s.cards.noDecisions}
            />
          ),
        },
        {
          label: s.cards.openQsTab,
          count: { text: String(questions.length) },
          body: (
            <RowList
              rows={questions}
              head={[s.cards.colStage, s.cards.colAge]}
              max={CARD_ROWS}
              empty={s.cards.noOpenQs}
            />
          ),
        },
      ]}
      // Open the tab that has something in it.
      selected={decisions.length === 0 && questions.length > 0 ? 1 : 0}
      links={[{ to: "/decisions", label: c.nav.decisions }]}
    />
  );
}
