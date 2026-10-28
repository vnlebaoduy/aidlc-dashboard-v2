// Installed plugin inventory: `<harness>/tools/data/harness.json` → `plugins`.
//
// Upstream writes the enabled plugin list there, and a disabled plugin's stages are
// recompiled into the graph with `enabled: false` rather than removed. The dashboard
// showed neither, so a stage owned by a plugin looked like a core stage and a
// disabled plugin's stage looked missing.
//
// Read-only; absent file means "this harness ships no inventory", never "no plugins".

import * as fs from "node:fs";
import * as path from "node:path";

export interface PluginInventory {
  /** Enabled plugin names, `aidlc` first when present, as written. */
  enabled: string[];
  /** Harness-relative path of the inventory file that answered. */
  source: string;
}

export function readPluginInventory(root: string, harnessDir: string): PluginInventory | undefined {
  const rel = path.posix.join(harnessDir, "tools", "data", "harness.json");
  let raw: string;
  try {
    raw = fs.readFileSync(path.join(root, harnessDir, "tools", "data", "harness.json"), "utf-8");
  } catch {
    return undefined;
  }
  let doc: unknown;
  try {
    doc = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (typeof doc !== "object" || doc === null || !("plugins" in doc)) return undefined;
  const plugins = doc.plugins;
  if (!Array.isArray(plugins)) return undefined;
  const enabled = plugins.filter(
    (name): name is string => typeof name === "string" && name.length > 0,
  );
  return { enabled, source: rel };
}
