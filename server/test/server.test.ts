// u4-host-integration wiring tests (Step 8).
//
// Covers the host↔credit seam that assemble/model tests cannot: the credit slot
// in `assemble`, the request handler's routing and the ONE write exception
// (manual refresh POST), the `?cw=` window thread, and the boot/shutdown
// lifecycle. No real kiro-cli and no real SQLite are touched — every dependency
// is an injected stub, and the one live server is bound to 127.0.0.1:0 (an
// ephemeral loopback port) purely to prove the binding and routing over HTTP.

import { beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { type Options, parseArgs } from "../cli";
import type { Pollable } from "../credit/pipeline/polling-scheduler";
import type { RefreshResult } from "../credit/pipeline/refresh-pipeline";
import type { CaptureSource, CreditSnapshot, ParsedUsage } from "../credit/types";
import type { CreditReadStore, CreditViewModel } from "../credit/view/credit-model";
import { type UsageContext, assemble } from "../model/assemble";
import type { DashboardModel } from "../model/types";
import { memoryRecents } from "../scan/recent-workspaces";
import type { WorkspaceDiscovery } from "../scan/workspaces";
import { type CreditRuntime, bootCredit, handle as handleWith, shutdownCredit } from "../server";

const FIXTURE = path.join(import.meta.dir, "..", "..", "fixtures", "reference");

/**
 * Every call here goes through a SYNTHETIC workspace discovery. The real one walks the
 * home directory, so a picker test used to list this machine's directories — and a
 * failing assertion prints them. `discovered` records that the stub is the path taken.
 */
const discovered: string[] = [];
const SYNTHETIC: WorkspaceDiscovery = {
  workspaces: [{ name: "reference", path: FIXTURE }],
  searchedRoots: ["/synthetic-home"],
  scannedDirectories: 1,
  truncated: false,
};
/** Opened-workspace memory, in memory: tests never write `data/recent-workspaces.json`. */
let recents = memoryRecents();
beforeEach(() => {
  recents = memoryRecents();
});
const handle = (req: Request, opts: Options, credit: CreditRuntime = {}) =>
  handleWith(req, opts, credit, {
    discover: () => {
      discovered.push(new URL(req.url).pathname);
      return SYNTHETIC;
    },
    recents,
  });
const OPTS: Options = parseArgs(["--root", FIXTURE]);

function usage(overrides: Partial<ParsedUsage> = {}): ParsedUsage {
  return {
    planName: "Pro",
    usedAmount: 120,
    remainingAmount: 380,
    planLimit: 500,
    usageRatio: 0.24,
    resetDate: "2026-09-01",
    partial: false,
    ...overrides,
  };
}

/** A success snapshot captured "now", so assembleCredit sees it as fresh (ok). */
function freshOkSnapshot(): CreditSnapshot {
  return {
    sequence: 1,
    capturedAt: new Date().toISOString(),
    source: "auto",
    ok: true,
    data: usage(),
  };
}

/** A read store stub returning the given snapshots. Never touches SQLite. */
function stubStore(snapshots: CreditSnapshot[]): CreditReadStore {
  return {
    readAll: () => snapshots,
    latest: () => (snapshots.length > 0 ? snapshots[snapshots.length - 1]! : null),
  };
}

/** A read store whose reads throw — drives the assemble degrade path (BR1.4). */
function throwingStore(): CreditReadStore {
  return {
    readAll: () => {
      throw new Error("store boom");
    },
    latest: () => {
      throw new Error("store boom");
    },
  };
}

/**
 * Narrow `model.usage` to the Kiro credit view. The reference fixture ships a
 * `.kiro` harness dir, so `auto` resolves to the credit panel — asserting the
 * discriminant here keeps that assumption honest instead of casting past it.
 */
function creditOf(m: DashboardModel): CreditViewModel {
  if (m.usage.kind !== "kiro")
    throw new Error(`expected the kiro usage panel, got ${m.usage.kind}`);
  return m.usage.credit;
}

// ── assemble usage slot (kiro side) ─────────────────────────────────────────

describe("assemble credit slot", () => {
  test("no usageCtx → status 'none' (existing callers unaffected)", () => {
    const m = assemble(FIXTURE);
    expect(creditOf(m).status).toBe("none");
    expect(creditOf(m).current).toBeNull();
    // The rest of the model still assembles.
    expect(m.identity.record).toBe("260101-demo-migration");
  });

  test("creditCtx with a fresh success snapshot → status reflects the store", () => {
    const ctx: UsageContext = { store: stubStore([freshOkSnapshot()]), window: "30d" };
    const m = assemble(FIXTURE, undefined, ctx);
    expect(creditOf(m).status).toBe("ok");
    expect(creditOf(m).current).not.toBeNull();
    expect(creditOf(m).current?.planName).toBe("Pro");
    expect(creditOf(m).trend.window).toBe("30d");
  });

  test("store throw → degrade to none + warning, rest of model intact (BR1.4)", () => {
    const ctx: UsageContext = { store: throwingStore(), window: "7d" };
    const m = assemble(FIXTURE, undefined, ctx);
    expect(creditOf(m).status).toBe("none");
    expect(creditOf(m).trend.window).toBe("7d"); // degrade preserves the asked window
    expect(m.warnings.some((w) => w.code === "credit-assembly-failed")).toBe(true);
    // Non-credit sections are unharmed.
    expect(m.state.overallPct).toBe(80);
  });

  test("the ?cw window is threaded into the assembled trend", () => {
    const ctx: UsageContext = { store: stubStore([freshOkSnapshot()]), window: "all" };
    expect(creditOf(assemble(FIXTURE, undefined, ctx)).trend.window).toBe("all");
  });
});

// ── request handler routing & the single write exception ─────────────────────

describe("handle routing", () => {
  const get = (p: string, credit?: CreditRuntime) =>
    handle(new Request(`http://127.0.0.1${p}`), OPTS, credit);

  // The loopback bind stops a remote socket, not a page in the user's own browser.
  // Both guards were added after all three of these succeeded against the handler.
  describe("browser-mediated request guards", () => {
    const refresh = (headers: Record<string, string>, pipeline?: Pollable) =>
      handle(new Request("http://127.0.0.1/api/refresh", { method: "POST", headers }), OPTS, {
        pipeline,
      });

    test("a non-loopback Host is refused on every route (DNS rebinding)", async () => {
      // A domain resolving to 127.0.0.1 is same-origin to the browser, so without this
      // an attacker's script could READ /api/model — paths, artifact names, questions.
      for (const p of ["/", "/api/model", "/api/meta", "/api/workspaces", "/healthz"]) {
        const res = await handle(
          new Request(`http://evil.example.com${p}`, {
            headers: { "sec-fetch-site": "same-origin" },
          }),
          OPTS,
        );
        expect(res.status).toBe(403);
        expect(await res.text()).toBe("bad host");
      }
    });

    test("--host admits exactly the bound IP, still refusing other names", async () => {
      const bound: Options = { ...OPTS, host: "100.98.204.106" };
      const at = (h: string, headers: Record<string, string> = {}) =>
        handle(new Request(`http://${h}/healthz`, { headers }), bound);
      expect((await at("100.98.204.106:4321")).status).toBe(200);
      expect((await at("127.0.0.1:4321")).status).toBe(200); // loopback keeps working
      expect((await at("evil.example.com:4321")).status).toBe(403);
      expect((await at("100.98.204.107:4321")).status).toBe(403);
      // Default options never admit that address.
      expect((await handle(new Request("http://100.98.204.106/healthz"), OPTS)).status).toBe(403);
      // A page served from the bound address may still POST to itself (Origin fallback).
      const post = await handle(
        new Request("http://100.98.204.106/api/refresh", {
          method: "POST",
          headers: { origin: "http://100.98.204.106:4321" },
        }),
        bound,
        {
          pipeline: {
            run: () =>
              Promise.resolve({ snapshot: freshOkSnapshot(), persisted: true } as RefreshResult),
          },
        },
      );
      expect(post.status).toBe(200);
    });

    test("--allow-host admits a forwarder's IP that the server never bound", async () => {
      // Windows portproxy: the browser's Host names the LAN IP, the socket is loopback.
      const fwd: Options = { ...OPTS, allowHosts: ["10.1.134.123"] };
      const at = (h: string) => handle(new Request(`http://${h}/healthz`), fwd);
      expect((await at("10.1.134.123:4321")).status).toBe(200);
      expect((await at("10.1.134.124:4321")).status).toBe(403);
      expect((await at("evil.example.com:4321")).status).toBe(403);
    });

    test("a wildcard bind admits any literal IP but still refuses names", async () => {
      // 0.0.0.0 answers on every interface, so the Host is whichever IP the reader typed.
      const all: Options = { ...OPTS, host: "0.0.0.0" };
      const at = (h: string) => handle(new Request(`http://${h}/healthz`), all);
      for (const ok of [
        "10.1.134.123:4321",
        "172.20.137.34:4321",
        "[fd00::1]:4321",
        "localhost:4321",
      ]) {
        expect((await at(ok)).status).toBe(200);
      }
      // DNS rebinding arrives as a NAME, which a wildcard bind must not widen to.
      for (const bad of ["evil.example.com:4321", "pc.corp.local:4321"]) {
        expect((await at(bad)).status).toBe(403);
      }
    });

    test("a cross-site caller cannot reach a state-changing route", async () => {
      const ran: CaptureSource[] = [];
      const pipeline: Pollable = {
        run: (s) => {
          ran.push(s);
          return Promise.resolve({ snapshot: freshOkSnapshot(), persisted: true } as RefreshResult);
        },
      };
      // `same-site` counts as cross-site here: a sibling port is somebody else's page.
      for (const site of ["cross-site", "same-site"]) {
        const res = await refresh({ "sec-fetch-site": site }, pipeline);
        expect(res.status).toBe(403);
      }
      const byOrigin = await refresh({ origin: "https://evil.example.com" }, pipeline);
      expect(byOrigin.status).toBe(403);
      // The point of the guard: the pipeline never ran, so no kiro-cli was spawned.
      expect(ran).toEqual([]);
    });

    test("the side-effecting GETs are guarded too, not just the POSTs", async () => {
      for (const p of ["/select?dir=/tmp", "/open?rel=x.md"]) {
        const res = await handle(
          new Request(`http://127.0.0.1${p}`, { headers: { "sec-fetch-site": "cross-site" } }),
          OPTS,
        );
        expect(res.status).toBe(403);
      }
    });

    test("same-origin, address bar, Origin-only and header-less callers all pass", async () => {
      const ran: CaptureSource[] = [];
      const pipeline: Pollable = {
        run: (s) => {
          ran.push(s);
          return Promise.resolve({ snapshot: freshOkSnapshot(), persisted: true } as RefreshResult);
        },
      };
      const allowed: Record<string, string>[] = [
        { "sec-fetch-site": "same-origin", origin: "http://127.0.0.1:4321" }, // our page
        { "sec-fetch-site": "none" }, // typed into the address bar
        { origin: "http://localhost:4321" }, // browser too old for Sec-Fetch-Site
        {}, // curl — not the threat model, must keep working
      ];
      for (const headers of allowed) {
        expect((await refresh(headers, pipeline)).status).toBe(200);
      }
      expect(ran.length).toBe(allowed.length);
    });
  });

  // `?lang=`/cookie/Accept-Language/--lang resolve the locale the client reads from
  // /api/meta; an explicit `?lang=` is persisted as a cookie on the HTML response.
  describe("page language", () => {
    const meta = async (query: string, headers: Record<string, string> = {}, opts = OPTS) =>
      (
        (await (
          await handle(new Request(`http://127.0.0.1/api/meta${query}`, { headers }), opts)
        ).json()) as {
          locale: string;
        }
      ).locale;

    test("the --lang default answers when the reader asks for nothing", async () => {
      expect(await meta("")).toBe("en");
      expect(await meta("", {}, { ...OPTS, locale: "vi" })).toBe("vi");
    });

    test("precedence: ?lang= > cookie > Accept-Language > --lang", async () => {
      const h = { cookie: "aidlc_lang=en", "accept-language": "vi" };
      expect(await meta("?lang=vi", h)).toBe("vi");
      expect(await meta("", h)).toBe("en");
      expect(await meta("", { "accept-language": "vi-VN,vi;q=0.9" })).toBe("vi");
    });

    test("?lang= is persisted on the HTML response only", async () => {
      const page = await handle(new Request("http://127.0.0.1/?lang=vi"), OPTS);
      if (page.status === 503) {
        // web/dist not built: no index to carry the cookie.
        expect(await page.json()).toEqual({ error: { code: "not-built" } });
      } else {
        expect(page.headers.get("content-type")).toContain("text/html");
        expect(page.headers.get("set-cookie")).toContain("aidlc_lang=vi");
        const plain = await handle(
          new Request("http://127.0.0.1/", { headers: { cookie: "aidlc_lang=vi" } }),
          OPTS,
        );
        expect(plain.headers.get("set-cookie")).toBeNull();
      }
      const api = await handle(new Request("http://127.0.0.1/api/meta?lang=vi"), OPTS);
      expect(api.headers.get("set-cookie")).toBeNull();
    });
  });

  test("non-GET/HEAD (POST/PUT/DELETE) on a normal path → 405 read-only", async () => {
    for (const method of ["POST", "PUT", "DELETE"]) {
      const res = await handle(new Request("http://127.0.0.1/api/model", { method }), OPTS);
      expect(res.status).toBe(405);
      expect(await res.text()).toBe("read-only");
    }
    // The v1 credit refresh route is gone: no second write path.
    expect(
      (await handle(new Request("http://127.0.0.1/api/credit/refresh", { method: "POST" }), OPTS))
        .status,
    ).toBe(405);
  });

  test("POST /api/refresh returns the refresh result as JSON", async () => {
    const calls: CaptureSource[] = [];
    let collecting = true;
    const pipeline: Pollable = {
      run: (source) => {
        calls.push(source);
        return Promise.resolve({ snapshot: freshOkSnapshot(), persisted: true } as RefreshResult);
      },
    };
    const res = await handle(
      new Request("http://127.0.0.1/api/refresh", { method: "POST" }),
      OPTS,
      {
        pipeline,
        isCollecting: () => collecting,
        markCollectionDone: () => {
          collecting = false;
        },
      },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(calls).toEqual(["manual"]);
    expect(collecting).toBe(false);
    expect((await res.json()) as RefreshResult).toMatchObject({ persisted: true });
  });

  test("GET /api/current exposes loading and GET /api/trend honors the window", async () => {
    const store = stubStore([]);
    const runtime: CreditRuntime = { store, isCollecting: () => true };
    const current = await get("/api/current", runtime);
    expect(current.status).toBe(200);
    expect(await current.json()).toMatchObject({
      state: "loading",
      status: "loading",
      freshness: { stale: false, lastSuccessAt: null },
    });

    const trend = await get("/api/trend?window=7d", runtime);
    expect(trend.status).toBe(200);
    expect(await trend.json()).toMatchObject({ window: "7d", points: [] });
  });

  test("credit JSON APIs return 503 when the subsystem is unavailable", async () => {
    expect((await get("/api/current")).status).toBe(503);
    expect((await get("/api/trend")).status).toBe(503);
    expect(
      (await handle(new Request("http://127.0.0.1/api/refresh", { method: "POST" }), OPTS)).status,
    ).toBe(503);
  });

  test("GET /api/browse serves the folder listing and explorer", async () => {
    const res = await get(`/api/browse?dir=${encodeURIComponent(FIXTURE)}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      listing: { dir: string };
      explorer: unknown;
      activeRoot: unknown;
    };
    expect(body.listing.dir).toBe(FIXTURE);
    expect(body.explorer).toBeDefined();
    expect("activeRoot" in body).toBe(true);
  });

  test("GET /api/workspaces lists through the discovery seam", async () => {
    const res = await get("/api/workspaces");
    expect(res.status).toBe(200);
    expect(discovered).toContain("/api/workspaces");
    expect(await res.json()).toHaveProperty("workspaces");
  });

  test("/select refuses a non-workspace back to the picker, accepts a workspace", async () => {
    const bad = await get(`/select?dir=${encodeURIComponent(os.tmpdir())}`);
    expect(bad.status).toBe(303);
    expect(bad.headers.get("location")).toContain("error=not-a-workspace");
    const ok = await get(`/select?dir=${encodeURIComponent(FIXTURE)}`);
    expect(ok.status).toBe(303);
    expect(ok.headers.get("location")).toBe("/");
  });

  test("?cw=7d threads the window through to the credit model", async () => {
    await get(`/select?dir=${encodeURIComponent(FIXTURE)}`);
    const res = await get("/api/model?cw=7d", { store: stubStore([]) });
    expect(await res.json()).toMatchObject({ usage: { credit: { trend: { window: "7d" } } } });
  });

  test("?cw invalid → 30d fallback in the credit model", async () => {
    await get(`/select?dir=${encodeURIComponent(FIXTURE)}`);
    const res = await get("/api/model?cw=bogus", { store: stubStore([]) });
    expect(await res.json()).toMatchObject({ usage: { credit: { trend: { window: "30d" } } } });
  });

  test("/api/model includes the wired credit model", async () => {
    await get(`/select?dir=${encodeURIComponent(FIXTURE)}`);
    const res = await get("/api/model", { store: stubStore([freshOkSnapshot()]) });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      usage: { kind: "kiro", credit: { status: "ok", current: { planName: "Pro" } } },
    });
  });

  test("the /open record-dir jail is preserved (traversal rejected)", async () => {
    await get(`/select?dir=${encodeURIComponent(FIXTURE)}`);
    const res = await get(`/open?rel=${encodeURIComponent("../../../../etc/passwd")}`);
    expect(res.status).toBe(403);
  });

  test("/api/summary answers for a validated workspace and leaves activeRoot alone", async () => {
    await get(`/select?dir=${encodeURIComponent(FIXTURE)}`);
    const res = await get(`/api/summary?dir=${encodeURIComponent(FIXTURE)}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      kind: "ok",
      progress: { source: "state.md" },
      blockers: { source: "disk" },
    });
    // Reading a workspace and SELECTING one are different acts. `/select` is the only
    // writer of the process's one mutable variable, and this must not become a second.
    expect(await (await get("/healthz")).json()).toMatchObject({ root: FIXTURE });
  });

  test("/api/summary refuses a path that is not a workspace", async () => {
    await get(`/select?dir=${encodeURIComponent(FIXTURE)}`);
    // A client string becomes a path only through resolveWorkspace, so an arbitrary dir
    // cannot make this read something that is not an AI-DLC tree.
    expect((await get(`/api/summary?dir=${encodeURIComponent(os.tmpdir())}`)).status).toBe(400);
    expect((await get("/api/summary")).status).toBe(400);
    // …and the refusal did not move the active root either.
    expect(await (await get("/healthz")).json()).toMatchObject({ root: FIXTURE });
  });

  test("/api/view returns the artifact source as JSON text", async () => {
    await get(`/select?dir=${encodeURIComponent(FIXTURE)}`);
    const rel = "ideation/intent-capture/memory.md";
    const res = await get(`/api/view?rel=${encodeURIComponent(rel)}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = (await res.json()) as { ok: boolean; source: { rel: string; text: string } };
    expect(body.ok).toBe(true);
    expect(body.source.rel).toBe(rel);
    expect(body.source.text.length).toBeGreaterThan(0);
  });

  test("/api/view shares the /open jail and reports the refusal facts", async () => {
    await get(`/select?dir=${encodeURIComponent(FIXTURE)}`);
    const res = await get(`/api/view?rel=${encodeURIComponent("../../../../etc/passwd")}`);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ ok: false, refusal: { code: "outside-record" } });
    const missing = await get(`/api/view?rel=${encodeURIComponent("nope.md")}`);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ refusal: { code: "not-found" } });
    expect((await get("/api/view")).status).toBe(400);
  });

  describe("opened workspaces are remembered", () => {
    // A workspace discovery cannot reach (too deep under home). Discovery here only ever
    // returns the fixture, exactly like a real home scan that stops above this path.
    const deep = fs.mkdtempSync(path.join(os.tmpdir(), "aidlc-deep-ws-"));
    fs.cpSync(FIXTURE, deep, { recursive: true });
    type Listing = {
      active: { path: string } | null;
      workspaces: { name: string; path: string; recent?: boolean }[];
    };
    const listed = async () => (await (await get("/api/workspaces")).json()) as Listing;

    test("a workspace opened by path stays listed after switching away", async () => {
      await get(`/select?dir=${encodeURIComponent(deep)}`);
      expect((await listed()).active?.path).toBe(deep);
      await get(`/select?dir=${encodeURIComponent(FIXTURE)}`);
      const after = await listed();
      expect(after.active?.path).toBe(FIXTURE);
      expect(after.workspaces).toContainEqual({
        name: path.basename(deep),
        path: deep,
        recent: true,
      });
    });

    test("the active workspace is never listed twice, recent or not", async () => {
      await get(`/select?dir=${encodeURIComponent(deep)}`);
      await get(`/select?dir=${encodeURIComponent(FIXTURE)}`);
      await get(`/select?dir=${encodeURIComponent(deep)}`);
      const now = await listed();
      expect(now.workspaces.filter((w) => w.path === deep)).toHaveLength(0);
      expect(now.workspaces.filter((w) => w.path === FIXTURE)).toEqual([
        { name: "reference", path: FIXTURE, recent: true },
      ]);
    });

    test("a refused /select is not remembered", async () => {
      await get(`/select?dir=${encodeURIComponent(os.tmpdir())}`);
      expect((await listed()).workspaces.some((w) => w.path === os.tmpdir())).toBe(false);
    });

    test("a remembered workspace that is gone drops out of the list", async () => {
      const gone = fs.mkdtempSync(path.join(os.tmpdir(), "aidlc-gone-ws-"));
      fs.cpSync(FIXTURE, gone, { recursive: true });
      await get(`/select?dir=${encodeURIComponent(gone)}`);
      await get(`/select?dir=${encodeURIComponent(FIXTURE)}`);
      fs.rmSync(gone, { recursive: true, force: true });
      expect((await listed()).workspaces.some((w) => w.path === gone)).toBe(false);
    });
  });
});

// ── boot & shutdown lifecycle ────────────────────────────────────────────────

describe("credit subsystem lifecycle", () => {
  test("bootCredit wires store→pipeline→scheduler and starts immediately", () => {
    const events: string[] = [];
    const sub = bootCredit({
      createStore: () => ({
        init: () => events.push("store.init"),
        latest: () => null,
        readAll: () => [],
        maxSequence: () => 0,
        append: () => {},
      }),
      createPipeline: () => ({
        init: () => events.push("pipeline.init"),
        run: () =>
          Promise.resolve({ snapshot: freshOkSnapshot(), persisted: true } as RefreshResult),
      }),
      createScheduler: () => ({
        start: (runImmediately: boolean) => events.push(`scheduler.start(${runImmediately})`),
        stop: () => events.push("scheduler.stop"),
      }),
    });
    expect(sub.degraded).toBe(false);
    expect(events).toEqual(["store.init", "pipeline.init", "scheduler.start(true)"]);
  });

  test("bootCredit passes the configured collection interval to the scheduler", () => {
    let receivedInterval: number | undefined;
    const sub = bootCredit({
      intervalMs: 12_345,
      createStore: () => ({
        init: () => {},
        latest: () => null,
        readAll: () => [],
        maxSequence: () => 0,
        append: () => {},
      }),
      createPipeline: () => ({
        init: () => {},
        run: () =>
          Promise.resolve({ snapshot: freshOkSnapshot(), persisted: true } as RefreshResult),
      }),
      createScheduler: (_pipeline, onSettled, intervalMs) => {
        receivedInterval = intervalMs;
        return {
          start: () => onSettled(),
          stop: () => {},
        };
      },
    });
    expect(receivedInterval).toBe(12_345);
    expect(sub.isCollecting()).toBe(false);
  });

  test("a boot init failure is isolated → degraded, no store, server still starts", () => {
    const sub = bootCredit({
      createStore: () => {
        throw new Error("sqlite open failed");
      },
    });
    expect(sub.degraded).toBe(true);
    expect(sub.store).toBeUndefined();
    expect(sub.pipeline).toBeUndefined();
    expect(sub.scheduler).toBeUndefined();
  });

  test("shutdownCredit stops the scheduler (SIGINT/SIGTERM path) and tolerates absence", () => {
    let stopped = 0;
    shutdownCredit({ stop: () => stopped++ });
    expect(stopped).toBe(1);
    expect(() => shutdownCredit(undefined)).not.toThrow();
  });

  test("shutdownCredit closes the store so the WAL is folded back in, and tolerates its absence", () => {
    let stopped = 0;
    let closed = 0;
    shutdownCredit({ stop: () => stopped++ }, () => {
      closed++;
    });
    expect(stopped).toBe(1);
    expect(closed).toBe(1);
    // A degraded boot has neither field.
    expect(() => shutdownCredit(undefined, undefined)).not.toThrow();
  });

  test("bootCredit exposes closeStore, which no-ops for a store that cannot be closed", () => {
    // The injected stub store has no close(); shutdown must not care.
    const sub = bootCredit({
      createStore: () => ({
        init: () => {},
        append: () => {},
        maxSequence: () => 0,
        latest: () => null,
        readAll: () => [],
      }),
      createPipeline: () => ({ init: () => {}, run: async () => ({}) as never }),
      createScheduler: () => ({ start: () => {}, stop: () => {} }),
    });
    expect(sub.degraded).toBe(false);
    expect(() => shutdownCredit(sub.scheduler, sub.closeStore)).not.toThrow();
  });
});

// ── loopback binding + routing over real HTTP ────────────────────────────────

describe("server binds loopback and routes over HTTP", () => {
  test("127.0.0.1:0 serves /healthz and rejects non-GET with 405", async () => {
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: (req) => handle(req, OPTS, {}),
    });
    try {
      expect(server.hostname).toBe("127.0.0.1");
      const base = `http://127.0.0.1:${server.port}`;

      const health = await fetch(`${base}/healthz`);
      expect(health.status).toBe(200);
      const healthBody = (await health.json()) as { ok: boolean };
      expect(healthBody.ok).toBe(true);

      const rejected = await fetch(`${base}/api/body`, { method: "DELETE" });
      expect(rejected.status).toBe(405);
    } finally {
      server.stop(true);
    }
  });
});
