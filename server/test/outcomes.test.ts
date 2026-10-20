// OUTCOMES.md lookup (server/scan/outcomes.ts): the record's copy wins, the workspace
// root's is the fallback, and only that one exact name may leave the record.
import { afterAll, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { OUTCOMES_REL, artifactBase, readOutcomes } from "../scan/outcomes";
import { readArtifactSource } from "../scan/view-file";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aidlc-outcomes-"));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

function workspace(name: string, files: Record<string, string>) {
  const root = path.join(tmp, name);
  const record = path.join(root, "aidlc", "spaces", "default", "intents", "r1");
  fs.mkdirSync(record, { recursive: true });
  for (const [rel, text] of Object.entries(files)) {
    const abs = path.join(root, rel.replace("<record>", path.relative(root, record)));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
  }
  return { root, record };
}

describe("OUTCOMES.md lookup", () => {
  test("the record's copy wins over the workspace root's", () => {
    const { root, record } = workspace("both", {
      [OUTCOMES_REL]: "root",
      [`<record>/${OUTCOMES_REL}`]: "record copy",
    });
    expect(readOutcomes(root, record)).toMatchObject({ where: "record", sizeBytes: 11 });
    const view = readArtifactSource(artifactBase(root, record, OUTCOMES_REL), OUTCOMES_REL);
    expect(view.ok && view.source.text).toBe("record copy");
  });

  test("the workspace root is read when the record has none, and says so", () => {
    const { root, record } = workspace("root-only", { [OUTCOMES_REL]: "root pack" });
    expect(readOutcomes(root, record)).toMatchObject({ where: "workspace", sizeBytes: 9 });
    const view = readArtifactSource(artifactBase(root, record, OUTCOMES_REL), OUTCOMES_REL);
    expect(view.ok && view.source.text).toBe("root pack");
  });

  test("no file anywhere → null, and the viewer still answers not-found", () => {
    const { root, record } = workspace("none", {});
    expect(readOutcomes(root, record)).toBeNull();
    const view = readArtifactSource(artifactBase(root, record, OUTCOMES_REL), OUTCOMES_REL);
    expect(view).toMatchObject({ ok: false, refusal: { code: "not-found" } });
  });

  test("only the exact name falls back: other root files stay outside the jail", () => {
    const { root, record } = workspace("jail", {
      [OUTCOMES_REL]: "root pack",
      "README.md": "not a record file",
      "notes/OUTCOMES.md": "nested",
    });
    for (const rel of ["README.md", "notes/OUTCOMES.md", "outcomes.md", "./OUTCOMES.md"]) {
      expect(artifactBase(root, record, rel)).toBe(record);
      expect(readArtifactSource(artifactBase(root, record, rel), rel).ok).toBe(false);
    }
  });

  test("a root OUTCOMES.md that is a symlink out of the workspace is refused", () => {
    const outside = path.join(tmp, "secret.md");
    fs.writeFileSync(outside, "secret");
    const { root, record } = workspace("symlink", {});
    fs.symlinkSync(outside, path.join(root, OUTCOMES_REL));
    expect(readOutcomes(root, record)).toBeNull();
    expect(readArtifactSource(artifactBase(root, record, OUTCOMES_REL), OUTCOMES_REL).ok).toBe(
      false,
    );
  });
});
