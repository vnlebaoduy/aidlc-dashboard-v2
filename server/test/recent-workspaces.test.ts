// File-backed opened-workspace list (server/scan/recent-workspaces.ts): order, dedupe,
// cap, survival across a restart (a fresh store over the same file), and tolerance of a
// corrupt file.
import { afterAll, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileRecents } from "../scan/recent-workspaces";

const FIXTURE = path.join(import.meta.dir, "..", "..", "fixtures", "reference");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aidlc-recents-"));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

function ws(name: string): string {
  const dir = path.join(tmp, name);
  fs.cpSync(FIXTURE, dir, { recursive: true });
  return dir;
}

describe("recent workspaces file", () => {
  test("newest first, deduped, and kept across a restart", () => {
    const file = path.join(tmp, "a", "recent.json");
    const [a, b] = [ws("ws-a"), ws("ws-b")];
    const r = fileRecents(file);
    r.add(a);
    r.add(b);
    r.add(a);
    expect(r.list()).toEqual([a, b]);
    expect(fileRecents(file).list()).toEqual([a, b]);
  });

  test("keeps at most 20, dropping the oldest", () => {
    const file = path.join(tmp, "cap.json");
    const r = fileRecents(file);
    const dirs = Array.from({ length: 22 }, (_, i) => ws(`cap-${i}`));
    for (const d of dirs) r.add(d);
    const kept = r.list();
    expect(kept).toHaveLength(20);
    expect(kept[0]).toBe(dirs[21]);
    expect(kept).not.toContain(dirs[0]);
    expect(kept).not.toContain(dirs[1]);
  });

  test("a corrupt or foreign file reads as empty and is replaced on the next add", () => {
    const file = path.join(tmp, "bad.json");
    fs.writeFileSync(file, "{not json");
    const r = fileRecents(file);
    expect(r.list()).toEqual([]);
    fs.writeFileSync(file, JSON.stringify(["relative/path", 42, "/no/such/workspace"]));
    expect(r.list()).toEqual([]);
    const a = ws("after-bad");
    r.add(a);
    expect(r.list()).toEqual([a]);
  });
});
