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
import { listSlots, sendChat, slotForWorkspace } from "./chat";
import {
  type DecisionDraft,
  type SendRecord,
  beginSend,
  composeAnswer,
  markDelivered,
  markRefused,
  markUncertain,
  validateDraft,
} from "./decisions";

const BASE = "/api/apps/aidlc-ledger";
const PORT = Number(process.env.PORT ?? 0);
// The installed app root: <app>/backend/dist/server.js → ../..
// `import.meta.dir` is Bun-only; Node needs the file URL form.
const HERE = path.dirname(decodeURIComponent(new URL(import.meta.url).pathname));
const APP_ROOT = path.join(HERE, "..", "..");
const WORKSPACE_FILE = path.join(APP_ROOT, "data", "workspace.json");

function storedRoot(): string | undefined {
  try {
    const doc: unknown = JSON.parse(fs.readFileSync(WORKSPACE_FILE, "utf-8"));
    if (typeof doc !== "object" || doc === null || !("root" in doc)) return undefined;
    return typeof doc.root === "string" && doc.root.trim().length > 0 ? doc.root.trim() : undefined;
  } catch {
    return undefined;
  }
}

/** Send records for this process, keyed by sendId. */
const sends = new Map<string, SendRecord>();

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

async function readBody(req: import("node:http").IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
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
  });
}

/** Selected workspace: the env override wins, then the app's own data file. */
let ROOT = process.env.AIDLC_LEDGER_ROOT?.trim() || storedRoot();

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

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (url.pathname === "/health") {
    json(res, 200, { ok: true });
    return;
  }
  const writeRoute =
    req.method === "POST" &&
    (url.pathname === `${BASE}/workspace` ||
      url.pathname === `${BASE}/decisions/preview` ||
      url.pathname === `${BASE}/decisions/send`);
  if (!writeRoute && req.method !== "GET" && req.method !== "HEAD") {
    json(res, 405, { error: { code: "read-only" } });
    return;
  }
  if (url.pathname === `${BASE}/mapping`) {
    const slots = await listSlots();
    if (!slots) {
      json(res, 503, { error: { code: "no-gateway" } });
      return;
    }
    const slot = ROOT ? slotForWorkspace(slots, ROOT) : undefined;
    json(res, 200, {
      slot: slot ? { key: slot.key, title: slot.title ?? null } : null,
      count: slots.length,
    });
    return;
  }
  if (url.pathname === `${BASE}/decisions` && req.method === "GET") {
    json(res, 200, { records: [...sends.values()] });
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
  if (url.pathname === `${BASE}/decisions/send` && req.method === "POST") {
    const body = await readBody(req);
    if (typeof body !== "object" || body === null || !("draft" in body)) {
      json(res, 400, { error: { code: "invalid-decision" } });
      return;
    }
    const draft = draftOf(body.draft);
    if (!draft) {
      json(res, 400, { error: { code: "invalid-decision" } });
      return;
    }
    const problems = validateDraft(draft);
    if (problems.length > 0) {
      json(res, 400, { error: { code: "invalid-decision", problems } });
      return;
    }
    const text = composeAnswer(draft);
    const sendId =
      "sendId" in body && typeof body.sendId === "string" && body.sendId.length > 0
        ? body.sendId
        : crypto.randomUUID();
    const requestedSlot =
      "slot" in body && typeof body.slot === "string" && body.slot.length > 0
        ? body.slot
        : undefined;
    const started = beginSend(sends.get(sendId), { sendId, slotKey: "", text });
    if (!started.send) {
      json(res, 200, { record: started.record, replayed: true });
      return;
    }
    let slot = requestedSlot;
    if (!slot && ROOT) {
      const slots = await listSlots();
      slot = slots ? slotForWorkspace(slots, ROOT)?.key : undefined;
    }
    if (!slot) {
      const refused = markRefused(started.record, "no-session");
      sends.set(sendId, refused);
      json(res, 409, { error: { code: "no-session" }, record: refused });
      return;
    }
    const result = await sendChat({ message: text, slot, sendId });
    const keyed = { ...started.record, slotKey: slot };
    const record = result.ok
      ? markDelivered(keyed)
      : result.status !== undefined && result.status < 500
        ? markRefused(keyed, `gateway-${result.status}`)
        : markUncertain(keyed, result.detail ?? "unconfirmed");
    sends.set(sendId, record);
    json(res, result.ok ? 200 : 502, { record, text });
    return;
  }
  if (url.pathname === `${BASE}/workspace`) {
    if (req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
        if (body.length > 64 * 1024) req.destroy();
      });
      req.on("end", () => {
        try {
          const doc: unknown = JSON.parse(body);
          const root =
            typeof doc === "object" && doc !== null && "root" in doc && typeof doc.root === "string"
              ? doc.root.trim()
              : "";
          if (!root || !isWorkspace(root)) {
            json(res, 400, { error: { code: "not-a-workspace" } });
            return;
          }
          fs.mkdirSync(path.dirname(WORKSPACE_FILE), { recursive: true });
          fs.writeFileSync(WORKSPACE_FILE, `${JSON.stringify({ root }, null, 2)}\n`);
          ROOT = root;
          json(res, 200, { root });
        } catch {
          json(res, 400, { error: { code: "bad-request" } });
        }
      });
      return;
    }
    json(res, 200, { root: ROOT ?? null });
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
