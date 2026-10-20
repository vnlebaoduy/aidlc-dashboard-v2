// The long unclassified gaps, surfaced rather than folded silently into work — each
// with the stage it fell in (derived from the segment that contains its timestamp),
// so "18 minutes between two artifact writes" points at a part of the run.

import { Note } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n";
import { mins, shortTs } from "@/lib/format";
import type { TimingReport } from "@server/scan/timing";
import { ScanSearchIcon } from "lucide-react";
import { FoldSection } from "./shared";

const TOP = 12;

export function UnknownGaps({ t }: { t: TimingReport }) {
  const { s } = useI18n();
  const x = s.timeline;
  const top = [...t.total.unknown].sort((a, b) => b.seconds - a.seconds).slice(0, TOP);
  return (
    <FoldSection
      id="unknown-gaps"
      icon={<ScanSearchIcon />}
      title={x.unknownGapsSummary(t.total.unknown.length)}
      defaultOpen={false}
    >
      <ul className="divide-y">
        {top.map((g) => {
          const stage = t.stages.find((sp) =>
            sp.segments.some((seg) => g.at >= seg.startedAt && g.at <= seg.endedAt),
          )?.stage;
          return (
            <li
              key={`${g.at}-${g.fromEvent}-${g.toEvent}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm"
            >
              <strong className="w-20 shrink-0 font-semibold tabular">
                {x.minutes(mins(g.seconds))}
              </strong>
              {stage ? <Badge variant="outline">{stage}</Badge> : null}
              <code className="min-w-0 break-all rounded-sm bg-muted px-1 py-0.5 font-mono text-xs">
                {g.fromEvent} → {g.toEvent}
              </code>
              <span className="text-xs text-muted-foreground tabular">{shortTs(g.at)}</span>
            </li>
          );
        })}
      </ul>
      <Note>{x.unknownGapsNote}</Note>
    </FoldSection>
  );
}
