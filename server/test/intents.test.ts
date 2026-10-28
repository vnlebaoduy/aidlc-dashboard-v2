import { afterEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { listSpaces, readIntentRegistry } from "../scan/intents";

const dirs: string[] = [];

function tempWorkspace(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aidlc-intents-"));
  dirs.push(dir);
  return dir;
}

function writeRegistry(spaceDir: string, body: string): void {
  fs.mkdirSync(path.join(spaceDir, "intents"), { recursive: true });
  fs.writeFileSync(path.join(spaceDir, "intents", "intents.json"), body);
}

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("readIntentRegistry", () => {
  test("reads every row, and survives a BOM, comments and a trailing comma", () => {
    const workspace = tempWorkspace();
    const space = path.join(workspace, "aidlc", "spaces", "default");
    writeRegistry(
      space,
      `\uFEFF[
        // a hand edit added this note
        { "uuid": "0199-1", "slug": "inventory-api", "dirName": "260620-inventory-api",
          "scope": "mvp", "repos": ["api", "web"], "status": "complete" },
        { "slug": "export-bug", "dirName": "260624-export-bug", "status": "in-flight" },
      ]`,
    );

    const rows = readIntentRegistry(space);
    expect(rows).toHaveLength(2);
    expect(rows?.[0]?.dirName).toBe("260620-inventory-api");
    expect(rows?.[0]?.repos).toEqual(["api", "web"]);
    expect(rows?.[1]?.slug).toBe("export-bug");
    expect(rows?.[1]?.status).toBe("in-flight");
  });

  test("an unreadable list is absence, never invented rows", () => {
    const workspace = tempWorkspace();
    const space = path.join(workspace, "aidlc", "spaces", "default");
    writeRegistry(space, "{ this is not json");
    expect(readIntentRegistry(space)).toBeUndefined();
    expect(readIntentRegistry(path.join(workspace, "nowhere"))).toBeUndefined();
  });

  test("rows without a readable field are skipped", () => {
    const workspace = tempWorkspace();
    const space = path.join(workspace, "aidlc", "spaces", "default");
    writeRegistry(space, `[null, 42, { "slug": "kept" }]`);
    expect(readIntentRegistry(space)?.map((row) => row.slug)).toEqual(["kept"]);
  });
});

describe("listSpaces", () => {
  test("names every space directory, sorted", () => {
    const workspace = tempWorkspace();
    for (const name of ["payments-team", "default"]) {
      fs.mkdirSync(path.join(workspace, "aidlc", "spaces", name), { recursive: true });
    }
    expect(listSpaces(workspace)).toEqual(["default", "payments-team"]);
  });

  test("a workspace without spaces lists nothing", () => {
    expect(listSpaces(tempWorkspace())).toEqual([]);
  });
});
