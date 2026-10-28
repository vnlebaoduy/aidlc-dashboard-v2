import { afterEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { readPlan } from "../scan/plan";

const dirs: string[] = [];

function tempRecord(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aidlc-plan-"));
  dirs.push(dir);
  fs.mkdirSync(path.join(dir, ".aidlc-engine"), { recursive: true });
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("readPlan", () => {
  test("reads the resolved EXECUTE/SKIP slice in graph order", () => {
    const record = tempRecord();
    fs.writeFileSync(
      path.join(record, ".aidlc-engine", "plan.json"),
      JSON.stringify([
        { slug: "intent-capture", phase: "ideation", action: "EXECUTE" },
        { slug: "market-research", phase: "ideation", action: "SKIP" },
      ]),
    );

    const plan = readPlan(record);
    expect(plan?.map((row) => row.slug)).toEqual(["intent-capture", "market-research"]);
    expect(plan?.[1]?.action).toBe("SKIP");
  });

  test("unknown actions and shapeless rows are dropped", () => {
    const record = tempRecord();
    fs.writeFileSync(
      path.join(record, ".aidlc-engine", "plan.json"),
      JSON.stringify([{ slug: "kept", action: "EXECUTE" }, { slug: "bad", action: "MAYBE" }, null]),
    );
    expect(readPlan(record)?.map((row) => row.slug)).toEqual(["kept"]);
  });

  test("absent or malformed plan is absence, not an empty plan", () => {
    expect(readPlan(tempRecord())).toBeUndefined();
    const record = tempRecord();
    fs.writeFileSync(path.join(record, ".aidlc-engine", "plan.json"), "{");
    expect(readPlan(record)).toBeUndefined();
  });
});
