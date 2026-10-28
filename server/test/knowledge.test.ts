import { afterEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { readKnowledge } from "../scan/knowledge";

const dirs: string[] = [];

function tempSpace(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aidlc-knowledge-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("readKnowledge", () => {
  test("summarises rules, documents, catalog states and code knowledge", () => {
    const space = tempSpace();
    fs.mkdirSync(path.join(space, "memory", "phases"), { recursive: true });
    fs.writeFileSync(path.join(space, "memory", "org.md"), "");
    fs.writeFileSync(path.join(space, "memory", "team.md"), "");
    fs.writeFileSync(path.join(space, "memory", "phases", "construction.md"), "");

    fs.mkdirSync(path.join(space, "knowledge", "documents", "srs"), { recursive: true });
    fs.writeFileSync(path.join(space, "knowledge", "documents", "srs", "a.md"), "");
    fs.writeFileSync(path.join(space, "knowledge", "documents", "b.pdf"), "");

    fs.mkdirSync(path.join(space, "knowledge", "documentkb"), { recursive: true });
    fs.writeFileSync(
      path.join(space, "knowledge", "documentkb", "index.json"),
      JSON.stringify({
        schema_version: 1,
        documents: [
          { id: "1", extraction: { state: "extracted" }, source: { kind: "managed" } },
          { id: "2", extraction: { state: "extracted" }, source: { kind: "managed" } },
          { id: "3", extraction: { state: "unsupported_type" }, source: { kind: "linked" } },
          {
            id: "4",
            extraction: { state: "extracted" },
            tombstone: true,
            source: { kind: "managed" },
          },
        ],
      }),
    );

    fs.mkdirSync(path.join(space, "codekb", "api"), { recursive: true });
    fs.mkdirSync(path.join(space, "codekb", "web"), { recursive: true });

    const k = readKnowledge(space);
    expect(k?.memoryFiles).toEqual(["org.md", "team.md"]);
    expect(k?.phaseRules).toBe(1);
    expect(k?.documentFiles).toBe(2);
    expect(k?.indexedDocuments).toBe(4);
    expect(k?.tombstones).toBe(1);
    expect(k?.linked).toBe(1);
    expect(k?.states).toEqual([
      { state: "extracted", count: 3 },
      { state: "unsupported_type", count: 1 },
    ]);
    expect(k?.codekbRepos).toEqual(["api", "web"]);
  });

  test("a broken catalog still reports the files it can see", () => {
    const space = tempSpace();
    fs.mkdirSync(path.join(space, "knowledge", "documents"), { recursive: true });
    fs.writeFileSync(path.join(space, "knowledge", "documents", "a.md"), "");
    fs.mkdirSync(path.join(space, "knowledge", "documentkb"), { recursive: true });
    fs.writeFileSync(path.join(space, "knowledge", "documentkb", "index.json"), "{");

    const k = readKnowledge(space);
    expect(k?.documentFiles).toBe(1);
    expect(k?.indexedDocuments).toBeUndefined();
  });

  test("an empty space has no knowledge to report", () => {
    expect(readKnowledge(tempSpace())).toBeUndefined();
  });
});
