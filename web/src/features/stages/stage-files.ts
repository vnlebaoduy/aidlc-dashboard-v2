// Phase → stage → files, shared by the Stages page and the viewer's file tree, so both
// fold Construction's per-unit copies the same way and list the same files.

import type { DashboardModel } from "@server/model/types";
import type { StageArtifact } from "@server/scan/artifacts";
import type { PhaseInfo, StageInfo, StageStatus } from "@server/scan/parser";
import {
  FileCodeIcon,
  FileJsonIcon,
  FileTextIcon,
  type LucideIcon,
  MessageCircleQuestionIcon,
  NotebookPenIcon,
} from "lucide-react";

/**
 * One row per stage SLUG. Construction repeats its per-unit stages once per Bolt; the
 * row folds the copies and says how many units finished. The folded status is the most
 * urgent one present: a stage is only done when every executed copy is.
 */
function foldStatus(copies: StageInfo[]): StageStatus {
  const run = copies.filter((c) => c.execute && c.status !== "skipped");
  if (run.length === 0) return "skipped";
  if (run.every((c) => c.status === "done")) return "done";
  // A gate waiting on the human outranks a unit that is merely working.
  for (const st of ["awaiting", "revising", "active"] as const) {
    if (run.some((c) => c.status === st)) return st;
  }
  // Some units finished, the rest have not started, none is on it now: pending, and the
  // "units n/m" note carries the partial progress.
  return "pending";
}

export interface StageRowData {
  slug: string;
  display: string;
  status: StageStatus;
  execute: boolean;
  unitsDone: number;
  unitsTotal: number;
  files: StageArtifact[];
}

export function stageRows(p: PhaseInfo, artifacts: DashboardModel["artifacts"]): StageRowData[] {
  const bySlug = new Map<string, StageInfo[]>();
  for (const st of p.stages) {
    const list = bySlug.get(st.slug);
    if (list) list.push(st);
    else bySlug.set(st.slug, [st]);
  }
  return [...bySlug.entries()].map(([slug, copies]) => {
    // A unit that skipped the stage is neither done nor outstanding.
    const units = copies.filter((c) => c.bolt !== undefined && c.execute && c.status !== "skipped");
    const keys = new Set(
      copies.map((c) => (c.bolt ? `construction/${c.bolt}/${slug}` : `${p.key}/${slug}`)),
    );
    return {
      slug,
      display: copies[0]!.display,
      status: foldStatus(copies),
      execute: copies.some((c) => c.execute),
      unitsDone: units.filter((c) => c.status === "done").length,
      unitsTotal: units.length,
      files: [...keys].flatMap((k) => artifacts[k] ?? []),
    };
  });
}

export function kindIcon(f: StageArtifact): LucideIcon {
  if (f.kind === "questions") return MessageCircleQuestionIcon;
  if (f.kind === "diary") return NotebookPenIcon;
  if (f.name.endsWith(".json")) return FileJsonIcon;
  if (f.name.endsWith(".html")) return FileCodeIcon;
  return FileTextIcon;
}
