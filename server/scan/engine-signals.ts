// Engine signals that live in `.aidlc-engine/`, which the dashboard did not read.
//
// Two of them decide whether a run is actually waiting on a person:
//
//   guard-refusals/<sha256>.json  one file per guard state (stage + Unit), written
//     when a guard refuses an operation. `count` is repetitions of the SAME state;
//     `pendingAsk` means the next `next` will put the recovery question to the
//     person. Shape is versioned (`version: 1`) and documented in the engine's own
//     source (`core/tools/aidlc-lib.ts`, guardRefusalStreakView).
//   human-turn / engine-touch     empty markers whose mtimes say whether the last
//     move was the person's or the engine's: conversational while human-turn is
//     newer, awaiting the engine while engine-touch is.
//
// Both are gitignored and machine-local. Absent means "not present on this clone",
// never "nothing happened", so every reader returns undefined instead of zeros.

import * as fs from "node:fs";
import * as path from "node:path";

export interface GuardRefusal {
  stage: string;
  unit?: string;
  /** How many times the same guard state repeated since its last reset boundary. */
  count: number;
  codes: string[];
  updatedAt?: string;
  /** True when the engine left the recovery question for the next `next` to ask. */
  pendingAsk: boolean;
}

/** Whose move the engine records last: the person's, or the engine's own. */
export type TurnState = "conversational" | "engine";

export interface EngineSignals {
  guardRefusals: GuardRefusal[];
  turnState?: TurnState;
}

function readFile(pathname: string): string | undefined {
  try {
    return fs.readFileSync(pathname, "utf-8");
  } catch {
    return undefined;
  }
}

function parseRefusal(raw: string): GuardRefusal | undefined {
  let doc: unknown;
  try {
    doc = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (typeof doc !== "object" || doc === null) return undefined;
  if (!("refusal" in doc) || typeof doc.refusal !== "object" || doc.refusal === null)
    return undefined;
  const refusal = doc.refusal;
  if (!("stage" in refusal) || typeof refusal.stage !== "string" || refusal.stage.length === 0)
    return undefined;

  const count = "count" in doc && typeof doc.count === "number" ? doc.count : 1;
  const codes =
    "codes" in doc && Array.isArray(doc.codes)
      ? doc.codes.filter((code): code is string => typeof code === "string")
      : [];
  const updatedAt =
    "updatedAt" in doc && typeof doc.updatedAt === "string" ? doc.updatedAt : undefined;
  const unit =
    "unit" in refusal && typeof refusal.unit === "string" && refusal.unit.length > 0
      ? refusal.unit
      : undefined;
  return {
    stage: refusal.stage,
    ...(unit ? { unit } : {}),
    count,
    codes,
    ...(updatedAt ? { updatedAt } : {}),
    pendingAsk: "pendingAsk" in doc,
  };
}

function turnState(engineDir: string): TurnState | undefined {
  const human = path.join(engineDir, "human-turn");
  const engine = path.join(engineDir, "engine-touch");
  let humanAt: number | undefined;
  let engineAt: number | undefined;
  try {
    humanAt = fs.statSync(human).mtimeMs;
  } catch {
    humanAt = undefined;
  }
  try {
    engineAt = fs.statSync(engine).mtimeMs;
  } catch {
    engineAt = undefined;
  }
  if (humanAt === undefined || engineAt === undefined) return undefined;
  return humanAt >= engineAt ? "conversational" : "engine";
}

/** Read the engine-only signals for one record. Undefined when the whole plane is absent. */
export function readEngineSignals(recordDir: string): EngineSignals | undefined {
  const engineDir = path.join(recordDir, ".aidlc-engine");
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(engineDir, { withFileTypes: true });
  } catch {
    return undefined;
  }
  if (entries.length === 0) return undefined;

  const refusals: GuardRefusal[] = [];
  const refusalDir = path.join(engineDir, "guard-refusals");
  try {
    for (const entry of fs.readdirSync(refusalDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const raw = readFile(path.join(refusalDir, entry.name));
      if (raw === undefined) continue;
      const parsed = parseRefusal(raw);
      if (parsed) refusals.push(parsed);
    }
  } catch {
    // No refusal directory on this record.
  }
  refusals.sort(
    (a, b) => b.count - a.count || (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
  );

  const turn = turnState(engineDir);
  if (refusals.length === 0 && turn === undefined) return undefined;
  return {
    guardRefusals: refusals,
    ...(turn ? { turnState: turn } : {}),
  };
}
