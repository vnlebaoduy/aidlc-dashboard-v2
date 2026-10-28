import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { listSlots, sendChat, slotForWorkspace } from "../src/chat";

// A stub gateway: only the two routes the adapter uses, so the request shape and
// the mapping are proven without starting a real Crew session.
let server: { stop(force?: boolean): void; port: number } | undefined;
let origin = "";
const sent: unknown[] = [];
const authHeaders: string[] = [];
const home = fs.mkdtempSync(path.join(os.tmpdir(), "aidlc-chat-home-"));

beforeAll(() => {
  server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/api/apps/aidlc-ledger/token" && req.method === "POST") {
        return Response.json({ token: "test-token" });
      }
      if (url.pathname === "/api/chat/slots") {
        return Response.json([
          { key: "slot-a", title: "Demo", project: "/work/demo/", agent: "aidlc" },
          { key: "slot-b", title: "Nested", project: "/work/demo/sub" },
          { key: "slot-c", title: "Other", project: "/elsewhere" },
          { title: "no key" },
        ]);
      }
      if (url.pathname === "/api/chat" && req.method === "POST") {
        authHeaders.push(req.headers.get("cookie") ?? "");
        sent.push(await req.json());
        return new Response("event: message\ndata: {}\n\n", {
          headers: { "content-type": "text/event-stream" },
        });
      }
      return new Response("not found", { status: 404 });
    },
  });
  origin = `http://127.0.0.1:${server.port}`;
  process.env.AIDLC_LEDGER_CHAT_BASE = origin;
  fs.mkdirSync(path.join(home, "apps", "aidlc-ledger"), { recursive: true });
  fs.writeFileSync(path.join(home, "apps", "aidlc-ledger", ".app_secret"), "secret\n");
  process.env.KIROCREW_HOME = home;
});

afterAll(() => {
  server?.stop(true);
  delete process.env.AIDLC_LEDGER_CHAT_BASE;
  delete process.env.KIROCREW_HOME;
  fs.rmSync(home, { recursive: true, force: true });
});

describe("listSlots", () => {
  test("reads key, project and agent, skipping rows without a key", async () => {
    const slots = await listSlots();
    expect(slots?.map((s) => s.key)).toEqual(["slot-a", "slot-b", "slot-c"]);
    expect(slots?.[0]?.project).toBe("/work/demo/");
    expect(slots?.[0]?.agent).toBe("aidlc");
  });
});

describe("slotForWorkspace", () => {
  const slots = [
    { key: "exact", project: "/work/demo" },
    { key: "nested", project: "/work/demo/sub" },
    { key: "other", project: "/elsewhere" },
  ];

  test("prefers the workspace itself over a folder inside it", () => {
    expect(slotForWorkspace(slots, "/work/demo/")?.key).toBe("exact");
  });

  test("falls back to a folder inside the workspace", () => {
    expect(slotForWorkspace(slots, "/work")?.key).toBe("exact");
    expect(slotForWorkspace([{ key: "nested", project: "/work/demo/sub" }], "/work/demo")?.key).toBe(
      "nested",
    );
  });

  test("never maps a different project", () => {
    expect(slotForWorkspace(slots, "/home/me/other")).toBeUndefined();
  });
});

describe("sendChat", () => {
  test("posts the exact message, slot and sendId", async () => {
    const result = await sendChat({ message: "Approved.", slot: "slot-a", sendId: "s-1" });
    expect(result.ok).toBe(true);
    expect(sent.at(-1)).toEqual({
      message: "Approved.",
      slot: "slot-a",
      meta: { sendId: "s-1" },
    });
    expect(authHeaders.at(-1)).toContain("mc_token_");
    expect(authHeaders.at(-1)).toContain("test-token");
  });

  test("without a gateway origin it refuses instead of guessing", async () => {
    delete process.env.AIDLC_LEDGER_CHAT_BASE;
    const result = await sendChat({ message: "Approved.", slot: "a", sendId: "s-2" });
    expect(result.ok).toBe(false);
    expect(result.detail).toBe("no-gateway");
    process.env.AIDLC_LEDGER_CHAT_BASE = origin;
  });
});
