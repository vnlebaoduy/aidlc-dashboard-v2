// The app's project list: several AI-DLC workspaces, one read-only view each.
//
// Kept in the app's own data dir (`projects.json`), never inside a workspace. The
// single `workspace.json` an earlier build wrote is migrated on read, so an
// installed app keeps its selection without a migration step.
//
// Every entry is a path this app validated as a workspace when it was added; reads
// still re-check, because a folder can stop being one.

import * as fs from "node:fs";
import * as path from "node:path";

export interface ProjectEntry {
  root: string;
  /** Display name: the folder's own name. */
  name: string;
}

function cleanRoot(root: string): string {
  return path.resolve(root.trim());
}

function entryOf(root: string): ProjectEntry {
  const clean = cleanRoot(root);
  return { root: clean, name: path.basename(clean) || clean };
}

export function readProjects(dataDir: string): ProjectEntry[] {
  const file = path.join(dataDir, "projects.json");
  try {
    const doc: unknown = JSON.parse(fs.readFileSync(file, "utf-8"));
    if (Array.isArray(doc)) {
      const rows = doc
        .map((row) => {
          if (typeof row !== "object" || row === null || !("root" in row)) return undefined;
          return typeof row.root === "string" && row.root.trim().length > 0
            ? entryOf(row.root)
            : undefined;
        })
        .filter((row): row is ProjectEntry => row !== undefined);
      if (rows.length > 0) return dedupe(rows);
    }
  } catch {
    // Fall through to the legacy single-workspace file.
  }
  try {
    const legacy: unknown = JSON.parse(
      fs.readFileSync(path.join(dataDir, "workspace.json"), "utf-8"),
    );
    if (typeof legacy === "object" && legacy !== null && "root" in legacy) {
      return typeof legacy.root === "string" && legacy.root.trim().length > 0
        ? [entryOf(legacy.root)]
        : [];
    }
  } catch {
    // No selection yet.
  }
  return [];
}

export function writeProjects(dataDir: string, projects: ProjectEntry[]): void {
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, "projects.json");
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(dedupe(projects), null, 2)}\n`);
  fs.renameSync(tmp, file);
}

function dedupe(projects: ProjectEntry[]): ProjectEntry[] {
  const seen = new Set<string>();
  const out: ProjectEntry[] = [];
  for (const project of projects) {
    if (seen.has(project.root)) continue;
    seen.add(project.root);
    out.push(project);
  }
  return out;
}

/** Add a validated workspace; a repeated path moves to the front with its new name. */
export function addProject(dataDir: string, root: string): ProjectEntry[] {
  const next = [entryOf(root), ...readProjects(dataDir).filter((p) => p.root !== cleanRoot(root))];
  const projects = next.slice(0, 20);
  writeProjects(dataDir, projects);
  return projects;
}

export function removeProject(dataDir: string, root: string): ProjectEntry[] {
  const projects = readProjects(dataDir).filter((p) => p.root !== cleanRoot(root));
  writeProjects(dataDir, projects);
  return projects;
}
