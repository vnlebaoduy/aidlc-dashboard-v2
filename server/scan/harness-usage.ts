// Which harness actually drove a run, measured rather than guessed.
//
// A workspace can carry several harness trees (`.kiro` and `.claude` side by side is
// common: one engine install per tool the team uses). The directory's EXISTENCE says
// nothing about use, so the probe order that picks the stage catalogue must not pick the
// usage panel too — on a real run that was 70 Kiro turns to 0 Claude Code turns, and probe
// order still chose Claude.
//
// The audit names the session behind every HUMAN_TURN, and each harness keeps its own
// session store in the home dir:
//
//   Claude Code  ~/.claude/projects/<projectSlug(root)>/<sessionId>.jsonl
//   Kiro CLI     ~/.kiro/sessions/cli/<sessionId>.json(l)
//                ~/.kiro/sessions/<projectHash>/<sessionId>/
//
// So a turn is attributed to the harness whose store holds its session. Both use bare
// UUIDs for some sessions, so the id's SHAPE is not evidence — only where it is stored.
// A session found in neither store (another clone's machine, a pruned store) counts for
// nobody rather than being guessed.
//
// Node fs only, never throws.

import * as fs from "node:fs";
import * as path from "node:path";
import { projectSlug } from "../credit/claude/transcript-reader";
import type { AuditLedger } from "./audit";

/** HUMAN_TURN counts per harness, from the home-dir session stores. */
export interface HarnessTurns {
  kiro: number;
  claude: number;
  /** Turns whose session no local store holds. */
  unknown: number;
}

/** Where a session id lives, if anywhere on this machine. */
function sessionHarness(
  id: string,
  claudeDir: string,
  kiroRoot: string,
  kiroDirs: string[],
): "kiro" | "claude" | undefined {
  // `path.basename` keeps a hostile id (`../x`) from probing outside the stores.
  const safe = path.basename(id);
  if (safe !== id || safe === "" || safe === "." || safe === "..") return undefined;
  if (fs.existsSync(path.join(claudeDir, `${safe}.jsonl`))) return "claude";
  for (const d of kiroDirs) {
    const base = path.join(kiroRoot, d, safe);
    if (fs.existsSync(base) || fs.existsSync(`${base}.json`) || fs.existsSync(`${base}.jsonl`)) {
      return "kiro";
    }
  }
  return undefined;
}

export function measureHarnessTurns(root: string, ledger: AuditLedger, home: string): HarnessTurns {
  const claudeDir = path.join(home, ".claude", "projects", projectSlug(root));
  const kiroRoot = path.join(home, ".kiro", "sessions");
  let kiroDirs: string[] = [];
  try {
    kiroDirs = fs
      .readdirSync(kiroRoot, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    // No Kiro store on this machine.
  }

  const turns: HarnessTurns = { kiro: 0, claude: 0, unknown: 0 };
  // One lookup per session, not per turn: a run has a handful of sessions and hundreds
  // of turns.
  const seen = new Map<string, "kiro" | "claude" | undefined>();
  for (const e of ledger.events) {
    if (e.event !== "HUMAN_TURN") continue;
    const id = e.fields.Session;
    if (!id) {
      turns.unknown++;
      continue;
    }
    if (!seen.has(id)) seen.set(id, sessionHarness(id, claudeDir, kiroRoot, kiroDirs));
    const h = seen.get(id);
    if (h) turns[h]++;
    else turns.unknown++;
  }
  return turns;
}
