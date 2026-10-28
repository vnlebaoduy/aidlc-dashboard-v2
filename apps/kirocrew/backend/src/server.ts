// Kiro Crew app backend: the shared scan/model layer behind the Gateway's
// reverse proxy.
//
// The Gateway sets PORT and probes /health over unsigned loopback, so health
// must answer without touching disk. Everything else is read-only; no usage
// (credit/token) panel exists in this app, so the usage slot is dropped from
// the payload rather than rendered empty.
//
// Built by `bun run app:build` into backend/dist/server.js and committed,
// because the store installs from git and runs the file with plain node.

import * as fs from "node:fs";
import { type ServerResponse, createServer } from "node:http";
import * as path from "node:path";
import { assemble } from "../../../../server/model/assemble";
import { artifactBase } from "../../../../server/scan/outcomes";
import { resolveState } from "../../../../server/scan/resolve";
import { readArtifactSource } from "../../../../server/scan/view-file";

const BASE = "/api/apps/aidlc-ledger";
const PORT = Number(process.env.PORT ?? 0);
const ROOT = process.env.AIDLC_LEDGER_ROOT?.trim() || undefined;

/** A refusal the client can act on, mapped to its HTTP status. */
class Refusal extends Error {
  constructor(
    readonly code: "no-workspace" | "not-a-workspace" | "missing-param" | "no-run",
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
    return fs.statSync(`${root}/aidlc`).isDirectory();
  } catch {
    return false;
  }
}

function model(): Record<string, unknown> {
  if (!ROOT) throw new Refusal("no-workspace", 409);
  if (!isWorkspace(ROOT)) throw new Refusal("not-a-workspace", 400);
  const assembled = assemble(ROOT);
  // The app ships no Usage page; never send credit or token figures it cannot explain.
  const { usage, ...payload } = assembled;
  void usage;
  return payload;
}

function view(rel: string | null): unknown {
  if (!ROOT) throw new Refusal("no-workspace", 409);
  if (!isWorkspace(ROOT)) throw new Refusal("not-a-workspace", 400);
  if (!rel) throw new Refusal("missing-param", 400);
  const resolved = resolveState(ROOT);
  if (resolved.kind !== "ok") throw new Refusal("no-run", 404);
  const recordDir = path.dirname(path.join(ROOT, resolved.rel));
  return readArtifactSource(artifactBase(ROOT, recordDir, rel), rel);
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (url.pathname === "/health") {
    json(res, 200, { ok: true });
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    json(res, 405, { error: { code: "read-only" } });
    return;
  }
  if (url.pathname === `${BASE}/meta`) {
    json(res, 200, { app: "aidlc-ledger", root: ROOT ?? null });
    return;
  }
  if (url.pathname === `${BASE}/view`) {
    try {
      const result = view(url.searchParams.get("rel"));
      const ok =
        typeof result === "object" && result !== null && "ok" in result && result.ok === true;
      const status =
        ok ||
        !(typeof result === "object" && result !== null && "status" in result) ||
        typeof result.status !== "number"
          ? ok
            ? 200
            : 400
          : result.status;
      json(res, status, result);
    } catch (err) {
      if (err instanceof Refusal) {
        json(res, err.status, { error: { code: err.code } });
        return;
      }
      json(res, 500, {
        error: { code: "read-failed", message: err instanceof Error ? err.message : String(err) },
      });
    }
    return;
  }
  if (url.pathname === `${BASE}/model`) {
    try {
      json(res, 200, model());
    } catch (err) {
      if (err instanceof Refusal) {
        json(res, err.status, { error: { code: err.code } });
        return;
      }
      json(res, 500, {
        error: {
          code: "read-failed",
          message: err instanceof Error ? err.message : String(err),
        },
      });
    }
    return;
  }
  json(res, 404, { error: { code: "not-found" } });
});

server.listen(PORT, "127.0.0.1", () => {
  const address = server.address();
  const bound = address && typeof address === "object" ? address.port : PORT;
  console.log(`[aidlc-ledger] backend on 127.0.0.1:${bound} root=${ROOT ?? "(none)"}`);
});
