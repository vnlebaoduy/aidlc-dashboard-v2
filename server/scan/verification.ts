// Phase boundary checks: `<record>/verification/phase-check-<phase>.md`.
//
// Upstream writes one when a phase closes (Approval and Handoff, Delivery Planning,
// CI Pipeline), so a reader can see which boundaries were checked and when. The
// dashboard listed the directory in no page; this exposes the files and their mtimes
// without interpreting the contents — the check's wording is the reader's to open.
//
// Never throws; absent directory means "no phase has closed", not "every check passed".

import * as fs from "node:fs";
import * as path from "node:path";

export interface PhaseCheck {
  phase: string;
  /** Record-relative POSIX path, ready for the viewer. */
  rel: string;
  updatedAt?: string;
}

export function readPhaseChecks(recordDir: string): PhaseCheck[] | undefined {
  const dir = path.join(recordDir, "verification");
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return undefined;
  }
  const checks: PhaseCheck[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const match = /^phase-check-(.+)\.md$/.exec(entry.name);
    if (!match?.[1]) continue;
    let updatedAt: string | undefined;
    try {
      updatedAt = fs.statSync(path.join(dir, entry.name)).mtime.toISOString();
    } catch {
      updatedAt = undefined;
    }
    checks.push({
      phase: match[1],
      rel: `verification/${entry.name}`,
      ...(updatedAt ? { updatedAt } : {}),
    });
  }
  checks.sort((a, b) => a.phase.localeCompare(b.phase));
  return checks.length > 0 ? checks : undefined;
}
