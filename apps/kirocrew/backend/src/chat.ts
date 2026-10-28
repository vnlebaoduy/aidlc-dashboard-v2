// Talking to the Kiro Crew gateway from the app backend.
//
// The backend learns the gateway's origin from `KIROCREW_GATEWAY_ORIGIN` (present
// only when the gateway bound a loopback address) and calls it over loopback, which
// the gateway trusts for mutating callbacks. A test or a different deployment can
// point `AIDLC_LEDGER_CHAT_BASE` at another origin.
//
// Two reads decide whether a decision can be delivered at all:
//   GET /api/chat/slots  each slot's `project` and `agent`
//   POST /api/chat       { message, slot, meta: { sendId } } — answers as SSE
//
// The mapping is deliberately strict: only a slot whose project is the workspace
// itself (or a folder inside it) may receive that workspace's decision.

import * as fs from "node:fs";
import * as path from "node:path";

export interface ChatSlot {
  key: string;
  title?: string;
  project?: string;
  agent?: string;
}

export interface SendResult {
  ok: boolean;
  status?: number;
  /** The slot the gateway used, when it reported one. */
  slot?: string;
  detail?: string;
}

function base(): string | undefined {
  const explicit = process.env.AIDLC_LEDGER_CHAT_BASE?.trim();
  if (explicit) return explicit;
  const origin = process.env.KIROCREW_GATEWAY_ORIGIN?.trim();
  return origin && origin.length > 0 ? origin : undefined;
}

let cachedToken: { origin: string; token: string } | undefined;

/** The app secret the gateway wrote at install (owner-only). */
function appSecret(): string | undefined {
  const home = process.env.KIROCREW_HOME?.trim();
  const name = process.env.KIROCREW_APP_NAME?.trim() || "aidlc-ledger";
  if (!home) return undefined;
  try {
    const secret = fs.readFileSync(path.join(home, "apps", name, ".app_secret"), "utf-8").trim();
    return secret.length > 0 ? secret : undefined;
  } catch {
    return undefined;
  }
}

/** Exchange the app secret for a gateway token. Cached per origin. */
async function tokenFor(origin: string): Promise<string | undefined> {
  if (cachedToken?.origin === origin) return cachedToken.token;
  const secret = appSecret();
  if (!secret) return undefined;
  const name = process.env.KIROCREW_APP_NAME?.trim() || "aidlc-ledger";
  try {
    const res = await fetch(`${origin}/api/apps/${encodeURIComponent(name)}/token`, {
      method: "POST",
      headers: { "x-app-secret": secret, "content-type": "application/json" },
    });
    if (!res.ok) return undefined;
    const body: unknown = await res.json();
    const token =
      typeof body === "object" && body !== null && "token" in body && typeof body.token === "string"
        ? body.token
        : undefined;
    if (!token) return undefined;
    cachedToken = { origin, token };
    return token;
  } catch {
    return undefined;
  }
}

/** Cookie name the gateway reads, keyed by the port in its URL. */
function cookieFor(origin: string, token: string): string {
  try {
    const port = new URL(origin).port || "80";
    return `mc_token_${port}=${token}`;
  } catch {
    return `mc_token_5476=${token}`;
  }
}

async function authHeaders(origin: string): Promise<Record<string, string> | undefined> {
  const token = await tokenFor(origin);
  return token ? { cookie: cookieFor(origin, token) } : undefined;
}

function slotOf(value: unknown): ChatSlot | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const key = "key" in value && typeof value.key === "string" ? value.key : undefined;
  if (!key) return undefined;
  const text = (name: string): string | undefined => {
    if (!(name in value)) return undefined;
    const field = Reflect.get(value, name);
    return typeof field === "string" && field.length > 0 ? field : undefined;
  };
  const title = text("title");
  const project = text("project");
  const agent = text("agent");
  return {
    key,
    ...(title ? { title } : {}),
    ...(project ? { project } : {}),
    ...(agent ? { agent } : {}),
  };
}

/** Every chat slot the gateway knows, or undefined when the gateway is unreachable. */
export async function listSlots(): Promise<ChatSlot[] | undefined> {
  const origin = base();
  if (!origin) return undefined;
  try {
    const auth = await authHeaders(origin);
    if (!auth) return undefined;
    const res = await fetch(`${origin}/api/chat/slots`, {
      headers: { accept: "application/json", ...auth },
    });
    if (!res.ok) return undefined;
    const body: unknown = await res.json();
    const rows = Array.isArray(body)
      ? body
      : typeof body === "object" && body !== null && "slots" in body && Array.isArray(body.slots)
        ? body.slots
        : undefined;
    if (!rows) return undefined;
    return rows.map(slotOf).filter((slot): slot is ChatSlot => slot !== undefined);
  } catch {
    return undefined;
  }
}

/** The slot bound to this workspace: exact project first, then a folder inside it. */
export function slotForWorkspace(slots: ChatSlot[], root: string): ChatSlot | undefined {
  const normalise = (value: string) => value.replace(/\/+$/, "");
  const wanted = normalise(root);
  const exact = slots.find(
    (slot) => slot.project !== undefined && normalise(slot.project) === wanted,
  );
  if (exact) return exact;
  return slots.find(
    (slot) => slot.project !== undefined && normalise(slot.project).startsWith(`${wanted}/`),
  );
}

/** Send one message into a slot. Delivery only; it proves nothing about the engine. */
export async function sendChat(input: {
  message: string;
  slot: string;
  sendId: string;
}): Promise<SendResult> {
  const origin = base();
  if (!origin) return { ok: false, detail: "no-gateway" };
  try {
    const auth = await authHeaders(origin);
    if (!auth) return { ok: false, detail: "no-app-token" };
    const res = await fetch(`${origin}/api/chat`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "text/event-stream, application/json",
        ...auth,
      },
      body: JSON.stringify({
        message: input.message,
        slot: input.slot,
        meta: { sendId: input.sendId },
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, status: res.status, detail: text.slice(0, 300) || "refused" };
    }
    // The gateway streams the turn; we only need the send accepted, not the reply.
    await res.body?.cancel().catch(() => undefined);
    return { ok: true, status: res.status, slot: input.slot };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}
