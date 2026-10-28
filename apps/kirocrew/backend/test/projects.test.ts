import { afterEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { addProject, readProjects, removeProject, writeProjects } from "../src/projects";

const dirs: string[] = [];

function tempData(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aidlc-projects-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("project registry", () => {
  test("adds a workspace with the folder name and keeps the newest first", () => {
    const data = tempData();
    addProject(data, "/work/alpha");
    addProject(data, "/work/beta");
    const projects = readProjects(data);
    expect(projects.map((p) => p.name)).toEqual(["beta", "alpha"]);
  });

  test("adding the same path again moves it to the front without duplicating", () => {
    const data = tempData();
    addProject(data, "/work/alpha");
    addProject(data, "/work/beta");
    addProject(data, "/work/alpha/");
    expect(readProjects(data).map((p) => p.root)).toEqual([
      path.resolve("/work/alpha"),
      path.resolve("/work/beta"),
    ]);
  });

  test("removing a project drops only that one", () => {
    const data = tempData();
    addProject(data, "/work/alpha");
    addProject(data, "/work/beta");
    expect(removeProject(data, "/work/alpha").map((p) => p.name)).toEqual(["beta"]);
  });

  test("the legacy single workspace file is read as a one-project list", () => {
    const data = tempData();
    fs.writeFileSync(path.join(data, "workspace.json"), JSON.stringify({ root: "/work/legacy" }));
    expect(readProjects(data)).toEqual([{ root: path.resolve("/work/legacy"), name: "legacy" }]);
  });

  test("a broken or empty list is no projects, not a crash", () => {
    const data = tempData();
    fs.writeFileSync(path.join(data, "projects.json"), "{");
    expect(readProjects(data)).toEqual([]);
    writeProjects(data, []);
    expect(readProjects(data)).toEqual([]);
  });
});
