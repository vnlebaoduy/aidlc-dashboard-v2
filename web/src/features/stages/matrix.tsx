// The Construction (unit × stage) matrix, reconstructed from disk: bolt_dag structure ×
// segment dirs × the stage-graph artifact contract. A diagnostic, below the authoritative
// Unit Progress table when there is one.

import { Note, Section, WarnNote } from "@/components/page";
import { CellIcon, ToneBadge } from "@/components/status";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UnitDetails } from "@/components/unit-details";
import { type Strings, useI18n } from "@/i18n";
import { Rich } from "@/lib/rich";
import type {
  CellState,
  ConstructionMatrix,
  MatrixStage,
  ReceiptReason,
} from "@server/scan/matrix";
import { ArrowRightIcon, Grid3x3Icon } from "lucide-react";
import { Fragment } from "react";

/** Hover text per cell. The four `unverified` causes each say their own thing. */
export function cellTip(
  state: CellState,
  missing: string[],
  present: string[],
  s: Strings,
  reason?: ReceiptReason,
): string {
  switch (state) {
    case "partial":
      return s.overview.tipPartial(missing);
    case "complete":
      return s.overview.tipComplete(present);
    case "unsettled":
      // Artifacts met, receipt missing: the engine treats this as UNCOVERED, so the
      // cell must not read as done.
      return s.overview.tipUnsettled(present);
    case "unverified":
      // "Cannot be checked here", not "not done". With no `Run floor` the engine's own
      // answer is known and it is "uncovered".
      return s.overview.tipUnverified(reason ?? "no-run-floor", present);
    case "n/a":
      return s.overview.tipNotApplicable(present);
    default:
      return s.overview.tipNotStarted;
  }
}

/** The catalogue's legend fragments lead with v1's text glyphs; they map to cell states. */
const GLYPH_STATE: Record<string, CellState> = {
  "\u2588": "complete",
  "\u25a8": "partial",
  "\u25a9": "unsettled",
  "\u25a4": "unverified",
  "\u2013": "n/a",
  "\u00b7": "absent",
};

function LegendLine({ text }: { text: string }) {
  const items = text
    .split(" \u00b7 ")
    .map((seg) => seg.trim())
    .filter((seg) => seg.length > 0)
    .map((seg) => {
      const state = GLYPH_STATE[seg.charAt(0)];
      return state && seg.charAt(1) === " "
        ? { state, label: seg.slice(2) }
        : { state: undefined, label: seg };
    });
  return (
    <ul className="flex flex-col gap-1 text-xs leading-5 text-muted-foreground">
      {items.map((it) => (
        <li key={it.label} className="flex items-start gap-1.5">
          {it.state ? <CellIcon state={it.state} className="mt-0.5" /> : null}
          <span>{it.label}</span>
        </li>
      ))}
    </ul>
  );
}

function Cell({ c }: { c: MatrixStage["cells"][number] }) {
  const { s } = useI18n();
  const tip = cellTip(c.state, c.missing, c.present, s, c.receiptReason);
  return (
    <TableCell className="w-10 p-1 text-center">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`${c.unit}: ${s.cards.cellLabel[c.state]} — ${tip}`}
            className="inline-flex size-8 items-center justify-center rounded-sm outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <CellIcon state={c.state} className="size-5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-left">
          <div className="font-semibold">
            {c.unit} · {s.cards.cellLabel[c.state]}
          </div>
          <div>{tip}</div>
        </TooltipContent>
      </Tooltip>
    </TableCell>
  );
}

/** `c+u▩+v▤+p▨/applicable (–na)` from v1, with lucide icons in place of the glyphs. */
function CountCell({ st }: { st: MatrixStage }) {
  const { s } = useI18n();
  // n/a units leave the denominator, otherwise they would read as outstanding work.
  const applicable = st.total - st.notApplicable;
  const extras = (["unsettled", "unverified", "partial"] as const).filter((k) => st[k] > 0);
  const spoken = [
    `${st.complete} ${s.cards.cellLabel.complete}`,
    ...extras.map((k) => `${st[k]} ${s.cards.cellLabel[k]}`),
  ].join(", ");
  return (
    <TableCell className="text-right tabular">
      <span className="sr-only">
        {`${spoken} / ${applicable}${st.notApplicable ? `, ${st.notApplicable} ${s.cards.cellLabel["n/a"]}` : ""}`}
      </span>
      <span aria-hidden className="inline-flex items-center justify-end gap-0.5">
        {st.complete}
        {extras.map((k) => (
          <Fragment key={k}>
            +{st[k]}
            <CellIcon state={k} className="size-3.5" />
          </Fragment>
        ))}
        /{applicable}
        {st.notApplicable ? (
          <span className="ml-1 inline-flex items-center gap-0.5 text-muted-foreground">
            (<CellIcon state="n/a" className="size-3.5" />
            {st.notApplicable})
          </span>
        ) : null}
      </span>
    </TableCell>
  );
}

function MatrixLegend({ mx }: { mx: ConstructionMatrix }) {
  const { s } = useI18n();
  if (!mx.contractAware) {
    // Receipts come from the audit, not the catalogue, so a no-receipt cell can appear
    // with no catalogue at all.
    return <WarnNote>{s.overview.legendNoContract(mx.receiptAware)}</WarnNote>;
  }
  const anyNa = mx.stages.some((st) => st.notApplicable > 0);
  const anyUnsettled = mx.stages.some((st) => st.unsettled > 0);
  const anyUnverified = mx.stages.some((st) => st.unverified > 0);
  const anyNoFloor = mx.stages.some((st) =>
    st.cells.some((c) => c.receiptReason === "no-run-floor"),
  );
  const legend = [
    s.overview.legendBase,
    anyUnsettled ? s.overview.legendUnsettled : "",
    // With no `Run floor` the engine's verdict IS "uncovered", so the legend names what
    // is unknown rather than asserting the work is fine.
    anyUnverified
      ? anyNoFloor
        ? s.overview.legendUnverifiedNoFloor
        : s.overview.legendUnverified
      : "",
    anyNa ? s.overview.legendNa : "",
  ].join("");
  return (
    <>
      <LegendLine text={legend} />
      {mx.stateCompat === "verified" ? null : (
        <WarnNote>
          <Rich html={s.overview.legendUnverifiedContract} />
        </WarnNote>
      )}
    </>
  );
}

function Batches({ batches }: { batches: string[][] }) {
  const { s } = useI18n();
  return (
    <div className="space-y-2">
      <ol className="flex flex-wrap items-center gap-2">
        {batches.map((b, i) => (
          <li key={b.join(",")} className="flex items-center gap-2">
            {i > 0 ? (
              <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            ) : null}
            <span className="inline-flex flex-wrap items-center gap-1 rounded-lg border px-2 py-1">
              <span className="text-xs font-semibold text-muted-foreground">B{i + 1}</span>
              {b.map((u) => (
                <Badge key={u} variant="secondary" title={u}>
                  {u.replace(/^PU-/, "")}
                </Badge>
              ))}
            </span>
          </li>
        ))}
      </ol>
      <Note>{s.overview.batchNote}</Note>
    </div>
  );
}

export function Matrix({ mx }: { mx: ConstructionMatrix | undefined }) {
  const { s, c } = useI18n();
  if (!mx) {
    return (
      <Section id="matrix" title={s.overview.sectionMatrix} icon={<Grid3x3Icon />}>
        <Note className="flex flex-wrap items-center gap-2">
          {s.overview.noUnits}
          <Badge variant="muted">{s.overview.noUnitsPill}</Badge>
        </Note>
      </Section>
    );
  }
  return (
    <Section id="matrix" title={s.overview.sectionMatrix} icon={<Grid3x3Icon />}>
      <div className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="sticky left-0 z-10 bg-card" />
              {mx.units.map((u) => {
                // Roster facts (kind, dependencies) plus, when the run wrote one, what the
                // unit IS: its title and description from unit-of-work.md, verbatim.
                const label = [u.name, u.info?.title, u.info?.description]
                  .filter(Boolean)
                  .join(" — ");
                return (
                  <TableHead key={u.name} className="h-auto w-10 px-1 py-2 align-bottom">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label={label}
                          className="mx-auto block max-h-40 truncate rounded-sm px-1 py-1 text-xs font-medium outline-none [writing-mode:vertical-rl] rotate-180 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        >
                          {u.name.replace(/^PU-/, "")}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm py-2 text-left">
                        <UnitDetails u={u} />
                      </TooltipContent>
                    </Tooltip>
                  </TableHead>
                );
              })}
              <TableHead className="w-full align-bottom text-right">
                {s.overview.totalColumn}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mx.stages.map((st) => (
              <TableRow key={st.slug}>
                <TableHead scope="row" className="sticky left-0 z-10 bg-card">
                  <span className="inline-flex items-center gap-2">
                    {st.display}
                    {st.provisional ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                          >
                            <ToneBadge tone="info">{c.stagesPage.provisional}</ToneBadge>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          {s.overview.provisionalTip}
                        </TooltipContent>
                      </Tooltip>
                    ) : st.status === "skipped" ? (
                      // Same word as the phase list, so the two views never disagree.
                      <ToneBadge tone="mute">{c.stagesPage.status.skipped}</ToneBadge>
                    ) : null}
                  </span>
                </TableHead>
                {st.execute ? (
                  <>
                    {st.cells.map((cell) => (
                      <Cell key={cell.unit} c={cell} />
                    ))}
                    <CountCell st={st} />
                  </>
                ) : (
                  <>
                    <TableCell colSpan={mx.units.length} className="text-center">
                      <Badge variant="muted">SKIP</Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">—</TableCell>
                  </>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <MatrixLegend mx={mx} />
        {mx.batches.length ? <Batches batches={mx.batches} /> : null}
      </div>
    </Section>
  );
}
