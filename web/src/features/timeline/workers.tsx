// Per-worker breakdown, shown only for a parallel run.
//
// WHY BOTH NUMBERS ARE KEPT. Merged idle = "nobody on the team was working"; per-worker
// idle = "how long each person waited". Neither dominates: merged UNDER-reports when
// clones overlap (B's events land inside A's wait) and OVER-reports at a handover (a
// team-wide pause that belongs to no one shard). So the delta is described in the
// direction it actually falls, and the reason is chosen by whether the clones overlap.

import { Note, WarnNote } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useI18n } from "@/i18n";
import { hours, mins, shortTs } from "@/lib/format";
import { LEGEND, Rich, esc } from "@/lib/rich";
import { cn } from "@/lib/utils";
import type { TimingReport } from "@server/scan/timing";
import { CrownIcon, UsersIcon } from "lucide-react";
import { FoldSection, Swatch, bucketsOf } from "./shared";

export function Workers({ t }: { t: TimingReport }) {
  const { s } = useI18n();
  const x = s.timeline;
  const par = t.parallelism;
  const delta = t.personIdleSec - t.total.idleSec;
  const deltaNote =
    Math.abs(delta) <= 60
      ? esc(x.deltaSame)
      : t.overlapSec > 0
        ? delta > 0
          ? x.deltaOverlapUnder(esc(hours(delta)), esc(hours(t.overlapSec)))
          : x.deltaOverlapOver(esc(hours(-delta)))
        : delta > 0
          ? x.deltaHandoverUnder(esc(hours(delta)))
          : x.deltaHandoverOver(esc(hours(-delta)), esc(hours(t.handoverSec)));
  // "Parallel" is a claim about time, so it is made only when the windows overlap.
  const shapeLabel =
    t.overlapSec > 0
      ? x.workerShapeOverlap(t.clones, esc(hours(t.overlapSec)))
      : x.workerShapeSequential(
          t.clones,
          t.handoverSec > 60 ? esc(hours(t.handoverSec)) : undefined,
        );
  const parkedOut = t.workers.filter((w) => w.endedParked);
  const person = bucketsOf(
    {
      humanWaitSec: t.personHumanWaitSec,
      parkedSec: t.personParkedSec,
      observedSec: t.personObservedSec,
      conversationSec: t.personConversationSec,
      unknownSec: t.personUnknownSec,
    },
    x,
  );
  const num = "text-right tabular";
  const colHead = (label: string, swatch?: string) => (
    <TableHead className="text-right">
      <span className="inline-flex items-center gap-1.5">
        {swatch ? <Swatch className={swatch} /> : null}
        {label}
      </span>
    </TableHead>
  );

  return (
    <FoldSection
      id="workers"
      icon={<UsersIcon />}
      title={<Rich html={x.workerSummary(shapeLabel)} />}
      defaultOpen
    >
      <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <li>
          <strong className="font-semibold tabular">{hours(t.personElapsedSec)}</strong>{" "}
          {x.personTotal}
        </li>
        {person.map((b) => (
          <li key={b.kind} className="inline-flex items-center gap-1.5">
            <Swatch className={b.swatch} />
            <strong className="font-semibold tabular">{hours(b.sec)}</strong> {b.label}
          </li>
        ))}
        {par ? (
          <li>
            <strong className="font-semibold tabular">{par.toFixed(2)}×</strong>{" "}
            {x.personParallelism}
          </li>
        ) : null}
      </ul>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{x.colClone}</TableHead>
            {colHead(x.colEvents)}
            {colHead(x.colSpanMin)}
            {colHead(x.colWait, LEGEND.wait)}
            {colHead(x.colParked, LEGEND.parked)}
            {colHead(x.colObserved, LEGEND.observed)}
            {colHead(x.colConversation, LEGEND.conv)}
            {colHead(x.colUnknown, LEGEND.unknown)}
            {colHead(x.colGates)}
            <TableHead>{x.colMainStage}</TableHead>
            {colHead(x.colUnits)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {t.workers.map((w) => (
            <TableRow key={w.shard}>
              <TableHead scope="row" className="font-medium">
                <span className="inline-flex items-center gap-2">
                  {w.label}
                  {w.gatesApproved > 0 ? (
                    <Badge variant="info" title={x.leadTagTip}>
                      <CrownIcon aria-hidden />
                      {x.leadTag}
                    </Badge>
                  ) : null}
                </span>
              </TableHead>
              <TableCell className={num}>{w.events}</TableCell>
              <TableCell className={num}>{mins(w.elapsedSec)}</TableCell>
              <TableCell className={num}>{mins(w.humanWaitSec)}</TableCell>
              <TableCell className={num}>{mins(w.parkedSec)}</TableCell>
              <TableCell className={num}>{mins(w.observedSec)}</TableCell>
              <TableCell className={num}>{mins(w.conversationSec)}</TableCell>
              <TableCell className={num}>{mins(w.unknownSec)}</TableCell>
              <TableCell className={num}>{w.gatesApproved || ""}</TableCell>
              <TableCell className="max-w-56 truncate" title={w.stages.join(", ")}>
                {w.stages.slice(0, 2).join(", ")}
              </TableCell>
              <TableCell
                className={cn(num, "cursor-help")}
                title={w.units.join(", ") || x.noUnitAttribution}
              >
                {w.units.length || "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Note>
        <Rich html={x.workerNote(esc(hours(t.total.idleSec)), deltaNote)} />
      </Note>
      {t.workers.length > t.clones ? (
        <Note>
          <Rich html={x.hostNote(t.workers.length, t.clones)} />
        </Note>
      ) : null}
      {parkedOut.length ? (
        <WarnNote>
          <Rich
            html={`${parkedOut
              .map((w) => x.endedParked(esc(w.label), esc(shortTs(w.lastTs))))
              .join(" · ")}${esc(x.endedParkedTail)}`}
          />
        </WarnNote>
      ) : null}
      {par ? (
        <Note>
          <Rich html={x.parallelismNote} />
        </Note>
      ) : null}
      <Note>
        <Rich html={x.unitColumnNote} />
      </Note>
    </FoldSection>
  );
}
