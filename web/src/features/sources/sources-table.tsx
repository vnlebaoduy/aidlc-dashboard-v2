// How fresh each input is (v1 cards.ts renderSources). Sources run in the order a reader
// checks them: the ledger, the state file, then the rest. A stale source says why.

import { ToneBadge } from "@/components/status";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type Strings, useI18n } from "@/i18n";
import { dur, hours, shortTs } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DashboardModel, Provenance, SourceKind } from "@server/model/types";
import {
  CircleCheckIcon,
  CircleDashedIcon,
  ClockAlertIcon,
  FileTextIcon,
  HardDriveIcon,
  type LucideIcon,
  NetworkIcon,
  ScrollTextIcon,
  WebhookIcon,
  WorkflowIcon,
} from "lucide-react";

const SOURCE_ORDER: readonly SourceKind[] = [
  "audit",
  "state.md",
  "disk",
  "hooks-health",
  "runtime-graph",
  "stage-graph",
];

const SOURCE_ICON: Record<SourceKind, LucideIcon> = {
  audit: ScrollTextIcon,
  "state.md": FileTextIcon,
  disk: HardDriveIcon,
  "hooks-health": WebhookIcon,
  "runtime-graph": NetworkIcon,
  "stage-graph": WorkflowIcon,
};

function staleText(p: Provenance, s: Strings): string | undefined {
  const r = p.staleReason;
  if (!r) return undefined;
  switch (r.code) {
    case "graph-behind":
      return s.freshness.graphBehind(
        hours(r.lagSec),
        r.sensorDrift
          ? s.freshness.sensorDrift(r.sensorDrift.fired, r.sensorDrift.missing)
          : undefined,
      );
    case "graph-unreadable":
      return s.freshness.graphUnreadable;
    case "stage-graph-missing":
      return s.freshness.stageGraphMissing;
  }
}

export function SourcesTable({ m }: { m: DashboardModel }) {
  const { s, c } = useI18n();
  const t = c.sourcesPage;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t.colSource}</TableHead>
          <TableHead>{t.colStatus}</TableHead>
          <TableHead className="text-right">{s.cards.colAge}</TableHead>
          <TableHead className="min-w-64">{t.colReason}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {SOURCE_ORDER.map((k) => {
          const p = m.provenance[k];
          const Icon = SOURCE_ICON[k];
          const missing = p.ageSec === undefined;
          const reason = staleText(p, s);
          return (
            <TableRow key={k} className={cn(p.stale && "bg-warning/5")}>
              <TableCell>
                <span className="inline-flex items-center gap-2 font-medium">
                  <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                  {s.cards.sourceNames[k]}
                </span>
              </TableCell>
              <TableCell>
                {missing ? (
                  <ToneBadge
                    tone="mute"
                    icon={CircleDashedIcon}
                    className="border-dashed border-border"
                  >
                    {s.cards.sourceMissing}
                  </ToneBadge>
                ) : p.stale ? (
                  <ToneBadge tone="warn" icon={ClockAlertIcon}>
                    {s.cards.sourceStale}
                  </ToneBadge>
                ) : (
                  <ToneBadge tone="ok" icon={CircleCheckIcon}>
                    {t.fresh}
                  </ToneBadge>
                )}
              </TableCell>
              <TableCell className="text-right">
                {missing ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <div className="tabular">
                    <div>{s.cards.sourceAge(dur(p.ageSec))}</div>
                    <div className="text-xs text-muted-foreground">{shortTs(p.asOf)}</div>
                  </div>
                )}
              </TableCell>
              <TableCell className="whitespace-normal text-xs leading-5 text-muted-foreground">
                {reason ?? "—"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
