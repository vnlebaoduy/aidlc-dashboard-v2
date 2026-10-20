// Workspaces the reader has opened, newest first, so the picker and the header switcher
// keep listing them after a switch.
//
// WHY: discovery (scan/workspaces.ts) only walks a bounded part of the home directory
// (depth 3, or 5 under ~/Projects-style folders). A workspace opened by path from
// deeper down — `~/DATA/01_PROJECT/00_DEMO/x/app` — was listed only while it was the
// active one and vanished the moment the reader switched away.
//
// Stored beside `data/usage.db`, outside every workspace: the workspace stays read-only.
// Only `/select` (after it validated the path) and a startup `--root` add entries, so the
// file never holds a path that was not a workspace when it was written; on read, entries
// that are no longer workspaces are dropped. Never throws — a bad or missing file is an
// empty list, a failed write is ignored (the list is a convenience, not state).

import * as fs from "node:fs";
import * as path from "node:path";
import { isWorkspaceDir, workspaceKey } from "./browse";

export interface RecentWorkspaces {
  /** Paths, newest first, that are still workspaces. */
  list(): string[];
  /** Move `dir` (already validated) to the front. */
  add(dir: string): void;
}

const MAX_RECENT = 20;

function merge(current: string[], dir: string): string[] {
  const key = workspaceKey(dir);
  return [dir, ...current.filter((p) => workspaceKey(p) !== key)].slice(0, MAX_RECENT);
}

export function fileRecents(file = path.join("data", "recent-workspaces.json")): RecentWorkspaces {
  const read = (): string[] => {
    try {
      const raw: unknown = JSON.parse(fs.readFileSync(file, "utf-8"));
      return Array.isArray(raw)
        ? raw.filter((p): p is string => typeof p === "string" && path.isAbsolute(p))
        : [];
    } catch {
      return [];
    }
  };
  return {
    list: () => read().filter(isWorkspaceDir),
    add(dir) {
      try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        // Write-then-rename, so a crash mid-write never leaves a truncated list.
        const tmp = `${file}.${process.pid}.tmp`;
        fs.writeFileSync(tmp, `${JSON.stringify(merge(read(), dir), null, 2)}\n`);
        fs.renameSync(tmp, file);
      } catch {
        // Not remembering a workspace costs a rescan, nothing more.
      }
    },
  };
}

/** In-memory list for tests: same ordering and validation, no disk. */
export function memoryRecents(): RecentWorkspaces {
  let paths: string[] = [];
  return {
    list: () => paths.filter(isWorkspaceDir),
    add(dir) {
      paths = merge(paths, dir);
    },
  };
}
