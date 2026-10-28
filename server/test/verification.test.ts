import { afterEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { readPhaseChecks } from "../scan/verification";

const dirs: string[] = [];

function tempRecord(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aidlc-phase-checks-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("readPhaseChecks", () => {
  test("lists each phase check with a viewer-ready path", () => {
    const record = tempRecord();
    fs.mkdirSync(path.join(record, "verification"));
    fs.writeFileSync(path.join(record, "verification", "phase-check-ideation.md"), "checks");
    fs.writeFileSync(path.join(record, "verification", "phase-check-inception.md"), "checks");
    fs.writeFileSync(path.join(record, "verification", "notes.md"), "ignored");

    const checks = readPhaseChecks(record);
    expect(checks?.map((c) => c.phase)).toEqual(["ideation", "inception"]);
    expect(checks?.[0]?.rel).toBe("verification/phase-check-ideation.md");
    expect(checks?.[0]?.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test("no closed phase means absence, not a passing boundary", () => {
    expect(readPhaseChecks(tempRecord())).toBeUndefined();
  });
});
