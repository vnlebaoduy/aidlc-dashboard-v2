// The plan the engine resolved for this intent: `<record>/.aidlc-engine/plan.json`.
//
// Upstream's `aidlc-graph resolve` writes one row per stage in the compiled graph
// — `{slug, phase, action: "EXECUTE" | "SKIP"}` — so a reader can separate "the
// scope skips this stage" from "this run skipped it". The dashboard only had the
// state file's per-row suffix; the resolved plan is the engine's own answer.
//
// Gitignored and machine-local: absent means this clone has no derived plan, never
// that nothing was planned. Never throws.

import * as fs from "node:fs";
import * as path from "node:path";

export interface PlannedStage {
  slug: string;
  phase: string;
  action: "EXECUTE" | "SKIP";
}

export function readPlan(recordDir: string): PlannedStage[] | undefined {
  let raw: string;
  try {
    raw = fs.readFileSync(path.join(recordDir, ".aidlc-engine", "plan.json"), "utf-8");
  } catch {
    return undefined;
  }
  let doc: unknown;
  try {
    doc = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!Array.isArray(doc)) return undefined;

  const rows: PlannedStage[] = [];
  for (const row of doc) {
    if (typeof row !== "object" || row === null) continue;
    const slug = "slug" in row && typeof row.slug === "string" ? row.slug : undefined;
    const phase = "phase" in row && typeof row.phase === "string" ? row.phase : "";
    const action =
      "action" in row && (row.action === "EXECUTE" || row.action === "SKIP")
        ? row.action
        : undefined;
    if (!slug || !action) continue;
    rows.push({ slug, phase, action });
  }
  return rows.length > 0 ? rows : undefined;
}
