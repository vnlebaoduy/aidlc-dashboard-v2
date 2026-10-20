// Rework — what was sent back and how long it stayed unaccepted. The rejection reason
// is a human's own sentence about what was wrong, so it is shown verbatim and in full,
// at card width under the table (never clamped or sliced in a cell).

import { Note, Stat } from "@/components/page";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useI18n } from "@/i18n";
import { hours, shortTs } from "@/lib/format";
import { Rich, esc } from "@/lib/rich";
import { cn } from "@/lib/utils";
import type { DashboardModel } from "@server/model/types";
import { ChevronDownIcon, RotateCcwIcon } from "lucide-react";
import { useState } from "react";
import { FoldSection, pctOf } from "./shared";

export function Rework({ m }: { m: DashboardModel }) {
  const { s } = useI18n();
  const t = s.timeline;
  const r = m.rework;
  const classified = m.timing.elapsedSec - m.timing.sinceLastEventSec;
  const share = pctOf(r.reworkSec, classified);
  const reasons = r.stages.flatMap((st) => st.feedback.map((f) => ({ stage: st.stage, ...f })));
  const [reasonsOpen, setReasonsOpen] = useState(false);
  const num = "text-right tabular";

  return (
    <FoldSection
      id="rework"
      icon={<RotateCcwIcon />}
      title={t.reworkSummary(r.rejected, hours(r.reworkSec))}
      defaultOpen={r.rejected > 0}
    >
      {r.rejected === 0 && r.revisions === 0 && r.jumps === 0 ? (
        <Note>{t.reworkNone}</Note>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            <Stat
              label={t.reworkStatShare(share)}
              value={hours(r.reworkSec)}
              tone="text-danger-foreground"
            />
            <Stat label={t.statRejected} value={r.rejected} />
            <Stat label={t.statApproved} value={r.approved} />
            <Stat label={t.statRevisions} value={r.revisions} />
            {r.jumps ? <Stat label={t.statJumps} value={r.jumps} /> : null}
            {r.freezeBlocked ? <Stat label={t.statFreezeBlocked} value={r.freezeBlocked} /> : null}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.colStage}</TableHead>
                <TableHead className="text-right" title={t.colSubmissionsTip}>
                  {t.colSubmissions}
                </TableHead>
                <TableHead className="text-right">{t.colRejections}</TableHead>
                <TableHead className="text-right" title={t.colRevisionsTip}>
                  {t.colRevisions}
                </TableHead>
                <TableHead className="text-right" title={t.colReworkTip}>
                  {t.colRework}
                </TableHead>
                <TableHead className="text-right" title={t.colReasonTip}>
                  {t.colReason}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.stages.map((st) => (
                <TableRow key={st.stage}>
                  <TableHead scope="row" className="font-medium">
                    {st.stage}
                    {st.settled ? null : (
                      <abbr
                        title={t.reworkProvisionalTip}
                        className="ml-1 cursor-help font-semibold text-warning-foreground no-underline"
                      >
                        ~
                      </abbr>
                    )}
                  </TableHead>
                  <TableCell className={num}>{st.submissions || "—"}</TableCell>
                  <TableCell className={cn(num, "font-semibold text-danger-foreground")}>
                    {st.rejections}
                  </TableCell>
                  <TableCell className={num}>
                    {st.revisions || "—"}
                    {st.revisionHigh ? (
                      <span className="text-muted-foreground"> /{st.revisionHigh}</span>
                    ) : null}
                  </TableCell>
                  <TableCell className={cn(num, "font-semibold")}>{hours(st.reworkSec)}</TableCell>
                  <TableCell className={num}>
                    {st.feedback.length > 0 ? t.feedbackCount(st.feedback.length) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {reasons.length > 0 ? (
            <Collapsible open={reasonsOpen} onOpenChange={setReasonsOpen} className="space-y-3">
              <CollapsibleTrigger className="inline-flex items-center gap-1.5 rounded-sm px-1 py-1 text-left text-sm font-medium text-brand-blue outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
                <ChevronDownIcon
                  aria-hidden
                  className={cn(
                    "size-4 shrink-0 transition-transform",
                    reasonsOpen && "rotate-180",
                  )}
                />
                {t.reasonsSummary(reasons.length)}
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3">
                <Note>
                  <Rich html={t.reasonsNote} />
                </Note>
                <ul className="space-y-3">
                  {reasons.map((f) => (
                    <li
                      key={`${f.stage}-${f.at}-${f.text.length}`}
                      className="rounded-lg border p-3"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <strong className="text-sm font-semibold">{f.stage}</strong>
                        <span className="text-xs text-muted-foreground tabular">
                          {shortTs(f.at)}
                        </span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm">{f.text}</p>
                    </li>
                  ))}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          ) : null}

          <Note>
            <Rich html={t.reworkNote(share, esc(hours(classified)), r.provisional)} />
          </Note>
        </>
      )}
    </FoldSection>
  );
}
