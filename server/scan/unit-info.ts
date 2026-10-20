// What each Unit of Work IS, read from the run's own Units Generation output
// (`inception/units-generation/unit-of-work.md`). The roster (`bolt_dag`) only names
// units by slug; this file is where the run wrote what each one does. Read as data,
// never interpreted: a heading or a description is shown verbatim, in the run's language.
//
// The document shape the engine writes (Vietnamese or English labels):
//
//   | Unit ID | Directory | Tên | Kind | Độ phức tạp | Triển khai |
//   | U1 | `u1-c12-skeleton` | Walking skeleton C12 | service | M | Embedded … |
//
//   ## U1 — `u1-c12-skeleton` (walking skeleton)
//   **Mô tả:** Lát cắt mỏng chạy hết đường tích hợp thật …
//
// Either half may be missing; whatever is found is returned, nothing is invented.
// Node fs only, never throws.

import * as fs from "node:fs";
import * as path from "node:path";

export interface UnitInfo {
  /** Short title from the summary table ("Walking skeleton C12"). */
  title?: string;
  /** The `**Description:**` / `**Mô tả:**` line under the unit's heading. */
  description?: string;
  /** Complexity column (S / M / L …), verbatim. */
  complexity?: string;
}

const DESCRIPTION_LABEL = /^\*\*(?:Description|Mô tả|Summary|Purpose|Mục đích)\s*:?\*\*\s*:?\s*/i;
const TITLE_HEADER = /^(?:name|title|tên)$/i;
const COMPLEXITY_HEADER = /^(?:complexity|độ phức tạp|size)$/i;
const DIR_HEADER = /^(?:directory|dir|slug|thư mục)$/i;

/** Keep tooltips readable: one paragraph, capped. */
const MAX_DESCRIPTION = 400;

function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());
}

function bare(cell: string): string {
  return cell.replace(/^`|`$/g, "").trim();
}

function clip(text: string): string {
  const one = text.replace(/\s+/g, " ").trim();
  return one.length > MAX_DESCRIPTION ? `${one.slice(0, MAX_DESCRIPTION - 1)}…` : one;
}

/** Parse the document text. Exported for tests; `readUnitInfo` reads the file. */
export function parseUnitInfo(text: string, slugs: readonly string[]): Record<string, UnitInfo> {
  const out: Record<string, UnitInfo> = {};
  const lines = text.split(/\r?\n/);
  const known = new Set(slugs);
  const entry = (slug: string): UnitInfo => {
    out[slug] ??= {};
    return out[slug];
  };

  // 1. The summary table: the first table whose header has a directory column.
  for (let i = 0; i + 1 < lines.length; i++) {
    if (!lines[i]!.trim().startsWith("|") || !/^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1]!)) continue;
    const head = cells(lines[i]!);
    const dirCol = head.findIndex((h) => DIR_HEADER.test(h));
    if (dirCol < 0) continue;
    const titleCol = head.findIndex((h) => TITLE_HEADER.test(h));
    const sizeCol = head.findIndex((h) => COMPLEXITY_HEADER.test(h));
    for (let j = i + 2; j < lines.length && lines[j]!.trim().startsWith("|"); j++) {
      const row = cells(lines[j]!);
      const slug = bare(row[dirCol] ?? "");
      if (!known.has(slug)) continue;
      const u = entry(slug);
      if (titleCol >= 0 && row[titleCol]) u.title = bare(row[titleCol]!);
      if (sizeCol >= 0 && row[sizeCol]) u.complexity = bare(row[sizeCol]!);
    }
    break;
  }

  // 2. Each unit's section: a heading naming the slug, then its description line.
  let current: string | undefined;
  for (const line of lines) {
    if (/^#{2,4}\s/.test(line)) {
      current = slugs.find((s) => line.includes(s));
      continue;
    }
    if (!current || !DESCRIPTION_LABEL.test(line)) continue;
    const u = entry(current);
    u.description ??= clip(line.replace(DESCRIPTION_LABEL, ""));
  }
  return out;
}

/**
 * Unit descriptions for a record, keyed by slug. Missing file or unknown shape → `{}`;
 * the matrix then shows the roster facts alone, as before.
 */
export function readUnitInfo(
  recordDir: string,
  slugs: readonly string[],
): Record<string, UnitInfo> {
  if (slugs.length === 0) return {};
  try {
    const text = fs.readFileSync(
      path.join(recordDir, "inception", "units-generation", "unit-of-work.md"),
      "utf-8",
    );
    return parseUnitInfo(text, slugs);
  } catch {
    return {};
  }
}
