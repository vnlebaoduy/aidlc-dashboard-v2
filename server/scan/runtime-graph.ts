// Execution truth: the engine's own per-workflow view (runtime-graph.json).
//
// Upstream calls this the data-plane mirror of the stage graph: materialised from
// the audit on every approval gate, carrying `workflow_id`, `started_at` and one
// row per stage that started. The dashboard used to read only `bolt_dag` from it
// and re-derive stage spans from the audit; this module exposes the rows so the
// screen can show what the engine recorded and say when the two disagree.
//
// Read-only, never throws. Absent on a fresh clone (the file is gitignored), so
// undefined means "not present here", never "the run did nothing".

import * as fs from "node:fs";
import * as path from "node:path";

export interface RuntimeStageSpan {
  slug: string;
  startedAt?: string;
  completedAt?: string;
  /** Wall-clock seconds from start to completion, when both are readable. */
  elapsedSec?: number;
  agent?: string;
  outcome?: string;
}

export interface RuntimeGraph {
  workflowId?: string;
  startedAt?: string;
  stages: RuntimeStageSpan[];
}

function seconds(start?: string, end?: string): number | undefined {
  if (!start || !end) return undefined;
  const from = Date.parse(start);
  const to = Date.parse(end);
  if (Number.isNaN(from) || Number.isNaN(to) || to < from) return undefined;
  return Math.round((to - from) / 1000);
}

export function readRuntimeGraph(recordDir: string): RuntimeGraph | undefined {
  let raw: string;
  try {
    raw = fs.readFileSync(path.join(recordDir, "runtime-graph.json"), "utf-8");
  } catch {
    return undefined;
  }
  let doc: unknown;
  try {
    doc = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (typeof doc !== "object" || doc === null || !("stages" in doc)) return undefined;
  const rows = doc.stages;
  if (!Array.isArray(rows)) return undefined;

  const stages: RuntimeStageSpan[] = [];
  for (const row of rows) {
    if (typeof row !== "object" || row === null) continue;
    if (!("stage_slug" in row) || typeof row.stage_slug !== "string" || row.stage_slug.length === 0)
      continue;
    const startedAt =
      "started_at" in row && typeof row.started_at === "string" ? row.started_at : undefined;
    const completedAt =
      "completed_at" in row && typeof row.completed_at === "string" ? row.completed_at : undefined;
    const agent = "agent" in row && typeof row.agent === "string" ? row.agent : undefined;
    const outcome = "outcome" in row && typeof row.outcome === "string" ? row.outcome : undefined;
    const span = seconds(startedAt, completedAt);
    stages.push({
      slug: row.stage_slug,
      ...(startedAt ? { startedAt } : {}),
      ...(completedAt ? { completedAt } : {}),
      ...(span !== undefined ? { elapsedSec: span } : {}),
      ...(agent ? { agent } : {}),
      ...(outcome ? { outcome } : {}),
    });
  }
  if (stages.length === 0) return undefined;

  const workflowId =
    "workflow_id" in doc && typeof doc.workflow_id === "string" ? doc.workflow_id : undefined;
  const startedAt =
    "started_at" in doc && typeof doc.started_at === "string" ? doc.started_at : undefined;
  return {
    ...(workflowId ? { workflowId } : {}),
    ...(startedAt ? { startedAt } : {}),
    stages,
  };
}
