// HTTP entry point.
//
// Every request re-reads the workspace. That is deliberate: the whole read costs
// ~10ms on one real run (4,228 audit blocks across 2 shards) and ~87ms on a bigger
// one (4,604 blocks over 3 shards, 326 files), so caching would only add a
// staleness window to a dashboard whose entire purpose is not being stale.
//
// The selected workspace lives in ONE mutable variable here. That is the only
// mutable state in the process, and it is the price of letting the user pick a
// folder in the browser instead of restarting with a different --root. It holds a
// path the server validated itself (see /select), never a raw client string.
//
// Read-only with respect to the workspace: no route writes to it.

import * as fs from "node:fs";
import { isIP } from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import type { ApiError } from "./api-types";
import { HOST, type Options, USAGE, UsageError, expandHome, parseArgs } from "./cli";
import { createMemo } from "./credit/claude/transcript-reader";
import { type AcpSessionRef, collectUsageViaAcp } from "./credit/collector/acp-collector";
import type { ParseResult } from "./credit/parser/usage-parser";
import {
  type PollHalt,
  type Pollable,
  PollingScheduler,
} from "./credit/pipeline/polling-scheduler";
import { type PipelineStore, RefreshPipeline } from "./credit/pipeline/refresh-pipeline";
import { SnapshotStore } from "./credit/storage/snapshot-store";
import { type CreditReadStore, assembleCredit, resolveWindow } from "./credit/view/credit-model";
import { DEFAULT_LOCALE, localeCookie, localeFromQuery, resolveLocale } from "./i18n/locale";
import { serverStrings as strings } from "./i18n/messages";
import { NoRunError, type UsageContext, assemble } from "./model/assemble";
import type { Locale } from "./model/types";
import { browse, resolveWorkspace, workspaceKey } from "./scan/browse";
import { buildExplorer } from "./scan/explorer";
import { openArtifact } from "./scan/open-file";
import { artifactBase } from "./scan/outcomes";
import { type RecentWorkspaces, fileRecents } from "./scan/recent-workspaces";
import { resolveState } from "./scan/resolve";
import { readWorkspaceSummary } from "./scan/summary";
import { readArtifactSource } from "./scan/view-file";
import {
  type DiscoveryOptions,
  type WorkspaceDiscovery,
  type WorkspaceMatch,
  discoverWorkspaces,
} from "./scan/workspaces";
import { VERSION } from "./version";

/**
 * Routes that change something, so a cross-site caller must not reach them. Two are
 * GETs on purpose — the browser cannot POST from an `<a>` — and both have side
 * effects: `/select` moves `activeRoot`, `/open` launches an OS process.
 */
const STATE_CHANGING: Record<string, true> = {
  "/api/refresh": true,
  "/select": true,
  "/open": true,
};

/** Built client (`bun run build`). Served only through `handle`, behind the Host guard. */
const WEB_DIST = path.join(import.meta.dir, "..", "web", "dist");

const MIME: Record<string, string> = {
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
};

/**
 * CSP for the client. Everything it runs is the bundled JS; `style-src 'unsafe-inline'`
 * covers React `style` props (bar widths, chart geometry).
 */
const SHELL_CSP =
  "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";

/** `0.0.0.0` / `::` — one listener on every interface, loopback included. */
function isWildcard(host: string): boolean {
  return host === "0.0.0.0" || host === "::";
}

/**
 * Loopback in the forms a Host or Origin header actually arrives in, plus the address
 * `--host` bound and every `--allow-host`; with a wildcard bind, any literal IP. Only
 * IPs are ever added — never a name — so DNS rebinding stays closed: an attacker's
 * domain arrives as its NAME in `Host`, and a name is what is refused.
 */
function isAllowedHost(hostname: string, opts: Options): boolean {
  const h = hostname.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
  if (h === "localhost") return true;
  if (isWildcard(opts.host)) return isIP(h) !== 0;
  if (h === opts.host.toLowerCase()) return true;
  if (opts.allowHosts.some((a) => a.toLowerCase() === h)) return true;
  if (h === "::1" || h === "0:0:0:0:0:0:0:1") return true;
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h);
}

/**
 * True when the request came from a page on some OTHER origin.
 *
 * `Sec-Fetch-Site` is the answer when the browser sends it (every current one does):
 * `same-origin` is our own page, `none` is the address bar. Anything else — including
 * `same-site`, which a sibling port is — is somebody else's page. `Origin` is the
 * fallback for an older browser.
 *
 * NEITHER header means NOT A BROWSER. curl and the test suite send no `Sec-Fetch-Site`
 * and no `Origin`, they are not the threat this guards against, and they must keep
 * working — CSRF is a browser-mediated attack by definition.
 */
function crossSiteRequest(req: Request, opts: Options): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site !== null) return site !== "same-origin" && site !== "none";
  const origin = req.headers.get("origin");
  if (origin === null) return false;
  try {
    return !isAllowedHost(new URL(origin).hostname, opts);
  } catch {
    return true; // unparseable Origin is not something to give the benefit of the doubt
  }
}

/**
 * A file from the built client. `/assets/*` names are content-hashed by Vite, so they
 * cache forever; everything else (index.html) is revalidated. The path is resolved and
 * must stay inside `web/dist` — a `..` in the URL never reaches the filesystem outside it.
 */
async function staticFile(pathname: string, setCookie?: string): Promise<Response | undefined> {
  const rel = pathname === "/" ? "index.html" : pathname.slice(1);
  const abs = path.resolve(WEB_DIST, rel);
  if (abs !== WEB_DIST && !abs.startsWith(WEB_DIST + path.sep)) return undefined;
  const file = Bun.file(abs);
  if (!(await file.exists())) return undefined;
  const isHtml = abs.endsWith(".html");
  const headers: Record<string, string> = {
    "content-type": isHtml
      ? "text/html; charset=utf-8"
      : (MIME[path.extname(abs)] ?? "application/octet-stream"),
    "cache-control": pathname.startsWith("/assets/")
      ? "public, max-age=31536000, immutable"
      : "no-cache",
    "x-content-type-options": "nosniff",
  };
  if (isHtml) {
    headers["content-security-policy"] = SHELL_CSP;
    if (setCookie !== undefined) headers["set-cookie"] = setCookie;
  }
  return new Response(file, { headers });
}

/**
 * The record dir of the active intent, without assembling the whole model.
 *
 * `/open` and `/view` need exactly one field — the jail root — and reaching it through
 * `assemble` was expensive in a way that did not show: on a `.claude` tree `assemble`
 * reads the transcripts whether or not a `UsageContext` was passed, and the bare call
 * `/open` used carried no memo, so every artifact click paid a COLD transcript read
 * (measured worst case in transcript-reader.ts's header: 268ms for a 30-day window).
 * `resolveState` is a handful of `readFileSync`/`existsSync` calls and answers the same
 * question — it is the same function `assemble` itself starts from.
 *
 * Carries the resolve KIND on failure rather than `undefined`: `none` and `ambiguous` are
 * different sentences (`NoRunError` keeps them apart for exactly that reason), and the
 * caller has no way to recover the distinction once it is flattened.
 */
type RecordDirResult = { ok: true; recordDir: string } | { ok: false; kind: "none" | "ambiguous" };

function activeRecordDir(root: string): RecordDirResult {
  const resolved = resolveState(root);
  if (resolved.kind !== "ok") return { ok: false, kind: resolved.kind };
  return { ok: true, recordDir: path.dirname(path.join(root, resolved.rel)) };
}

function json(value: unknown, status = 200): Response {
  // Map is not JSON-serialisable; the scan layer uses it for per-stage tallies,
  // so convert on the way out rather than distorting the internal types.
  const body = JSON.stringify(value, (_k, v) => (v instanceof Map ? Object.fromEntries(v) : v));
  return new Response(body, {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function redirect(location: string): Response {
  return new Response(null, { status: 303, headers: { location } });
}

export type { ApiError };

function apiError(error: ApiError, status: number): Response {
  return json({ error }, status);
}

/** The workspace currently being shown. Mutated only by /select (and --root at startup). */
let activeRoot: string | undefined;

/** Workspaces opened before, so a switch away does not drop one discovery cannot reach. */
const defaultRecents = fileRecents();

/**
 * Per-file memo for the Claude transcript reader, held for the process lifetime.
 *
 * This is NOT a second piece of mutable state in the sense `activeRoot` is: its
 * keys are `(path, size, mtimeMs)`, so it cannot answer differently from a cold
 * read of the same files. Claude Code transcripts are append-only, which means an
 * edit always moves size and mtime and therefore always misses the memo. It buys
 * back the cost of re-parsing unchanged transcripts on every 60s poll (measured:
 * 410ms for a 217MB 30-day window) without introducing a staleness window.
 */
const transcriptMemo = createMemo();

/**
 * The credit subsystem the request handler sees. Both fields are optional: when
 * the subsystem failed to boot the dashboard still serves everything else, and
 * the credit slot degrades to a `none` view (NFR1.5). `store` is read by
 * `assemble` (u1 read contract); `pipeline` is triggered by the manual refresh
 * POST (u2 run contract). Injected explicitly so `handle` stays testable.
 */
export interface CreditRuntime {
  store?: CreditReadStore;
  pipeline?: Pollable;
  /**
   * Why automatic collection stopped, or null while it is running. Read on every render
   * so the panel can say "the timer is off, and here is what it last saw" rather than
   * leaving a stale figure to look like a live one.
   *
   * Optional like the other fields here: a test injects the seams it needs.
   */
  pollHalt?: () => PollHalt | null;
  /** Restart a halted timer. Called after a MANUAL refresh succeeds — the path back to
   *  automatic collection when upstream recovers, with no process restart. */
  resumePolling?: () => void;
  isCollecting?: () => boolean;
  markCollectionDone?: () => void;
}

/** Seams for tests. Every route that lists workspaces (/pick, /browse, a refused
 *  /select, the no-root landing page, /api/workspaces) walks the home directory, and a
 *  test that let it would print this machine's directory names on failure. Production
 *  passes nothing. */
export interface HandleDeps {
  discover?: (o: DiscoveryOptions) => WorkspaceDiscovery;
  recents?: RecentWorkspaces;
}

export async function handle(
  req: Request,
  opts: Options,
  credit: CreditRuntime = {},
  deps: HandleDeps = {},
): Promise<Response> {
  const url = new URL(req.url);
  const discover = deps.discover ?? discoverWorkspaces;
  const recents = deps.recents ?? defaultRecents;

  // ---- browser-mediated request guards -------------------------------------
  //
  // The loopback BIND stops a remote socket. It does not stop a page already open in
  // the user's own browser from reaching this server:
  //
  //   HOST — DNS rebinding. A domain that resolves to 127.0.0.1 is SAME-ORIGIN to the
  //     browser, so its script could read `/api/model`. Answering only to a loopback
  //     (or explicitly admitted) Host closes it.
  //   ORIGIN — CSRF. A cross-site page could fire `/api/refresh` (spawns kiro-cli), GET
  //     `/select` (moves activeRoot) or GET `/open` (launches an editor).
  //
  // The Host check covers every route, static files included; the Origin check only the
  // state-changing ones.
  if (!isAllowedHost(url.hostname, opts)) {
    return new Response("bad host", { status: 403 });
  }
  if (STATE_CHANGING[url.pathname] && crossSiteRequest(req, opts)) {
    return new Response("cross-site request refused", { status: 403 });
  }

  if (url.pathname === "/api/refresh") {
    if (req.method !== "POST") return new Response("read-only", { status: 405 });
    if (!credit.pipeline) return apiError({ code: "credit-unavailable" }, 503);
    try {
      const result = await credit.pipeline.run("manual");
      // A manual success is the path back: automatic collection slows itself after N
      // consecutive failures (see polling-scheduler), and this clears that immediately.
      // `persisted` is part of "success" — the page reads STORED snapshots, so a collection
      // that could not be written has not refreshed anything and must not clear the backoff.
      if (result.snapshot.ok && result.persisted) credit.resumePolling?.();
      return json(result);
    } catch (err) {
      return json(
        {
          error: { code: "read-failed", message: err instanceof Error ? err.message : String(err) },
        },
        500,
      );
    } finally {
      credit.markCollectionDone?.();
    }
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("read-only", { status: 405 });
  }

  const showHidden = url.searchParams.get("hidden") === "1";

  // Per request, never stored on the server — `activeRoot` is the one mutable thing in
  // this process and a language is not workspace state. An explicit `?lang=` gets a
  // cookie so it survives the next navigation.
  const langParam = url.searchParams.get("lang");
  const locale = resolveLocale({
    query: langParam,
    cookie: req.headers.get("cookie"),
    acceptLanguage: req.headers.get("accept-language"),
    fallback: opts.locale,
  });
  const stickyLocale = localeFromQuery(langParam) !== undefined ? localeCookie(locale) : undefined;

  try {
    // Usage context: the Kiro store (when wired) plus the sanitised trend window from
    // `?cw=` (invalid/absent → 30d). Built INSIDE the try: `credit.isCollecting` is
    // injected, so a throw here lands on the JSON error rather than Bun's default 500.
    const usageCtx: UsageContext = {
      store: credit.store,
      window: resolveWindow(url.searchParams.get("cw")),
      collecting: credit.isCollecting?.() ?? false,
      pollHalt: credit.pollHalt?.() ?? null,
      mode: opts.usageMode,
      memo: transcriptMemo,
    };

    switch (url.pathname) {
      // ---- what the client needs before anything else -------------------------
      case "/api/meta":
        return json({
          version: VERSION,
          pollMs: opts.pollMs,
          locale,
          activeRoot: activeRoot ?? null,
        });

      // ---- the active run -----------------------------------------------------
      case "/api/model": {
        if (!activeRoot) return apiError({ code: "no-workspace" }, 409);
        return json(assemble(activeRoot, opts.harnessDir, usageCtx));
      }

      // ---- folder picker ------------------------------------------------------
      // One directory listing plus the explorer roots/breadcrumbs. Discovery is a
      // separate call: it can walk thousands of directories, and the listing must
      // paint without waiting for it.
      case "/api/browse": {
        // Default to the parent of the active workspace so the picker opens
        // somewhere useful rather than at the home dir every time.
        const dirParam = url.searchParams.get("dir");
        const fallback = activeRoot ? path.dirname(activeRoot) : os.homedir();
        const dir = dirParam ? expandHome(dirParam) : expandHome(fallback);
        const listing = browse(dir, showHidden);
        return json({
          listing,
          explorer: buildExplorer(listing.dir, { activeRoot }),
          activeRoot: activeRoot ?? null,
        });
      }

      // Every workspace discovery can find, plus every one opened before: discovery's
      // walk is bounded, so a deep path opened by hand would otherwise vanish on the
      // next switch. Identity is `workspaceKey`, so a symlinked spelling is not listed
      // twice, and the active workspace is returned apart (the switcher names it).
      case "/api/workspaces": {
        const d = discover({ launchDir: opts.launchDir });
        const byKey = new Map<string, WorkspaceMatch>(
          d.workspaces.map((w) => [workspaceKey(w.path), w]),
        );
        for (const p of recents.list()) {
          const k = workspaceKey(p);
          byKey.set(k, { ...(byKey.get(k) ?? { name: path.basename(p), path: p }), recent: true });
        }
        const key = activeRoot ? workspaceKey(activeRoot) : undefined;
        const current = key === undefined ? undefined : byKey.get(key);
        if (key !== undefined) byKey.delete(key);
        const active = activeRoot
          ? { path: activeRoot, name: current?.name ?? path.basename(activeRoot) }
          : null;
        return json({ ...d, workspaces: [...byKey.values()], active });
      }

      // One workspace's headline numbers, for the picker's cards. `dir` is a CLIENT
      // STRING: it becomes a path only through `resolveWorkspace`, the same validator
      // `/select` uses, and it never touches `activeRoot` — reading a workspace and
      // selecting one are different acts. Deliberately NOT `assemble` (5–16x cheaper).
      case "/api/summary": {
        const raw = url.searchParams.get("dir");
        if (!raw) return apiError({ code: "missing-param", param: "dir" }, 400);
        const picked = resolveWorkspace(expandHome(raw));
        if (!picked) return apiError({ code: "not-a-workspace", dir: raw }, 400);
        return json(readWorkspaceSummary(picked));
      }

      // A GET so a plain link can select. Validate on the SERVER: accept only a path
      // that really is a workspace (or the `aidlc/` dir inside one). A refusal goes back
      // to the picker with the facts in the query; the client words it.
      case "/select": {
        const raw = url.searchParams.get("dir");
        if (!raw) return redirect("/pick");
        const picked = resolveWorkspace(expandHome(raw));
        if (!picked) {
          const q = new URLSearchParams({ dir: expandHome(raw), error: "not-a-workspace" });
          return redirect(`/pick?${q}`);
        }
        activeRoot = picked;
        recents.add(picked);
        return redirect("/");
      }

      // ---- artifacts ----------------------------------------------------------
      // Source text for the in-app viewer. Read-only, so NOT in STATE_CHANGING. `rel`
      // goes through the same jail as `/open`. The text is hostile input; the client
      // renders it as a text node, never markup.
      case "/api/view": {
        if (!activeRoot) return apiError({ code: "no-workspace" }, 409);
        const rel = url.searchParams.get("rel");
        if (!rel) return apiError({ code: "missing-param", param: "rel" }, 400);
        const record = activeRecordDir(activeRoot);
        if (!record.ok) throw new NoRunError(record.kind, activeRoot);
        const result = readArtifactSource(artifactBase(activeRoot, record.recordDir, rel), rel);
        return json(result, result.ok ? 200 : result.status);
      }

      // Open an artifact in the OS editor. The browser cannot launch a local app; this
      // server can, because the user started it. `rel` is jailed before anything spawns.
      case "/open": {
        if (!activeRoot) return apiError({ code: "no-workspace" }, 409);
        const rel = url.searchParams.get("rel");
        if (!rel) return apiError({ code: "missing-param", param: "rel" }, 400);
        const record = activeRecordDir(activeRoot);
        if (!record.ok) throw new NoRunError(record.kind, activeRoot);
        const res = openArtifact(
          artifactBase(activeRoot, record.recordDir, rel),
          rel,
          strings(opts.locale),
        );
        // The refusal FACTS, not a sentence: the client words them in its language.
        if (!res.ok) return json({ refusal: res.refusal, rel }, res.status);
        // 204: the editor opened, so the page must NOT navigate away.
        return new Response(null, { status: 204 });
      }

      // ---- credit (JSON consumers) --------------------------------------------
      case "/api/current": {
        if (!credit.store) return apiError({ code: "credit-unavailable" }, 503);
        const model = assembleCredit(
          credit.store,
          new Date(),
          "30d",
          credit.isCollecting?.() ?? false,
          credit.pollHalt?.() ?? null,
        );
        const state =
          model.status === "loading"
            ? "loading"
            : model.current !== null || model.warning !== null
              ? "populated"
              : "empty";
        return json({
          state,
          status: model.status,
          current: model.current,
          warning: model.warning,
          freshness: model.freshness,
          pollHalt: model.pollHalt,
        });
      }

      case "/api/trend": {
        if (!credit.store) return apiError({ code: "credit-unavailable" }, 503);
        const window = resolveWindow(url.searchParams.get("window"));
        return json(assembleCredit(credit.store, new Date(), window).trend);
      }

      case "/healthz":
        return json({ ok: true, root: activeRoot ?? null });
    }

    if (url.pathname.startsWith("/api/"))
      return apiError({ code: "missing-param", param: "route" }, 404);

    // ---- the client ---------------------------------------------------------
    // A real file from web/dist, else index.html for any client route (deep links).
    const own = await staticFile(url.pathname, stickyLocale);
    if (own) return own;
    // A missing asset is a 404, not the app shell: a stale tab asking for an old hashed
    // bundle must fail loudly rather than parse HTML as JavaScript.
    if (url.pathname.startsWith("/assets/") || path.extname(url.pathname) !== "") {
      return new Response("not found", { status: 404 });
    }
    const file = await staticFile("/", stickyLocale);
    if (file) return file;
    return apiError({ code: "not-built" }, 503);
  } catch (err) {
    if (err instanceof NoRunError) {
      return apiError({ code: "no-run", kind: err.kind, root: err.root }, 404);
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[aidlc-dashboard] ${strings(opts.locale).cli.routeFailed(url.pathname)}`, err);
    return apiError({ code: "read-failed", message, root: activeRoot }, 500);
  }
}

// ---- credit subsystem boot & lifecycle ------------------------------------

/** The booted credit subsystem, or a degraded shell when boot failed. */
export interface CreditSubsystem extends CreditRuntime {
  store?: CreditReadStore;
  pipeline?: Pollable;
  scheduler?: { stop(): void };
  /**
   * Closes the booted store, if it can be closed. A separate field rather than a
   * method on `CreditReadStore`: that interface is the read contract `assembleCredit`
   * consumes, and shutdown is not its business. No-ops for an injected test store.
   */
  closeStore?: () => void;
  degraded: boolean;
  isCollecting: () => boolean;
  markCollectionDone: () => void;
}

/** Minimal shapes the boot sequence needs, so tests can inject failing seams. */
interface StoreForBoot extends CreditReadStore, PipelineStore {
  init(): void;
  close?(): void;
}
interface PipelineForBoot extends Pollable {
  init(): void;
}
interface SchedulerForBoot {
  start(runImmediately: boolean): void;
  stop(): void;
  /** Optional so an existing test stub stays valid; the real scheduler has both. */
  readonly halt?: PollHalt | null;
  resume?(): void;
}

/** Injectable factories — real constructors by default, stubs in tests. */
export interface CreditBootDeps {
  intervalMs?: number;
  /** Language for the isolated-boot-failure line. Defaults to `ko` for a bare test call. */
  locale?: Locale;
  createStore?: () => StoreForBoot;
  createPipeline?: (store: StoreForBoot) => PipelineForBoot;
  createScheduler?: (
    pipeline: PipelineForBoot,
    onSettled: () => void,
    intervalMs: number | undefined,
  ) => SchedulerForBoot;
}

/**
 * Boot the credit subsystem: open the store, seed the pipeline's sequence
 * counter, and start the 5-minute polling scheduler with an immediate first
 * collection (BR2.1). ANY failure here is isolated — the dashboard must start
 * regardless, with credit degraded (NFR1.5). Factories are injectable so a test
 * can drive the init-failure path without a real SQLite handle.
 */
export function bootCredit(deps: CreditBootDeps = {}): CreditSubsystem {
  const locale = deps.locale ?? DEFAULT_LOCALE;
  let collecting = true;
  const markCollectionDone = () => {
    collecting = false;
  };
  const isCollecting = () => collecting;

  try {
    const store = (
      deps.createStore ??
      (() => {
        // bun:sqlite (unlike the former JSONL writer) does NOT create the parent
        // directory, so ensure the default `./data` dir exists before opening the
        // DB. This is part of the credit snapshot-storage write path — the one
        // write exception the read-only dashboard allows (BR6.4).
        fs.mkdirSync("data", { recursive: true });
        return new SnapshotStore();
      })
    )();
    store.init();
    // One ACP session per process lifetime (see the session-file measurement in the
    // acp-collector header comment).
    //
    // Acquisition must be SERIALISED. The pipeline allows an automatic and a manual run to
    // overlap (BR3.2's pre-await sequence assumes it), and `AcpSessionRef` is an unlocked
    // mutable object. If the first two calls overlap, both run `session/new`, which breaks
    // the "one session per restart" claim, and from then on two separate ACP processes load
    // the same session at once. A single tail-chained promise is enough — a collection runs
    // once every five minutes and takes about two seconds.
    const acpSession: AcpSessionRef = {};
    let acpChain: Promise<unknown> = Promise.resolve();
    const acquireSerially = (): Promise<ParseResult> => {
      const next = acpChain.then(() => collectUsageViaAcp({ session: acpSession }));
      // The chain swallows failures so that one call failing does not block the next.
      acpChain = next.catch(() => undefined);
      return next;
    };
    const pipeline = (
      deps.createPipeline ??
      ((s) =>
        new RefreshPipeline({
          store: s,
          acquire: acquireSerially,
        }))
    )(store);
    pipeline.init();
    const scheduler = (
      deps.createScheduler ??
      ((p, onSettled, intervalMs) =>
        new PollingScheduler({
          pipeline: p,
          intervalMs,
          onTick: onSettled,
          onError: onSettled,
        }))
    )(pipeline, markCollectionDone, deps.intervalMs);
    scheduler.start(true);
    return {
      store,
      pipeline,
      scheduler,
      pollHalt: () => scheduler.halt ?? null,
      resumePolling: () => scheduler.resume?.(),
      closeStore: () => store.close?.(),
      degraded: false,
      isCollecting,
      markCollectionDone,
    };
  } catch (err) {
    console.error(
      `[aidlc-dashboard] ${strings(locale).cli.creditBootFailed(
        err instanceof Error ? err.message : String(err),
      )}`,
    );
    markCollectionDone();
    return {
      degraded: true,
      isCollecting,
      markCollectionDone,
      pollHalt: () => null,
      resumePolling: () => {},
    };
  }
}

/**
 * Stop the polling scheduler's timer on shutdown (BR2.2), then close the store so
 * SQLite folds its WAL back into the DB file. Both are optional: a degraded boot
 * has neither, and an injected test store need not be closable — no-op then.
 */
export function shutdownCredit(scheduler?: { stop(): void }, closeStore?: () => void): void {
  scheduler?.stop();
  closeStore?.();
}

// ---- process entry point --------------------------------------------------

if (import.meta.main) {
  let opts: Options;
  try {
    opts = parseArgs(Bun.argv.slice(2));
  } catch (err) {
    if (err instanceof UsageError) {
      if (err.message) console.error(`error: ${err.message}\n`);
      console.error(USAGE);
      process.exit(err.message ? 2 : 0);
    }
    throw err;
  }

  const cliStrings = strings(opts.locale).cli;
  activeRoot = opts.root;
  if (activeRoot) defaultRecents.add(activeRoot);

  // With a --root, fail loudly at startup rather than on first request. Without
  // one, there is nothing to validate yet — the picker will do it.
  if (activeRoot) {
    try {
      const m = assemble(activeRoot, opts.harnessDir);
      console.log(
        `[aidlc-dashboard] ${m.identity.slug ?? m.identity.record} · ${m.state.lifecyclePhase} ${m.state.overallPct}% · ` +
          `blockers ${m.blockers.length} · ${cliStrings.startupSummary(
            m.totalEvents,
            opts.locale,
          )} · harness ${m.identity.harnessDir ?? cliStrings.harnessNotFound}`,
      );
      for (const w of m.warnings) console.warn(`[warn] ${w.code}`);
    } catch (err) {
      console.error(`[aidlc-dashboard] ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  } else {
    console.log(`[aidlc-dashboard] ${cliStrings.noRootPicker}`);
  }

  // Boot credit AFTER the workspace check so a --root typo still fails fast, and
  // isolate it so a credit boot failure never blocks the server (NFR1.5).
  const credit = bootCredit({ intervalMs: opts.intervalMs, locale: opts.locale });

  // Clean up the polling timer and close the store on termination (BR2.2). The
  // timer is unref'd, so the process can exit on its own; stopping is explicit
  // belt-and-braces. Closing is not — it is what checkpoints the WAL.
  process.on("SIGINT", () => {
    shutdownCredit(credit.scheduler, credit.closeStore);
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    shutdownCredit(credit.scheduler, credit.closeStore);
    process.exit(0);
  });

  // `handle` already turns read failures into a JSON error. This is the
  // last line: anything thrown outside its try (or while streaming a response) would
  // otherwise leave through Bun's built-in 500, which says nothing about which
  // workspace was being read.
  const onError = (err: unknown) => {
    console.error(`[aidlc-dashboard] ${strings(opts.locale).cli.unhandled}`, err);
    const message = err instanceof Error ? err.message : String(err);
    return apiError({ code: "read-failed", message, root: activeRoot }, 500);
  };
  // Loopback is always served (BR6.1, NFR1.1) — Bun's own default is 0.0.0.0, so the
  // explicit hostname is what keeps this off other interfaces. A literal `--host` ADDS
  // one more listener on that exact IP rather than replacing loopback: `localhost`
  // must keep working on this machine. A wildcard `--host` is one listener that already
  // covers loopback, so it replaces the loopback one instead of colliding with it.
  const server = Bun.serve({
    hostname: isWildcard(opts.host) ? opts.host : HOST,
    port: opts.port,
    fetch: (req) => handle(req, opts, credit),
    error: onError,
  });
  const exposed =
    opts.host === HOST || isWildcard(opts.host)
      ? undefined
      : Bun.serve({
          hostname: opts.host,
          port: opts.port,
          fetch: (req) => handle(req, opts, credit),
          error: onError,
        });

  console.log(
    `[aidlc-dashboard] v${VERSION} · http://${HOST}:${server.port}  (poll ${opts.pollMs}ms, collect ${opts.intervalMs}ms, lang ${opts.locale}, workspace read-only${credit.degraded ? ", credit degraded" : ""})`,
  );
  if (exposed) {
    const urlHost = opts.host.includes(":") ? `[${opts.host}]` : opts.host;
    console.warn(`[aidlc-dashboard] ${cliStrings.exposed(`http://${urlHost}:${exposed.port}`)}`);
  }
  if (isWildcard(opts.host)) {
    // Name the addresses a reader can actually type, not the wildcard itself.
    for (const addrs of Object.values(os.networkInterfaces())) {
      for (const a of addrs ?? []) {
        if (a.internal || a.family !== "IPv4") continue;
        console.warn(
          `[aidlc-dashboard] ${cliStrings.exposed(`http://${a.address}:${server.port}`)}`,
        );
      }
    }
  }
  for (const a of opts.allowHosts) {
    const urlHost = a.includes(":") ? `[${a}]` : a;
    console.warn(`[aidlc-dashboard] ${cliStrings.exposed(`http://${urlHost}:${opts.port}`)}`);
  }
}
