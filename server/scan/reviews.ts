// Reviewer verdicts: `<stage dir>/reviews/review-NN.md`.
//
// The reviewer writes exactly one file per pass, and the engine reads four rendered
// lines from it (`**Verdict:**`, `**Reviewer:**`, `**Iteration:**`,
// `**Verdict Dictated:**`) plus a `### Findings` report. The dashboard listed no
// review anywhere, so a gate could not show who reviewed the stage or what came back.
//
// This reader walks the record for `reviews/` directories (bounded, skipping the
// machine-only planes), reads only the ownership lines and the findings row count,
// and returns the viewer-relative path. It never parses the prose.

import * as fs from "node:fs";
import * as path from "node:path";

export interface ReviewRecord {
  /** Record-relative POSIX path of the review file. */
  rel: string;
  /** Stage directory the review sits in, e.g. `requirements-analysis`. */
  stage: string;
  /** Unit directory, when the review sits under `construction/<unit>/`. */
  unit?: string;
  /** Review number from the file name (`review-02.md` → 2). */
  number: number;
  verdict?: "READY" | "NOT-READY";
  reviewer?: string;
  iteration?: string;
  updatedAt?: string;
  /** Rows under `New findings`, when the report is readable; undefined when absent. */
  findings?: number;
}

const SKIP_DIRS = new Set([".aidlc-engine", "audit", "node_modules", ".git", "verification"]);
const MAX_DEPTH = 5;

function field(text: string, label: string): string | undefined {
  const match = new RegExp(`^\\*\\*${label}:\\*\\*[ \\t]*(.+)$`, "m").exec(text);
  const value = match?.[1]?.trim();
  return value && value.length > 0 ? value : undefined;
}

/** Count data rows under `**New findings**`'s table, ignoring header and separator. */
function countNewFindings(text: string): number | undefined {
  const start = text.indexOf("**New findings**");
  if (start < 0) return undefined;
  const rest = text.slice(start + "**New findings**".length);
  const lines = rest.split(/\r?\n/);
  let rows = 0;
  let inTable = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("|")) {
      if (!inTable) {
        inTable = true;
        continue;
      }
      if (/^\|[\s|:-]+\|$/.test(trimmed)) continue;
      rows += 1;
      continue;
    }
    if (inTable) break;
  }
  return rows;
}

function recordReview(recordDir: string, dir: string, file: string): ReviewRecord | undefined {
  const match = /^review-(\d+)\.md$/.exec(file);
  if (!match?.[1]) return undefined;
  const full = path.join(dir, file);
  let text: string;
  try {
    text = fs.readFileSync(full, "utf-8");
  } catch {
    return undefined;
  }
  const relParts = path.relative(recordDir, full).split(path.sep);
  const reviewsAt = relParts.lastIndexOf("reviews");
  if (reviewsAt < 1) return undefined;
  const stage = relParts[reviewsAt - 1];
  if (!stage) return undefined;
  const constructionAt = relParts.indexOf("construction");
  const unit =
    constructionAt >= 0 && reviewsAt - constructionAt >= 3
      ? relParts[constructionAt + 1]
      : undefined;
  const verdictText = field(text, "Verdict");
  const verdict = verdictText === "READY" || verdictText === "NOT-READY" ? verdictText : undefined;
  let updatedAt: string | undefined;
  try {
    updatedAt = fs.statSync(full).mtime.toISOString();
  } catch {
    updatedAt = undefined;
  }
  const findings = countNewFindings(text);
  return {
    rel: relParts.join("/"),
    stage,
    ...(unit ? { unit } : {}),
    number: Number(match[1]),
    ...(verdict ? { verdict } : {}),
    ...(field(text, "Reviewer") ? { reviewer: field(text, "Reviewer") } : {}),
    ...(field(text, "Iteration") ? { iteration: field(text, "Iteration") } : {}),
    ...(updatedAt ? { updatedAt } : {}),
    ...(findings !== undefined ? { findings } : {}),
  };
}

function walk(recordDir: string, dir: string, depth: number, out: ReviewRecord[]): void {
  if (depth > MAX_DEPTH) return;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) continue;
    const child = path.join(dir, entry.name);
    if (entry.name === "reviews") {
      let files: string[];
      try {
        files = fs.readdirSync(child);
      } catch {
        continue;
      }
      for (const file of files.sort()) {
        const review = recordReview(recordDir, child, file);
        if (review) out.push(review);
      }
      continue;
    }
    walk(recordDir, child, depth + 1, out);
  }
}

/** Every review in the record, oldest number per stage first. Undefined when none. */
export function readReviews(recordDir: string): ReviewRecord[] | undefined {
  const out: ReviewRecord[] = [];
  walk(recordDir, recordDir, 0, out);
  if (out.length === 0) return undefined;
  return out.sort(
    (a, b) =>
      a.stage.localeCompare(b.stage) ||
      (a.unit ?? "").localeCompare(b.unit ?? "") ||
      a.number - b.number,
  );
}
