// OUTCOMES.md: the handover pack the `aidlc-outcomes-pack` skill writes when a run
// closes. The skill writes it at the WORKSPACE ROOT, where the next intent overwrites
// it; a copy kept inside the record is the per-intent one. So:
//
//   <record>/OUTCOMES.md   wins — it belongs to this intent;
//   <root>/OUTCOMES.md     fallback — reported as `where: "workspace"` so the page can
//                          say it may come from another intent.
//
// Both go through `resolveArtifact` (the same jail as `/view` and `/open`) with the
// fixed name below as `rel`, so the fallback widens the readable set by exactly one
// file and inherits the symlink-escape check. Never throws.

import * as fs from "node:fs";
import { resolveArtifact } from "./open-file";

export const OUTCOMES_REL = "OUTCOMES.md";

export interface OutcomesFile {
  rel: typeof OUTCOMES_REL;
  where: "record" | "workspace";
  sizeBytes: number;
  /** ISO mtime — lets a reader tell a stale root file from this run's. */
  modifiedAt: string;
}

/**
 * The base directory `/view` and `/open` should jail `rel` under. Only the exact name
 * `OUTCOMES.md` may fall back to the workspace root, and only when the record has none.
 */
export function artifactBase(root: string, recordDir: string, rel: string): string {
  if (rel !== OUTCOMES_REL || resolveArtifact(recordDir, rel).ok) return recordDir;
  return resolveArtifact(root, rel).ok ? root : recordDir;
}

export function readOutcomes(root: string, recordDir: string): OutcomesFile | null {
  const base = artifactBase(root, recordDir, OUTCOMES_REL);
  const jailed = resolveArtifact(base, OUTCOMES_REL);
  if (!jailed.ok) return null;
  try {
    const st = fs.statSync(jailed.real);
    return {
      rel: OUTCOMES_REL,
      where: base === recordDir ? "record" : "workspace",
      sizeBytes: st.size,
      modifiedAt: st.mtime.toISOString(),
    };
  } catch {
    return null;
  }
}
