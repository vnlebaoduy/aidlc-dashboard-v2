// Where a record's engine-private state lives.
//
// Newer engines keep it under one dir, `<record>/.aidlc-engine/<name>/`
// (hooks-health, stop-hook, sensors, ...). Older records keep each piece in its
// own dot dir at the record root (`.aidlc-hooks-health/`, `.aidlc-stop-hook/`,
// `.aidlc-sensors/`). The rule below is a transcript of the engine's own reader
// (aidlc-lib.ts: engineReadDirFor): the new location wins unless it is absent
// and the legacy one exists, so a record created before the move still reads
// until the next hook rewrites it there.
//
// Node fs only, never throws.

import * as fs from "node:fs";
import * as path from "node:path";

export const ENGINE_DIR = ".aidlc-engine";

/** Resolve `<record>/.aidlc-engine/<name>`, falling back to `<record>/<legacyName>`. */
export function engineReadDir(recordDir: string, name: string, legacyName: string): string {
  const engine = path.join(recordDir, ENGINE_DIR);
  const current = path.join(engine, name);
  try {
    const engineStat = fs.lstatSync(engine, { throwIfNoEntry: false });
    // An existing but malformed engine entry is not absence: do not revive legacy data.
    if (engineStat !== undefined && !engineStat.isDirectory()) return current;
    if (fs.lstatSync(current, { throwIfNoEntry: false }) !== undefined) return current;
    const legacy = path.join(recordDir, legacyName);
    return fs.existsSync(legacy) ? legacy : current;
  } catch {
    return current;
  }
}
