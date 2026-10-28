import { afterEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { readEngineSignals } from "../scan/engine-signals";

const dirs: string[] = [];

function tempRecord(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aidlc-engine-signals-"));
  dirs.push(dir);
  fs.mkdirSync(path.join(dir, ".aidlc-engine"), { recursive: true });
  return dir;
}

function writeRefusal(record: string, file: string, body: unknown): void {
  const dir = path.join(record, ".aidlc-engine", "guard-refusals");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, file), JSON.stringify(body));
}

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("readEngineSignals", () => {
  test("the plane is absent when .aidlc-engine does not exist", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aidlc-no-engine-"));
    dirs.push(dir);
    expect(readEngineSignals(dir)).toBeUndefined();
  });

  test("reads a guard refusal streak, including the Unit and the left-over ask", () => {
    const record = tempRecord();
    writeRefusal(record, "abc.json", {
      version: 1,
      count: 3,
      codes: ["review-freeze", "no-remedy"],
      updatedAt: "2026-01-02T10:00:00Z",
      refusal: { stage: "functional-design", unit: "alpha", code: "review-freeze" },
      pendingAsk: { question: "Which way would you like to go on?" },
    });

    const signals = readEngineSignals(record);
    expect(signals?.guardRefusals).toHaveLength(1);
    const refusal = signals?.guardRefusals[0];
    expect(refusal?.stage).toBe("functional-design");
    expect(refusal?.unit).toBe("alpha");
    expect(refusal?.count).toBe(3);
    expect(refusal?.codes).toEqual(["review-freeze", "no-remedy"]);
    expect(refusal?.pendingAsk).toBe(true);
  });

  test("orders by repetition and marks an ask only when the engine left one", () => {
    const record = tempRecord();
    writeRefusal(record, "one.json", {
      count: 1,
      codes: ["review-freeze"],
      refusal: { stage: "build-and-test" },
    });
    writeRefusal(record, "two.json", {
      count: 4,
      codes: ["review-freeze"],
      refusal: { stage: "code-generation" },
    });

    const refusals = readEngineSignals(record)?.guardRefusals ?? [];
    expect(refusals.map((r) => r.stage)).toEqual(["code-generation", "build-and-test"]);
    expect(refusals[0]?.pendingAsk).toBe(false);
  });

  test("a malformed or stageless record is skipped, not counted as a refusal", () => {
    const record = tempRecord();
    writeRefusal(record, "bad.json", { count: 2 });
    fs.writeFileSync(path.join(record, ".aidlc-engine", "guard-refusals", "broken.json"), "{");

    // The engine markers are present, so the plane is readable but carries no refusal.
    fs.writeFileSync(path.join(record, ".aidlc-engine", "human-turn"), "");
    fs.writeFileSync(path.join(record, ".aidlc-engine", "engine-touch"), "");
    const signals = readEngineSignals(record);
    expect(signals?.guardRefusals).toEqual([]);
  });

  test("turn state follows the newer marker", () => {
    const record = tempRecord();
    const human = path.join(record, ".aidlc-engine", "human-turn");
    const engine = path.join(record, ".aidlc-engine", "engine-touch");
    fs.writeFileSync(engine, "");
    fs.writeFileSync(human, "");
    const now = Date.now() / 1000;
    fs.utimesSync(engine, now - 60, now - 60);
    fs.utimesSync(human, now, now);
    expect(readEngineSignals(record)?.turnState).toBe("conversational");

    fs.utimesSync(engine, now + 30, now + 30);
    expect(readEngineSignals(record)?.turnState).toBe("engine");
  });

  test("one marker alone does not claim a turn state", () => {
    const record = tempRecord();
    fs.writeFileSync(path.join(record, ".aidlc-engine", "human-turn"), "");
    // No refusals and no comparable markers: the plane holds nothing to report.
    expect(readEngineSignals(record)).toBeUndefined();
  });
});
