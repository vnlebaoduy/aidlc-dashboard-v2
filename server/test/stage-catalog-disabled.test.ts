import { afterEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { readStageCatalog } from "../scan/stage-catalog";

const dirs: string[] = [];

function tempWorkspace(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aidlc-catalog-"));
  dirs.push(dir);
  fs.mkdirSync(path.join(dir, ".kiro", "tools", "data"), { recursive: true });
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("readStageCatalog with plugin-owned stages", () => {
  test("keeps a disabled stage's row but lists it as disabled", () => {
    const workspace = tempWorkspace();
    fs.writeFileSync(
      path.join(workspace, ".kiro", "tools", "data", "stage-graph.json"),
      JSON.stringify([
        { slug: "intent-capture", number: "1.1", name: "Intent Capture", phase: "ideation" },
        {
          slug: "test-pro-integration",
          number: "3.9",
          name: "Integration",
          phase: "construction",
          enabled: false,
        },
      ]),
    );

    const catalog = readStageCatalog(workspace, ".kiro");
    expect(catalog?.stages).toHaveLength(2);
    expect(catalog?.disabled).toEqual(["test-pro-integration"]);
    expect(catalog?.stages[0]?.enabled).toBe(true);
  });

  test("a graph without the flag reports nothing disabled", () => {
    const workspace = tempWorkspace();
    fs.writeFileSync(
      path.join(workspace, ".kiro", "tools", "data", "stage-graph.json"),
      JSON.stringify([{ slug: "intent-capture", number: "1.1", phase: "ideation" }]),
    );
    expect(readStageCatalog(workspace, ".kiro")?.disabled).toEqual([]);
  });
});
