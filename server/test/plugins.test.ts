import { afterEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { readPluginInventory } from "../scan/plugins";

const dirs: string[] = [];

function tempWorkspace(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aidlc-plugins-"));
  dirs.push(dir);
  return dir;
}

function writeInventory(workspace: string, body: unknown): void {
  const dir = path.join(workspace, ".kiro", "tools", "data");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "harness.json"), JSON.stringify(body));
}

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("readPluginInventory", () => {
  test("reads the enabled plugin list and where it came from", () => {
    const workspace = tempWorkspace();
    writeInventory(workspace, { plugins: ["aidlc", "test-pro", ""] });

    const inventory = readPluginInventory(workspace, ".kiro");
    expect(inventory?.enabled).toEqual(["aidlc", "test-pro"]);
    expect(inventory?.source).toBe(".kiro/tools/data/harness.json");
  });

  test("an inventory with no plugins field, or a broken file, is absence", () => {
    const workspace = tempWorkspace();
    writeInventory(workspace, { name: "kiro" });
    expect(readPluginInventory(workspace, ".kiro")).toBeUndefined();

    fs.writeFileSync(path.join(workspace, ".kiro", "tools", "data", "harness.json"), "{");
    expect(readPluginInventory(workspace, ".kiro")).toBeUndefined();
  });

  test("a harness without an inventory is absence", () => {
    expect(readPluginInventory(tempWorkspace(), ".kiro")).toBeUndefined();
  });
});
