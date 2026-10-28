// Kiro Crew app backend: the shared scan/model layer behind the Gateway's
// reverse proxy.
//
// The Gateway sets PORT and probes /health over unsigned loopback, so health must
// answer without touching disk. Everything else is read-only; the app keeps no
// Usage panel, so the usage slot is dropped from the payload rather than rendered
// empty.
//
// Several workspaces are supported. Their paths live in the app's own data dir
// (`projects.json`), are validated when added, and are re-checked on every read.
//
// Built by `bun run app:build` into backend/dist/server.js and committed, because
// the store installs from git and runs the file with plain node.

import * as fs from "node:fs";
import { type IncomingMessage, type ServerResponse, createServer } from "node:http";
import * as path from "node:path";
import { assemble } from "../../../../server/model/assemble";
import { artifactBase } from "../../../../server/scan/outcomes";
import { resolveState } from "../../../../server/scan/resolve";
import { readWorkspaceSummary } from "../../../../server/scan/summary";
import { readArtifactSource } from "../../../../server/scan/view-file";
import { type DecisionDraft, composeAnswer, validateDraft } from "./decisions";
import { type ProjectEntry, addProject, readProjects, removeProject } from "./projects";

const BASE = "/api/apps/aidlc-management-tool";
const PORT = Number(process.env.PORT ?? 0);
// The installed app root: <app>/backend/dist/server.js → ../..
// `import.meta.dir` is Bun-only; Node needs the file URL form.
const HERE = path.dirname(decodeURIComponent(new URL(import.meta.url).pathname));
const DATA_DIR = path.join(HERE, "..", "..", "data");
const ENV_ROOT = process.env.AIDLC_LEDGER_ROOT?.trim();

class Refusal extends Error {
  constructor(
    readonly code: "not-a-workspace" | "no-project" | "missing-param" | "no-run",
    readonly status: number,
  ) {
    super(code);
  }
}

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function isWorkspace(root: string): boolean {
  try {
    return fs.statSync(path.join(root, "aidlc")).isDirectory();
  } catch {
    return false;
  }
}

/** Registered projects, with the launch root (env) prepended when it is not stored. */
function projects(): ProjectEntry[] {
  const stored = readProjects(DATA_DIR).filter((project) => isWorkspace(project.root));
  if (ENV_ROOT) {
    const env = { root: path.resolve(ENV_ROOT), name: path.basename(path.resolve(ENV_ROOT)) };
    if (!stored.some((project) => project.root === env.root)) return [env, ...stored];
  }
  return stored;
}

function pickProject(wanted: string | null): ProjectEntry {
  const all = projects();
  if (all.length === 0) throw new Refusal("no-project", 409);
  if (!wanted) return all[0]!;
  const match = all.find((project) => project.root === wanted || project.name === wanted);
  if (!match) throw new Refusal("no-project", 404);
  if (!isWorkspace(match.root)) throw new Refusal("not-a-workspace", 400);
  return match;
}

function model(root: string): Record<string, unknown> {
  const assembled = assemble(root);
  // The app ships no Usage page; never send credit or token figures it cannot explain.
  const { usage, ...payload } = assembled;
  void usage;
  return payload;
}

function view(root: string, rel: string | null): unknown {
  if (!rel) throw new Refusal("missing-param", 400);
  const resolved = resolveState(root);
  if (resolved.kind !== "ok") throw new Refusal("no-run", 404);
  const recordDir = path.dirname(path.join(root, resolved.rel));
  return readArtifactSource(artifactBase(root, recordDir, rel), rel);
}

interface QueueRow {
  root: string;
  name: string;
  record?: string;
  pct?: number;
  phase?: string;
  blockers: { stage: string; unit?: string; heading: string; rel: string; waitingSec?: number }[];
  awaitingStage?: string;
  guardRefusals: number;
  warnings: number;
  findings: number;
  error?: string;
}

let queueCache: { at: number; rows: QueueRow[] } | undefined;

/** Everything waiting on a person across every project. Cached: assemble is not cheap. */
function queue(): QueueRow[] {
  const now = Date.now();
  if (queueCache && now - queueCache.at < 10_000) return queueCache.rows;
  const rows: QueueRow[] = [];
  for (const project of projects().slice(0, 12)) {
    try {
      const m = assemble(project.root);
      const blockers = m.blockers.slice(0, 5).map((b) => ({
        stage: b.stage,
        ...(b.unit ? { unit: b.unit } : {}),
        heading: b.heading,
        rel: b.rel,
        ...(b.waitingSec !== undefined ? { waitingSec: b.waitingSec } : {}),
      }));
      rows.push({
        root: project.root,
        name: project.name,
        record: m.identity.slug ?? m.identity.record,
        pct: m.state.overallPct,
        phase: m.state.lifecyclePhase,
        blockers,
        ...(m.gates.awaitingStage ? { awaitingStage: m.gates.awaitingStage } : {}),
        guardRefusals: (m.signals?.guardRefusals ?? []).filter((r) => r.pendingAsk).length,
        warnings: m.warnings.length,
        findings: (m.reviews ?? []).reduce((n, r) => n + (r.findings ?? 0), 0),
      });
    } catch (err) {
      rows.push({
        root: project.root,
        name: project.name,
        blockers: [],
        guardRefusals: 0,
        warnings: 0,
        findings: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  queueCache = { at: now, rows };
  return rows;
}

function draftOf(value: unknown): DecisionDraft | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const pick = (name: string): string | undefined => {
    if (!(name in value)) return undefined;
    const field = Reflect.get(value, name);
    return typeof field === "string" ? field : undefined;
  };
  const stage = pick("stage");
  const choice = pick("choice");
  if (!stage || (choice !== "approve" && choice !== "request-changes" && choice !== "answer")) {
    return undefined;
  }
  const unit = pick("unit");
  const feedback = pick("feedback");
  const answer = pick("answer");
  return {
    stage,
    choice,
    ...(unit ? { unit } : {}),
    ...(feedback ? { feedback } : {}),
    ...(answer ? { answer } : {}),
  };
}

function readBody(req: IncomingMessage): Promise<unknown> {
  const { promise, resolve } = Promise.withResolvers<unknown>();
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
    if (body.length > 256 * 1024) req.destroy();
  });
  req.on("end", () => {
    try {
      resolve(JSON.parse(body));
    } catch {
      resolve(undefined);
    }
  });
  req.on("error", () => resolve(undefined));
  return promise;
}

function fail(res: ServerResponse, err: unknown): void {
  if (err instanceof Refusal) {
    json(res, err.status, { error: { code: err.code } });
    return;
  }
  json(res, 500, {
    error: { code: "read-failed", message: err instanceof Error ? err.message : String(err) },
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (url.pathname === "/health") {
    json(res, 200, { ok: true });
    return;
  }
  const writeRoute =
    req.method === "POST" &&
    (url.pathname === `${BASE}/projects` || url.pathname === `${BASE}/decisions/preview`);
  if (!writeRoute && req.method !== "GET" && req.method !== "HEAD") {
    json(res, 405, { error: { code: "read-only" } });
    return;
  }

  try {
    if (url.pathname === `${BASE}/meta`) {
      json(res, 200, { app: "aidlc-management-tool", projects: projects().length });
      return;
    }

    if (url.pathname === `${BASE}/projects`) {
      if (req.method === "POST") {
        const body = await readBody(req);
        const root =
          typeof body === "object" &&
          body !== null &&
          "root" in body &&
          typeof body.root === "string"
            ? body.root.trim()
            : "";
        if (!root || !isWorkspace(root)) {
          json(res, 400, { error: { code: "not-a-workspace" } });
          return;
        }
        queueCache = undefined;
        json(res, 200, { projects: addProject(DATA_DIR, root) });
        return;
      }
      if (req.method === "DELETE") {
        const root = url.searchParams.get("root");
        if (root) removeProject(DATA_DIR, root);
        queueCache = undefined;
        json(res, 200, { projects: projects() });
        return;
      }
      const rows = projects().map((project) => ({
        ...project,
        summary: readWorkspaceSummary(project.root),
      }));
      json(res, 200, { projects: rows });
      return;
    }

    if (url.pathname === `${BASE}/queue`) {
      json(res, 200, { rows: queue() });
      return;
    }

    if (url.pathname === `${BASE}/model`) {
      const project = pickProject(url.searchParams.get("project"));
      json(res, 200, model(project.root));
      return;
    }

    if (url.pathname === `${BASE}/view`) {
      const project = pickProject(url.searchParams.get("project"));
      const result = view(project.root, url.searchParams.get("rel"));
      const ok =
        typeof result === "object" && result !== null && "ok" in result && result.ok === true;
      json(res, ok ? 200 : 400, result);
      return;
    }

    if (url.pathname === `${BASE}/decisions/preview` && req.method === "POST") {
      const body = await readBody(req);
      const draft =
        typeof body === "object" && body !== null && "draft" in body
          ? draftOf(body.draft)
          : draftOf(body);
      if (!draft) {
        json(res, 400, { error: { code: "invalid-decision" } });
        return;
      }
      json(res, 200, { text: composeAnswer(draft), problems: validateDraft(draft) });
      return;
    }

    json(res, 404, { error: { code: "not-found" } });
  } catch (err) {
    fail(res, err);
  }
});

server.listen(PORT, "127.0.0.1", () => {
  const address = server.address();
  const bound = address && typeof address === "object" ? address.port : PORT;
  console.log(
    `[aidlc-management-tool] backend on 127.0.0.1:${bound} projects=${projects().length}`,
  );
});
