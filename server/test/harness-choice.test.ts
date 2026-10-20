// Which harness a workspace with BOTH `.kiro` and `.claude` is read as. The answer must
// be one measured fact (the audit's HUMAN_TURN sessions, matched against each tool's
// session store), used everywhere: the stage catalogue, the identity on Sources and the
// usage panel. A real run had 190 Kiro turns and 0 Claude Code turns, yet Sources said
// `.claude` (probe order) while usage said Kiro.

import { afterAll, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { projectSlug } from "../credit/claude/transcript-reader";
import { assemble } from "../model/assemble";

const FIXTURE = path.join(import.meta.dir, "..", "..", "fixtures", "reference");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "harness-choice-"));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

/** The reference run with both harness trees, sessions attributed as asked. */
function workspace(name: string, sessions: { kiro?: string[]; claude?: string[] }) {
  const root = path.join(tmp, name, "ws");
  const home = path.join(tmp, name, "home");
  fs.cpSync(FIXTURE, root, { recursive: true });
  // Both trees ship a catalogue; `.claude` wins the probe order.
  const kiroCat = path.join(root, ".kiro", "tools", "data");
  const claudeCat = path.join(root, ".claude", "tools", "data");
  fs.mkdirSync(claudeCat, { recursive: true });
  fs.cpSync(path.join(kiroCat, "stage-graph.json"), path.join(claudeCat, "stage-graph.json"));

  const all = [...(sessions.kiro ?? []), ...(sessions.claude ?? [])];
  const audit = path.join(
    root,
    "aidlc/spaces/default/intents/260101-demo-migration/audit/demo-host-aabbccdd1122.md",
  );
  for (const [i, id] of all.entries()) {
    fs.appendFileSync(
      audit,
      `\n## Human Turn\n**Timestamp**: 2026-01-03T00:0${i}:00Z\n**Event**: HUMAN_TURN\n**Session**: ${id}\n\n---\n`,
    );
  }
  for (const id of sessions.kiro ?? []) {
    fs.mkdirSync(path.join(home, ".kiro", "sessions", "cli"), { recursive: true });
    fs.writeFileSync(path.join(home, ".kiro", "sessions", "cli", `${id}.json`), "{}");
  }
  for (const id of sessions.claude ?? []) {
    const dir = path.join(home, ".claude", "projects", projectSlug(root));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${id}.jsonl`), "");
  }
  return { root, home };
}

describe("harness choice with .kiro and .claude side by side", () => {
  test("the tool that ran wins everywhere, and a clear lead raises no warning", () => {
    const { root, home } = workspace("kiro-ran", { kiro: ["k1", "k2", "k3"] });
    const m = assemble(root, undefined, { window: "30d", home });
    expect(m.identity.harnessDir).toBe(".kiro");
    expect(m.usage.kind).toBe("kiro");
    expect(m.warnings.map((w) => w.code)).not.toContain("harness-coexist");
  });

  test("Claude Code leading flips both together", () => {
    const { root, home } = workspace("claude-ran", { claude: ["c1", "c2"], kiro: ["k1"] });
    const m = assemble(root, undefined, { window: "30d", home });
    expect(m.identity.harnessDir).toBe(".claude");
    expect(m.usage.kind).toBe("claude");
  });

  test("no evidence keeps probe order and SAYS it guessed", () => {
    const { root, home } = workspace("no-evidence", {});
    const m = assemble(root, undefined, { window: "30d", home });
    expect(m.identity.harnessDir).toBe(".claude");
    expect(m.usage.kind).toBe("claude");
    expect(m.warnings.map((w) => w.code)).toContain("harness-coexist");
  });

  test("an explicit --harness is obeyed, not measured", () => {
    const { root, home } = workspace("pinned", { kiro: ["k1"] });
    const m = assemble(root, ".claude", { window: "30d", home });
    expect(m.identity.harnessDir).toBe(".claude");
  });
});
