import { afterAll, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { assemble } from "../model/assemble";

// `runtime-graph.json` is written at approvals, so a stage it marks completed that the
// state file does not show done means one of the two is behind. The dashboard must name
// the stage instead of picking a winner — and stay silent when they agree.

const source = path.join(import.meta.dir, "..", "..", "fixtures", "reference");
const dirs: string[] = [];

function copyFixture(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aidlc-divergence-"));
  dirs.push(dir);
  fs.cpSync(source, dir, { recursive: true });
  return dir;
}

function graphPath(workspace: string): string {
  const intents = path.join(workspace, "aidlc", "spaces", "default", "intents");
  const record = fs
    .readdirSync(intents, { withFileTypes: true })
    .find((entry) => entry.isDirectory() && entry.name !== "active-intent");
  if (!record) throw new Error("fixture has no record dir");
  return path.join(intents, record.name, "runtime-graph.json");
}

afterAll(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("runtime/state divergence", () => {
  test("the fixture agrees, so no warning is raised", () => {
    const workspace = copyFixture();
    const model = assemble(workspace);
    expect(model.warnings.some((w) => w.code === "runtime-state-divergence")).toBe(false);
  });

  test("a completed runtime stage that state.md does not show done is named", () => {
    const workspace = copyFixture();
    const first = assemble(workspace);
    const pending = first.state.phases
      .flatMap((phase) => phase.stages)
      .find((stage) => stage.status !== "done");
    expect(pending).toBeDefined();
    if (!pending) return;

    const file = graphPath(workspace);
    const doc = JSON.parse(fs.readFileSync(file, "utf-8")) as {
      stages: Record<string, unknown>[];
    };
    doc.stages.push({
      stage_slug: pending.slug,
      started_at: "2026-01-02T00:00:00Z",
      completed_at: "2026-01-02T01:00:00Z",
    });
    fs.writeFileSync(file, JSON.stringify(doc));

    const second = assemble(workspace);
    const warning = second.warnings.find((w) => w.code === "runtime-state-divergence");
    expect(warning).toBeDefined();
    if (warning?.code === "runtime-state-divergence") expect(warning.stage).toBe(pending.slug);
  });
});
