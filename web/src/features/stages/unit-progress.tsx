// state.md's own `## Unit Progress` table. In team/unit-major this is the AUTHORITY (an
// engine-owned projection of receipts, reviews and gates), so it is shown before the disk
// matrix and labelled as such, never reconstructed.

import { Note, Section } from "@/components/page";
import { StageIcon } from "@/components/status";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useI18n } from "@/i18n";
import { Rich } from "@/lib/rich";
import type { StageStatus, UnitProgress } from "@server/scan/parser";
import { UsersIcon } from "lucide-react";

function StatusCell({ status }: { status: StageStatus | undefined }) {
  const { c } = useI18n();
  if (!status) {
    return (
      <TableCell className="text-center text-muted-foreground" aria-label="—">
        —
      </TableCell>
    );
  }
  const word = c.stagesPage.status[status];
  return (
    <TableCell className="text-center" title={word}>
      <span className="inline-flex justify-center">
        <StageIcon status={status} />
        <span className="sr-only">{word}</span>
      </span>
    </TableCell>
  );
}

export function UnitProgressTable({ up }: { up: UnitProgress }) {
  const { s } = useI18n();
  const mergedCol = up.rows.some((r) => r.merged !== undefined);
  return (
    <Section id="unit-progress" title={s.overview.sectionUnitProgress} icon={<UsersIcon />}>
      <div className="space-y-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-10 bg-card">unit</TableHead>
              <TableHead>owner</TableHead>
              {up.stageColumns.map((col) => (
                <TableHead key={col} className="text-center">
                  {col}
                </TableHead>
              ))}
              <TableHead className="text-center">gate</TableHead>
              {mergedCol ? <TableHead>merged</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {up.rows.map((r) => (
              <TableRow key={r.unit}>
                <TableHead scope="row" className="sticky left-0 z-10 bg-card">
                  {r.unit}
                </TableHead>
                <TableCell>
                  {r.owner && r.owner !== "-" ? (
                    r.owner
                  ) : (
                    <span className="text-muted-foreground">{s.overview.unassignedOwner}</span>
                  )}
                </TableCell>
                {up.stageColumns.map((col) => (
                  <StatusCell key={col} status={r.stages[col]} />
                ))}
                <StatusCell status={r.gate} />
                {mergedCol ? <TableCell>{r.merged ?? ""}</TableCell> : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Note>
          <Rich html={s.overview.unitProgressNote} />
        </Note>
      </div>
    </Section>
  );
}
