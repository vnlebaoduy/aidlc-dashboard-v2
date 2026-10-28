import { afterEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { readRuntimeGraph } from "../scan/runtime-graph";

const dirs: string[] = [];

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aidlc-runtime-graph-"));
  dirs.push(dir);
  return dir;
}

function writeGraph(dir: string, body: unknown): void {
  fs.writeFileSync(path.join(dir, "runtime-graph.json"), JSON.stringify(body));
}

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("readRuntimeGraph", () => {
  test("reads the workflow header and stage spans", () => {
    const dir = tempDir();
    writeGraph(dir, {
      workflow_id: "2026-01-01T00:00:00Z",
      started_at: "2026-01-01T00:00:00Z",
      stages: [
        {
          stage_slug: "functional-design",
          started_at: "2026-01-01T02:00:00Z",
          completed_at: "2026-01-01T03:30:00Z",
          agent: "aidlc-developer-agent",
          outcome: "approved",
        },
        { stage_slug: "code-generation", started_at: "2026-01-01T04:00:00Z" },
      ],
    });

    const graph = readRuntimeGraph(dir);
    expect(graph?.workflowId).toBe("2026-01-01T00:00:00Z");
    expect(graph?.stages.map((s) => s.slug)).toEqual(["functional-design", "code-generation"]);
    expect(graph?.stages[0]?.elapsedSec).toBe(5400);
    expect(graph?.stages[0]?.agent).toBe("aidlc-developer-agent");
    // An open stage keeps its start and reports no duration.
    expect(graph?.stages[1]?.completedAt).toBeUndefined();
    expect(graph?.stages[1]?.elapsedSec).toBeUndefined();
  });

  test("a missing file is absence, not an empty run", () => {
    expect(readRuntimeGraph(tempDir())).toBeUndefined();
  });

  test("malformed JSON and a wrong root shape are refused", () => {
    const dir = tempDir();
    fs.writeFileSync(path.join(dir, "runtime-graph.json"), "{not json");
    expect(readRuntimeGraph(dir)).toBeUndefined();

    const shaped = tempDir();
    writeGraph(shaped, { stages: "nope" });
    expect(readRuntimeGraph(shaped)).toBeUndefined();
  });

  test("rows without a slug, and an empty roster, are skipped", () => {
    const dir = tempDir();
    writeGraph(dir, {
      stages: [
        { started_at: "2026-01-01T00:00:00Z" },
        { stage_slug: "" },
        { stage_slug: "build-and-test" },
      ],
    });
    expect(readRuntimeGraph(dir)?.stages.map((s) => s.slug)).toEqual(["build-and-test"]);

    const empty = tempDir();
    writeGraph(empty, { stages: [] });
    expect(readRuntimeGraph(empty)).toBeUndefined();
  });

  test("a completion before its start yields no duration rather than a negative one", () => {
    const dir = tempDir();
    writeGraph(dir, {
      stages: [
        {
          stage_slug: "ci-pipeline",
          started_at: "2026-01-01T05:00:00Z",
          completed_at: "2026-01-01T04:00:00Z",
        },
      ],
    });
    expect(readRuntimeGraph(dir)?.stages[0]?.elapsedSec).toBeUndefined();
  });
});
