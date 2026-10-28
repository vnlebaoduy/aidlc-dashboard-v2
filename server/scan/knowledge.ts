// What the engine actually fed the run: the space's knowledge base and code knowledge.
//
// Upstream keeps three inputs beside the intents, all space-level:
//
//   memory/            org.md, team.md, project.md, phases/* — the rule chain
//   knowledge/         documents/ (originals) and documentkb/index.json (derived
//                      catalog: one row per document with an extraction state and,
//                      when missing from this clone, a tombstone)
//   codekb/<repo>/     one store per repo for brownfield work
//
// The Sources page claimed to describe "every input" while reading none of these.
// This reader summarises them without interpreting content: counts, states, and the
// names of the rule files present. Never throws; each piece is undefined when absent.

import * as fs from "node:fs";
import * as path from "node:path";

export interface KnowledgeDocumentState {
  /** `extracted`, `unsupported_type`, `extractor_unavailable`, … as written. */
  state: string;
  count: number;
}

export interface KnowledgeSummary {
  /** Original files under `knowledge/documents`, counted recursively. */
  documentFiles: number;
  /** Rows in `documentkb/index.json`, when the catalog exists and parses. */
  indexedDocuments?: number;
  /** Extraction state → count, when the catalog parses. */
  states?: KnowledgeDocumentState[];
  /** Rows carrying a tombstone flag (deleted on purpose, identity kept). */
  tombstones?: number;
  /** Rows whose source is `linked` rather than copied into `documents/`. */
  linked?: number;
  /** Repo directories under `codekb/`, sorted. */
  codekbRepos: string[];
  /** Rule files present under `memory/`: `org.md`, `team.md`, `project.md`. */
  memoryFiles: string[];
  /** Phase rule files under `memory/phases`, when present. */
  phaseRules: number;
}

function countFiles(dir: string): number {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  let total = 0;
  for (const entry of entries) {
    if (entry.isDirectory()) total += countFiles(path.join(dir, entry.name));
    else if (entry.isFile()) total += 1;
  }
  return total;
}

function subdirs(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

interface RowTally {
  indexed: number;
  states: Record<string, number>;
  tombstones: number;
  linked: number;
}

function tallyIndex(raw: string): RowTally | undefined {
  let doc: unknown;
  try {
    doc = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (typeof doc !== "object" || doc === null || !("documents" in doc)) return undefined;
  if (!Array.isArray(doc.documents)) return undefined;

  const tally: RowTally = { indexed: 0, states: {}, tombstones: 0, linked: 0 };
  for (const row of doc.documents) {
    if (typeof row !== "object" || row === null) continue;
    tally.indexed += 1;
    const extraction = "extraction" in row ? row.extraction : undefined;
    const state =
      typeof extraction === "object" &&
      extraction !== null &&
      "state" in extraction &&
      typeof extraction.state === "string"
        ? extraction.state
        : "unknown";
    tally.states[state] = (tally.states[state] ?? 0) + 1;
    if ("tombstone" in row && row.tombstone) tally.tombstones += 1;
    const source = "source" in row ? row.source : undefined;
    if (
      typeof source === "object" &&
      source !== null &&
      "kind" in source &&
      source.kind === "linked"
    )
      tally.linked += 1;
  }
  return tally;
}

/** Rules, documents and code knowledge of one space. Undefined when none exist. */
export function readKnowledge(spaceDir: string): KnowledgeSummary | undefined {
  const memoryDir = path.join(spaceDir, "memory");
  const memoryFiles = ["org.md", "team.md", "project.md"].filter((name) =>
    fs.existsSync(path.join(memoryDir, name)),
  );
  const phaseRules = countFiles(path.join(memoryDir, "phases"));

  const knowledgeDir = path.join(spaceDir, "knowledge");
  const documentFiles = countFiles(path.join(knowledgeDir, "documents"));
  const indexFile = path.join(knowledgeDir, "documentkb", "index.json");
  let tally: RowTally | undefined;
  try {
    tally = tallyIndex(fs.readFileSync(indexFile, "utf-8"));
  } catch {
    tally = undefined;
  }

  const codekbRepos = subdirs(path.join(spaceDir, "codekb"));
  const nothing =
    memoryFiles.length === 0 &&
    phaseRules === 0 &&
    documentFiles === 0 &&
    tally === undefined &&
    codekbRepos.length === 0;
  if (nothing) return undefined;

  const states = tally
    ? Object.entries(tally.states)
        .map(([state, count]) => ({ state, count }))
        .sort((a, b) => b.count - a.count || a.state.localeCompare(b.state))
    : undefined;
  return {
    documentFiles,
    ...(tally ? { indexedDocuments: tally.indexed, tombstones: tally.tombstones } : {}),
    ...(states ? { states } : {}),
    ...(tally && tally.linked > 0 ? { linked: tally.linked } : {}),
    codekbRepos,
    memoryFiles,
    phaseRules,
  };
}
