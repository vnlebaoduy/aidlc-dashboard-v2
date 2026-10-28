// The space's intent registry, and the names of every space in the workspace.
//
// Upstream keeps one row per piece of work in `aidlc/spaces/<space>/intents/intents.json`
// — `{uuid, slug, dirName, scope, repos, status}` — so a dashboard can offer a choice
// instead of dead-ending on "several intents · no active cursor". The file is hand
// editable: a comment, a BOM or a trailing comma still reads as every row upstream can
// read, so this reader tolerates those three and gives up on anything else rather than
// inventing rows.
//
// Read-only; never throws.

import * as fs from "node:fs";
import * as path from "node:path";

export interface IntentRow {
  uuid?: string;
  slug?: string;
  /** Record directory name, verbatim. */
  dirName?: string;
  scope?: string;
  repos?: string[];
  /** `in-flight` | `complete` | `archived`, as written. */
  status?: string;
}

function clean(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/,(\s*[\]}])/g, "$1");
}

function str(value: unknown, key: string): string | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const field = Reflect.get(value, key);
  return typeof field === "string" && field.length > 0 ? field : undefined;
}

function rowOf(value: unknown): IntentRow | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const uuid = str(value, "uuid");
  const slug = str(value, "slug");
  const dirName = str(value, "dirName");
  const scope = str(value, "scope");
  const status = str(value, "status");
  const rawRepos = Reflect.get(value, "repos");
  const repos = Array.isArray(rawRepos)
    ? rawRepos.filter((repo): repo is string => typeof repo === "string")
    : undefined;
  const row: IntentRow = {
    ...(uuid ? { uuid } : {}),
    ...(slug ? { slug } : {}),
    ...(dirName ? { dirName } : {}),
    ...(scope ? { scope } : {}),
    ...(status ? { status } : {}),
    ...(repos && repos.length > 0 ? { repos } : {}),
  };
  return Object.keys(row).length > 0 ? row : undefined;
}

/** Rows of the registry, or undefined when the file is absent or unreadable. */
export function readIntentRegistry(spaceDir: string): IntentRow[] | undefined {
  const file = path.join(spaceDir, "intents", "intents.json");
  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf-8");
  } catch {
    return undefined;
  }
  const doc = (() => {
    try {
      return JSON.parse(clean(raw)) as unknown;
    } catch {
      return undefined;
    }
  })();
  if (!Array.isArray(doc)) return undefined;
  return doc.map(rowOf).filter((row): row is IntentRow => row !== undefined);
}

/** Space directory names under `aidlc/spaces`, sorted. Empty when none. */
export function listSpaces(root: string): string[] {
  const dir = path.join(root, "aidlc", "spaces");
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
