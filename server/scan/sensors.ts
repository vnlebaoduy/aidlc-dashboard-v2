// Sensor outcomes: how many fired, how many failed, and what the failures say.
//
// TWO SOURCES, DELIBERATELY. Neither alone is sufficient:
//
//   - the audit ledger has EVERY firing (SENSOR_FIRED, then a terminal
//     SENSOR_PASSED / SENSOR_FAILED / SENSOR_BUDGET_OVERRIDE correlated by
//     `Fire id`) but no finding bodies;
//   - `.aidlc-engine/sensors/<stage>/<sensorId>-<fireId>.md` (legacy
//     `.aidlc-sensors/`) has the finding bodies but
//     ONLY for failures — a passing fire writes no file (verified twice: 46 detail
//     files all `**Pass**: false`, and 54 on a second run, likewise all false).
//
// THE FILE SET IS A SUBSET, NOT A MIRROR, AND THE REASON IS THE CLONE. The first
// measurement had files and SENSOR_FAILED matching exactly (46 = 46), which reads
// like an invariant. It is not: a two-developer run had **84 failures and 54
// files**, and the split is exactly per shard —
//
//   seokwon-…-d645e6b4dc7e   30 failures →  0 detail files
//   lottes-…-74726ff984d7    54 failures → 54 detail files (1:1)
//
// because `audit/` is the ONLY per-clone-sharded source in a record.
// The engine's sensors/, hooks-health/ and stop-hook/ dirs carry no clone
// dimension in their paths, so a tree that holds several clones' audit shards holds
// only ONE clone's sensor bodies — the other developer's findings never travelled.
// (The boundary looks temporal because the two shards' windows are adjacent, which
// is how an earlier reading of this same tree mistook it for the engine starting to
// write findings mid-run. It is not: same sensor ids, different machine.)
//
// So file count is a floor on failures, never the count, and a failure without a
// body means "recorded elsewhere", not "no findings". This is why `failures` walks
// the audit and attaches a body only when one exists — counting files would have
// under-reported by 36% — and why `failuresWithoutBody` is reported rather than
// left as a silent absence.
//
// So counts come from audit and bodies from disk, joined on fire id. Note we do
// NOT use runtime-graph.json's pre-aggregated `sensor_firings`: it is only
// recompiled at stage transitions, so for the in-flight stage — the one being
// looked at — it is empty while audit already holds hundreds of firings.
//
// Node fs only, never throws.

import * as fs from "node:fs";
import * as path from "node:path";
import type { AuditLedger } from "./audit";
import { engineReadDir } from "./engine-dir";

/** A type-check finding row from the detail file's JSON block. */
export interface TypeCheckError {
  file: string;
  line?: number;
  column?: number;
  message: string;
}

/** One failed firing, with its finding body when the detail file was readable. */
export interface SensorFailure {
  /** Sensor id, e.g. "type-check" / "upstream-coverage". */
  id: string;
  stage: string;
  fireId: string;
  ts: string;
  /** The artifact/file the sensor judged, absolute as recorded by the engine. */
  outputPath?: string;
  /** `findings_count` from the JSON block. */
  findingsCount?: number;
  /** type-check / linter: the individual errors. */
  errors: TypeCheckError[];
  /** upstream-coverage: consumed artifacts never referenced by the output. */
  unreferenced: string[];
  /** The sensor's own one-line explanation (`reason`), when it gave one. */
  reason?: string;
  /** Every other non-empty finding, by its JSON key — see `findingFacts`. */
  facts: FindingFact[];
  /** Detail-file basename, or undefined when no body was found on disk. */
  detailFile?: string;
}

/**
 * One finding key from a detail body, kept generic on purpose: every sensor has its own
 * output_schema (`traceability` → `gaps`/`missing_from_upstream_ids`, `claim-sources` →
 * `findings`, `required-sections` → `h2_count`/`template_missing`/`edge_block`), and a
 * fixed list of keys is exactly how `reason: "unit must be a string when present"`
 * stayed invisible while the screen said only "1 finding".
 */
export interface FindingFact {
  key: string;
  /** A list key: its strings, capped (`more` counts the rest). */
  items?: string[];
  more?: number;
  /** A scalar key: its value as text. */
  value?: string;
}

/** Per-stage roll-up of firings. */
export interface SensorStageSummary {
  stage: string;
  fired: number;
  passed: number;
  failed: number;
  budgetOverride: number;
  /** Firings with no terminal event yet — in flight at read time. */
  pending: number;
  /** sensor id → firing count, so a stage shows which sensors dominate. */
  byId: Map<string, number>;
}

export interface SensorReport {
  /** In stage-first-seen order (audit is time-ordered, so run order). */
  stages: SensorStageSummary[];
  /** Every failure, newest first. */
  failures: SensorFailure[];
  totalFired: number;
  totalPassed: number;
  totalFailed: number;
  /** Detail files found on disk that no audit failure claimed — a drift signal. */
  orphanDetailFiles: number;
  /**
   * Failures whose findings body is absent. Normal in a multi-clone record: the
   * audit merges every clone's shard while the sensors dir holds only the local
   * clone's files, so these findings exist — on another machine. Reported so the
   * screen can say that instead of showing a failure with an empty body.
   */
  failuresWithoutBody: number;
}

interface DetailBody {
  fireId: string;
  sensorId: string;
  stage: string;
  ts?: string;
  outputPath?: string;
  findingsCount?: number;
  errors: TypeCheckError[];
  unreferenced: string[];
  reason?: string;
  facts: FindingFact[];
  file: string;
}

const FIELD_RE = /^\*\*([^*]+)\*\*:[ \t]*(.*)$/;

/** Keys that are verdict, already shown, or the sensor's INPUTS rather than findings. */
const NOT_FINDINGS = new Set([
  "pass",
  "findings_count",
  "errors",
  "unreferenced",
  "reason",
  "scanned_files",
  "consumes",
  "headings",
  "template",
  "template_expected",
  "questions_file",
]);
/** Strings shown per list key; the rest is a count. */
const FACT_ITEMS = 8;

/**
 * The findings worth showing from a parsed JSON body. Exported for tests.
 *
 * - a non-empty list of strings → the strings (first FACT_ITEMS, then a count);
 * - a number → shown when it is ZERO (`h2_count: 0` is the finding; `h2_count: 3`
 *   on a failed fire is context the reader does not need);
 * - a non-empty string → shown (`edge_block: "cyclic"`, `config_warning: …`), except
 *   `"ok"`, which is the healthy value;
 * - booleans, empty lists, objects, and the NOT_FINDINGS keys → skipped.
 */
export function findingFacts(j: Record<string, unknown>): FindingFact[] {
  const out: FindingFact[] = [];
  for (const [key, v] of Object.entries(j)) {
    if (NOT_FINDINGS.has(key)) continue;
    if (Array.isArray(v)) {
      const items = v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
      if (items.length === 0) continue;
      out.push({
        key,
        items: items.slice(0, FACT_ITEMS),
        more: items.length > FACT_ITEMS ? items.length - FACT_ITEMS : undefined,
      });
    } else if (typeof v === "number") {
      if (v === 0) out.push({ key, value: "0" });
    } else if (typeof v === "string") {
      const s = v.trim();
      if (s && s.toLowerCase() !== "ok") out.push({ key, value: s });
    }
  }
  return out;
}

/**
 * Parse one sensors-dir detail file. Exported for tests — the format
 * contract (header fields + a fenced JSON findings block) lives here alone.
 */
export function parseSensorDetail(
  text: string,
  fileName: string,
  stage: string,
): DetailBody | undefined {
  const fields: Record<string, string> = {};
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    const m = FIELD_RE.exec(line);
    if (m) fields[m[1]!] = (m[2] ?? "").trim();
    // Header fields all precede the findings block; stop before parsing JSON.
    if (line.startsWith("## Findings")) break;
  }
  // `<sensorId>-<fireId8>.md` — the id may itself contain hyphens, so split on
  // the LAST one rather than the first.
  const base = fileName.endsWith(".md") ? fileName.slice(0, -3) : fileName;
  const cut = base.lastIndexOf("-");
  if (cut <= 0) return undefined;
  const sensorId = base.slice(0, cut);
  const fireId = fields["Fire id"] || base.slice(cut + 1);

  const errors: TypeCheckError[] = [];
  const unreferenced: string[] = [];
  let findingsCount: number | undefined;
  let reason: string | undefined;
  let facts: FindingFact[] = [];

  const fence = /```json\n([\s\S]*?)\n```/.exec(text);
  if (fence) {
    try {
      const j = JSON.parse(fence[1] ?? "") as Record<string, unknown>;
      if (typeof j.findings_count === "number") findingsCount = j.findings_count;
      if (Array.isArray(j.errors)) {
        for (const e of j.errors) {
          if (typeof e !== "object" || e === null) continue;
          const r = e as Record<string, unknown>;
          if (typeof r.file !== "string" || typeof r.message !== "string") continue;
          errors.push({
            file: r.file,
            line: typeof r.line === "number" ? r.line : undefined,
            column: typeof r.column === "number" ? r.column : undefined,
            message: r.message,
          });
        }
      }
      if (Array.isArray(j.unreferenced)) {
        for (const u of j.unreferenced) if (typeof u === "string") unreferenced.push(u);
      }
      if (typeof j.reason === "string" && j.reason.trim()) reason = j.reason.trim();
      facts = findingFacts(j);
    } catch {
      // A truncated/partially-synced body: keep the header, drop the findings.
    }
  }

  return {
    fireId,
    sensorId,
    stage,
    ts: fields.Timestamp,
    outputPath: fields["Output path"],
    findingsCount,
    errors,
    unreferenced,
    reason,
    facts,
    file: fileName,
  };
}

/** Read every detail file under the record's sensors dir, keyed by fire id. */
function readDetailBodies(recordDir: string): Map<string, DetailBody> {
  const out = new Map<string, DetailBody>();
  const root = engineReadDir(recordDir, "sensors", ".aidlc-sensors");
  let stageDirs: string[];
  try {
    stageDirs = fs.readdirSync(root);
  } catch {
    return out;
  }
  for (const stage of stageDirs) {
    let files: string[];
    try {
      files = fs.readdirSync(path.join(root, stage));
    } catch {
      continue;
    }
    for (const f of files) {
      if (!f.endsWith(".md")) continue;
      let text: string;
      try {
        text = fs.readFileSync(path.join(root, stage, f), "utf-8");
      } catch {
        continue;
      }
      const body = parseSensorDetail(text, f, stage);
      if (body) out.set(body.fireId, body);
    }
  }
  return out;
}

/**
 * Join the audit ledger's firings with the on-disk finding bodies.
 * `recordDir` is only read for the bodies, so a ledger-only call still yields
 * correct counts with empty failure details.
 */
export function readSensorReport(recordDir: string, ledger: AuditLedger): SensorReport {
  const bodies = readDetailBodies(recordDir);
  const claimed = new Set<string>();

  const perStage = new Map<string, SensorStageSummary>();
  const stageOf = (stage: string): SensorStageSummary => {
    let s = perStage.get(stage);
    if (!s) {
      s = { stage, fired: 0, passed: 0, failed: 0, budgetOverride: 0, pending: 0, byId: new Map() };
      perStage.set(stage, s);
    }
    return s;
  };

  // Terminal events per fire id, so a FIRED with no terminal counts as pending.
  const terminal = new Map<string, string>();
  for (const e of ledger.events) {
    if (
      e.event === "SENSOR_PASSED" ||
      e.event === "SENSOR_FAILED" ||
      e.event === "SENSOR_BUDGET_OVERRIDE"
    ) {
      const fid = e.fields["Fire id"];
      if (fid) terminal.set(fid, e.event);
    }
  }

  const failures: SensorFailure[] = [];
  for (const e of ledger.events) {
    if (e.event === "SENSOR_FIRED") {
      const stage = e.stage ?? "(unattributed)";
      const s = stageOf(stage);
      s.fired++;
      const id = e.fields["Sensor ID"] ?? "(unknown)";
      s.byId.set(id, (s.byId.get(id) ?? 0) + 1);
      const fid = e.fields["Fire id"];
      const t = fid ? terminal.get(fid) : undefined;
      if (t === "SENSOR_PASSED") s.passed++;
      else if (t === "SENSOR_FAILED") s.failed++;
      else if (t === "SENSOR_BUDGET_OVERRIDE") s.budgetOverride++;
      else s.pending++;
      continue;
    }
    if (e.event !== "SENSOR_FAILED") continue;

    const fireId = e.fields["Fire id"] ?? "";
    const body = fireId ? bodies.get(fireId) : undefined;
    if (body) claimed.add(fireId);
    const countRaw = e.fields["Findings count"];
    failures.push({
      id: e.fields["Sensor ID"] ?? body?.sensorId ?? "(unknown)",
      stage: e.stage ?? body?.stage ?? "(unattributed)",
      fireId,
      ts: e.ts,
      outputPath: body?.outputPath,
      findingsCount:
        body?.findingsCount ?? (countRaw && /^\d+$/.test(countRaw) ? Number(countRaw) : undefined),
      errors: body?.errors ?? [],
      unreferenced: body?.unreferenced ?? [],
      reason: body?.reason,
      facts: body?.facts ?? [],
      detailFile: body?.file,
    });
  }

  failures.reverse(); // ledger is ascending; failures read newest-first

  const stages = [...perStage.values()];
  return {
    stages,
    failures,
    totalFired: stages.reduce((n, s) => n + s.fired, 0),
    totalPassed: stages.reduce((n, s) => n + s.passed, 0),
    totalFailed: stages.reduce((n, s) => n + s.failed, 0),
    orphanDetailFiles: [...bodies.keys()].filter((k) => !claimed.has(k)).length,
    failuresWithoutBody: failures.filter((f) => f.detailFile === undefined).length,
  };
}
