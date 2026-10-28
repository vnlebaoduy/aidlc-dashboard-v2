// apps/kirocrew/backend/src/server.ts
import * as fs19 from "node:fs";
import { createServer } from "node:http";

// server/model/assemble.ts
import * as fs18 from "node:fs";
import * as os2 from "node:os";
import * as path16 from "node:path";

// server/credit/claude/transcript-reader.ts
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
var DAY_MS = 24 * 60 * 60 * 1000;
var WINDOW_MS = {
  "7d": 7 * DAY_MS,
  "30d": 30 * DAY_MS
};
var MAX_TOTAL_BYTES = 128 * 1024 * 1024;
var MAX_MEMO_ENTRIES = 512;
var CHUNK_BYTES = 1024 * 1024;
var HEAD_BYTES = 16 * 1024;
function projectSlug(root) {
  return root.replace(/[/._]/g, "-");
}
function readLines(file, onLine) {
  let fd;
  try {
    fd = fs.openSync(file, "r");
  } catch {
    return false;
  }
  const buf = Buffer.allocUnsafe(CHUNK_BYTES);
  const decoder = new TextDecoder("utf-8", { fatal: false });
  let carry = "";
  try {
    for (;; ) {
      const n = fs.readSync(fd, buf, 0, CHUNK_BYTES, null);
      if (n === 0)
        break;
      carry += decoder.decode(buf.subarray(0, n), { stream: true });
      let start = 0;
      let nl = carry.indexOf(`
`, start);
      while (nl !== -1) {
        onLine(carry.slice(start, nl));
        start = nl + 1;
        nl = carry.indexOf(`
`, start);
      }
      if (start > 0)
        carry = carry.slice(start);
    }
    carry += decoder.decode();
    if (carry.length > 0)
      onLine(carry);
    return true;
  } catch {
    return false;
  } finally {
    try {
      fs.closeSync(fd);
    } catch {}
  }
}
function firstCwd(file) {
  let fd;
  try {
    fd = fs.openSync(file, "r");
  } catch {
    return;
  }
  let head;
  try {
    const buf = Buffer.allocUnsafe(HEAD_BYTES);
    const n = fs.readSync(fd, buf, 0, HEAD_BYTES, 0);
    if (n === 0)
      return;
    head = new TextDecoder("utf-8", { fatal: false }).decode(buf.subarray(0, n));
  } catch {
    return;
  } finally {
    try {
      fs.closeSync(fd);
    } catch {}
  }
  for (const line of head.split(`
`)) {
    if (line.length === 0)
      continue;
    try {
      const cwd = JSON.parse(line).cwd;
      if (typeof cwd === "string" && cwd.length > 0)
        return cwd;
    } catch {}
  }
  const m = /"cwd"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(head);
  if (m?.[1] === undefined)
    return;
  try {
    return JSON.parse(`"${m[1]}"`);
  } catch {
    return;
  }
}
function jsonlFiles(dir) {
  try {
    return fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl")).map((f) => path.join(dir, f));
  } catch {
    return [];
  }
}
function findTranscriptDir(root, home, memo) {
  const base = path.join(home, ".claude", "projects");
  const bySlug = path.join(base, projectSlug(root));
  try {
    if (fs.statSync(bySlug).isDirectory())
      return bySlug;
  } catch {}
  let baseMtime;
  try {
    baseMtime = fs.statSync(base).mtimeMs;
  } catch {
    return;
  }
  const dirKey = `${root}|${baseMtime}`;
  if (memo?.dirs.has(dirKey))
    return memo.dirs.get(dirKey) ?? undefined;
  const resolved = scanForCwdMatch(base, root);
  if (memo !== undefined) {
    if (memo.dirs.size >= MAX_MEMO_ENTRIES) {
      const oldest = memo.dirs.keys().next();
      if (!oldest.done)
        memo.dirs.delete(oldest.value);
    }
    memo.dirs.set(dirKey, resolved ?? null);
  }
  return resolved;
}
function scanForCwdMatch(base, root) {
  let entries;
  try {
    entries = fs.readdirSync(base, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (!e.isDirectory())
      continue;
    const dir = path.join(base, e.name);
    const files = jsonlFiles(dir);
    if (files.length === 0)
      continue;
    let newest = files[0];
    let newestMs = -1;
    for (const f of files) {
      try {
        const ms = fs.statSync(f).mtimeMs;
        if (ms > newestMs) {
          newestMs = ms;
          newest = f;
        }
      } catch {}
    }
    if (firstCwd(newest) === root)
      return dir;
  }
  return;
}
function emptyTotals() {
  return { input: 0, output: 0, cacheRead: 0, cacheCreate: 0, thinking: 0 };
}
function addTotals(into, from) {
  into.input += from.input;
  into.output += from.output;
  into.cacheRead += from.cacheRead;
  into.cacheCreate += from.cacheCreate;
  into.thinking += from.thinking;
}
function totalOf(t) {
  return t.input + t.output + t.cacheRead + t.cacheCreate;
}
function num(v) {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
}
function dayKey(ts) {
  const ms = Date.parse(ts);
  if (Number.isNaN(ms))
    return;
  const d = new Date(ms);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
function parseFile(file) {
  const agg = {
    days: new Map,
    sessionsByDay: new Map,
    sidechainByDay: new Map,
    boundsByDay: new Map,
    costStates: [],
    malformedLines: 0
  };
  const ok = readLines(file, (line) => {
    if (line.length === 0)
      return;
    const mightBeCost = line.includes('"cost-state"');
    if (!mightBeCost && !line.includes('"usage"'))
      return;
    let rec;
    try {
      rec = JSON.parse(line);
    } catch {
      agg.malformedLines++;
      return;
    }
    if (rec.type === "cost-state") {
      if (typeof rec.sessionId !== "string" || typeof rec.startTime !== "number")
        return;
      agg.costStates.push({
        sessionId: rec.sessionId,
        startTimeMs: rec.startTime,
        totalMs: num(rec.totalDuration),
        apiMs: num(rec.totalAPIDuration),
        toolMs: num(rec.totalToolDuration)
      });
      return;
    }
    const usage = rec.message?.usage;
    if (typeof usage !== "object" || usage === null)
      return;
    if (typeof rec.timestamp !== "string")
      return;
    const day = dayKey(rec.timestamp);
    if (day === undefined)
      return;
    const details = usage.output_tokens_details;
    const totals = {
      input: num(usage.input_tokens),
      output: num(usage.output_tokens),
      cacheRead: num(usage.cache_read_input_tokens),
      cacheCreate: num(usage.cache_creation_input_tokens),
      thinking: typeof details === "object" && details !== null ? num(details.thinking_tokens) : 0
    };
    const model = typeof rec.message?.model === "string" ? rec.message.model : "(unknown)";
    let byModel = agg.days.get(day);
    if (byModel === undefined) {
      byModel = new Map;
      agg.days.set(day, byModel);
    }
    let slot = byModel.get(model);
    if (slot === undefined) {
      slot = { ...emptyTotals(), messages: 0 };
      byModel.set(model, slot);
    }
    addTotals(slot, totals);
    slot.messages++;
    if (typeof rec.sessionId === "string") {
      let seen = agg.sessionsByDay.get(day);
      if (seen === undefined) {
        seen = new Set;
        agg.sessionsByDay.set(day, seen);
      }
      seen.add(rec.sessionId);
    }
    if (rec.isSidechain === true) {
      agg.sidechainByDay.set(day, (agg.sidechainByDay.get(day) ?? 0) + 1);
    }
    const bounds = agg.boundsByDay.get(day);
    if (bounds === undefined) {
      agg.boundsByDay.set(day, { first: rec.timestamp, last: rec.timestamp });
    } else {
      if (rec.timestamp < bounds.first)
        bounds.first = rec.timestamp;
      if (rec.timestamp > bounds.last)
        bounds.last = rec.timestamp;
    }
  });
  return ok ? agg : undefined;
}
function memoGet(memo, key) {
  return memo?.files.get(key);
}
function memoSet(memo, path, key, value) {
  if (memo === undefined)
    return;
  const previous = memo.keyByPath.get(path);
  if (previous !== undefined && previous !== key)
    memo.files.delete(previous);
  if (memo.files.size >= MAX_MEMO_ENTRIES) {
    const oldest = memo.files.keys().next();
    if (!oldest.done)
      memo.files.delete(oldest.value);
  }
  memo.files.set(key, value);
  memo.keyByPath.set(path, key);
}
function readTranscripts(root, window = "30d", deps = {}) {
  const home = deps.home ?? os.homedir();
  const now = deps.now ?? new Date;
  const triedPath = path.join(home, ".claude", "projects", projectSlug(root));
  const empty = {
    dir: null,
    triedPath,
    totals: emptyTotals(),
    byModel: [],
    daily: [],
    messages: 0,
    sidechainMessages: 0,
    sessions: 0,
    firstAt: null,
    lastAt: null,
    filesRead: 0,
    filesSkipped: 0,
    filesCapped: 0,
    malformedLines: 0,
    unreadableFiles: 0,
    sessionTime: null
  };
  const dir = findTranscriptDir(root, home, deps.memo);
  if (dir === undefined)
    return empty;
  const cutoffMs = window === "all" ? Number.NEGATIVE_INFINITY : now.getTime() - WINDOW_MS[window];
  const stated = [];
  let unreadableFiles = 0;
  for (const file of jsonlFiles(dir)) {
    try {
      const st = fs.statSync(file);
      stated.push({ file, size: st.size, mtimeMs: st.mtimeMs });
    } catch {
      unreadableFiles++;
    }
  }
  stated.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const merged = { ...empty, dir, totals: emptyTotals(), unreadableFiles };
  const dayTotals = new Map;
  const modelTotals = new Map;
  const sessions = new Set;
  const costBySession = new Map;
  let bytes = 0;
  for (const { file, size, mtimeMs } of stated) {
    if (mtimeMs < cutoffMs) {
      merged.filesSkipped++;
      continue;
    }
    if (bytes + size > MAX_TOTAL_BYTES) {
      merged.filesCapped++;
      continue;
    }
    const key = `${file}|${size}|${mtimeMs}`;
    let agg = memoGet(deps.memo, key);
    if (agg === undefined) {
      const parsed = parseFile(file);
      if (parsed === undefined) {
        merged.unreadableFiles++;
        continue;
      }
      agg = parsed;
      memoSet(deps.memo, file, key, agg);
    }
    bytes += size;
    merged.filesRead++;
    merged.malformedLines += agg.malformedLines;
    for (const cs of agg.costStates) {
      const prev = costBySession.get(cs.sessionId);
      if (prev === undefined || cs.totalMs > prev.totalMs)
        costBySession.set(cs.sessionId, cs);
    }
    for (const [day, byModel] of agg.days) {
      const bounds = agg.boundsByDay.get(day);
      if (bounds !== undefined && Date.parse(bounds.last) < cutoffMs)
        continue;
      for (const [model, slot] of byModel) {
        let row = modelTotals.get(model);
        if (row === undefined) {
          row = { model, totals: emptyTotals(), messages: 0 };
          modelTotals.set(model, row);
        }
        addTotals(row.totals, slot);
        row.messages += slot.messages;
        addTotals(merged.totals, slot);
        merged.messages += slot.messages;
        dayTotals.set(day, (dayTotals.get(day) ?? 0) + totalOf(slot));
      }
      merged.sidechainMessages += agg.sidechainByDay.get(day) ?? 0;
      for (const s of agg.sessionsByDay.get(day) ?? [])
        sessions.add(s);
      if (bounds !== undefined) {
        if (merged.firstAt === null || bounds.first < merged.firstAt)
          merged.firstAt = bounds.first;
        if (merged.lastAt === null || bounds.last > merged.lastAt)
          merged.lastAt = bounds.last;
      }
    }
  }
  if (costBySession.size > 0) {
    const st = {
      sessions: 0,
      straddling: 0,
      totalMs: 0,
      apiMs: 0,
      toolMs: 0
    };
    for (const cs of costBySession.values()) {
      if (cs.startTimeMs < cutoffMs) {
        if (cs.startTimeMs + cs.totalMs >= cutoffMs)
          st.straddling++;
        continue;
      }
      st.sessions++;
      st.totalMs += cs.totalMs;
      st.apiMs += cs.apiMs;
      st.toolMs += cs.toolMs;
    }
    merged.sessionTime = st;
  }
  merged.sessions = sessions.size;
  merged.byModel = [...modelTotals.values()].sort((a, b) => totalOf(b.totals) - totalOf(a.totals));
  merged.daily = [...dayTotals.entries()].map(([date, total]) => ({ date, total })).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  return merged;
}

// server/credit/claude/token-model.ts
function toTrend(daily, window) {
  const points = daily.map((d) => ({
    ts: `${d.date}T00:00:00`,
    value: d.total,
    ok: true
  }));
  const values = daily.map((d) => d.total);
  return {
    window,
    points,
    summary: {
      latest: values.length > 0 ? values[values.length - 1] ?? null : null,
      min: values.length > 0 ? Math.min(...values) : null,
      max: values.length > 0 ? Math.max(...values) : null,
      count: values.length
    }
  };
}
function cachedPromptRatioOf(t) {
  const prompt = t.input + t.cacheRead + t.cacheCreate;
  return prompt > 0 ? t.cacheRead / prompt : null;
}
function sessionTimeOf(agg) {
  if (agg === null)
    return null;
  const totalSec = agg.totalMs / 1000;
  return {
    sessions: agg.sessions,
    straddling: agg.straddling,
    totalSec,
    apiSec: agg.apiMs / 1000,
    toolSec: agg.toolMs / 1000,
    apiRatio: agg.totalMs > 0 ? agg.apiMs / agg.totalMs : null
  };
}
function assembleTokens(agg, window) {
  const notes = [];
  if (agg.dir === null) {
    notes.push({ code: "no-transcripts", triedPath: agg.triedPath });
  }
  if (agg.filesCapped > 0) {
    notes.push({ code: "files-capped", count: agg.filesCapped });
  }
  if (agg.unreadableFiles > 0) {
    notes.push({ code: "unreadable-files", count: agg.unreadableFiles });
  }
  if (agg.malformedLines > 0) {
    notes.push({ code: "malformed-lines", count: agg.malformedLines });
  }
  const incomplete = agg.filesCapped > 0 || agg.unreadableFiles > 0 || agg.malformedLines > 0;
  const status = agg.messages === 0 && !incomplete ? "none" : incomplete ? "partial" : "ok";
  return {
    status,
    totals: agg.totals,
    grandTotal: totalOf(agg.totals),
    cachedPromptRatio: cachedPromptRatioOf(agg.totals),
    sessionTime: sessionTimeOf(agg.sessionTime),
    byModel: agg.byModel,
    messages: agg.messages,
    sidechainMessages: agg.sidechainMessages,
    sessions: agg.sessions,
    trend: toTrend(agg.daily, window),
    lastActivityAt: agg.lastAt,
    firstActivityAt: agg.firstAt,
    dir: agg.dir,
    triedPath: agg.triedPath,
    notes
  };
}

// server/credit/trend/trend.ts
var DAY_MS2 = 24 * 60 * 60 * 1000;
var WINDOW_MS2 = {
  "7d": 7 * DAY_MS2,
  "30d": 30 * DAY_MS2
};
var DEFAULT_MAX_POINTS = 500;
function toPoint(s) {
  if (s.ok && s.data.usedAmount !== null) {
    return { ts: s.capturedAt, value: s.data.usedAmount, ok: true };
  }
  return { ts: s.capturedAt, value: null, ok: false };
}
function downsample(points, maxPoints) {
  if (points.length <= maxPoints || maxPoints < 2)
    return points;
  const result = [];
  const stride = (points.length - 1) / (maxPoints - 1);
  for (let i = 0;i < maxPoints; i++) {
    const idx = Math.round(i * stride);
    const p = points[Math.min(idx, points.length - 1)];
    if (p !== undefined)
      result.push(p);
  }
  return result;
}
function buildTrend(snapshots, window, now = new Date, maxPoints = DEFAULT_MAX_POINTS) {
  const nowMs = now.getTime();
  const filtered = snapshots.filter((s) => {
    if (window === "all")
      return true;
    const t = Date.parse(s.capturedAt);
    if (Number.isNaN(t))
      return false;
    return nowMs - t <= WINDOW_MS2[window];
  });
  filtered.sort((a, b) => {
    if (a.capturedAt < b.capturedAt)
      return -1;
    if (a.capturedAt > b.capturedAt)
      return 1;
    return a.sequence - b.sequence;
  });
  const allPoints = filtered.map(toPoint);
  const points = downsample(allPoints, maxPoints);
  const values = [];
  for (const p of allPoints) {
    if (p.value !== null)
      values.push(p.value);
  }
  const summary = {
    latest: values.length > 0 ? values[values.length - 1] ?? null : null,
    min: values.length > 0 ? Math.min(...values) : null,
    max: values.length > 0 ? Math.max(...values) : null,
    count: values.length
  };
  return { window, points, summary };
}

// server/credit/view/credit-model.ts
var STALE_MS = 10 * 60 * 1000;
function assembleCredit(store, now = new Date, window = "30d", collecting = false, pollHalt = null) {
  const all = store.readAll();
  const trend = buildTrend(all, window, now);
  let lastSuccess = null;
  for (let i = all.length - 1;i >= 0; i--) {
    const s = all[i];
    if (s?.ok) {
      lastSuccess = s;
      break;
    }
  }
  const current = lastSuccess?.ok ? lastSuccess.data : null;
  const lastSuccessAt = lastSuccess?.capturedAt ?? null;
  const latest = store.latest();
  const warning = latest !== null && latest.ok === false ? { raw: latest.raw, reason: latest.reason } : null;
  const stale = isStale(lastSuccessAt, now);
  const status = resolveStatus(all.length, lastSuccess, latest, collecting);
  return {
    status,
    current,
    lastSuccessAt,
    freshness: { stale, lastSuccessAt },
    trend,
    warning,
    pollHalt
  };
}
function isStale(lastSuccessAt, now) {
  if (lastSuccessAt === null)
    return false;
  const capturedAt = Date.parse(lastSuccessAt);
  return !Number.isNaN(capturedAt) && now.getTime() - capturedAt > STALE_MS;
}
function resolveStatus(total, lastSuccess, latest, collecting) {
  if (total === 0)
    return collecting ? "loading" : "none";
  if (latest !== null && latest.ok === false)
    return "failure";
  if (lastSuccess?.ok && lastSuccess.data.partial)
    return "partial";
  return "ok";
}

// server/i18n/locale.ts
var DEFAULT_LOCALE = "en";
var COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

// server/i18n/messages.ts
var EN = {
  cli: {
    needValue: (flag) => `${flag} needs a value`,
    mustBeNumber: (flag, raw) => `${flag} must be a number: ${raw}`,
    msFloor: (flag, floor, zeroOk, got) => `${flag} is in milliseconds and must be at least ${floor}${zeroOk ? " (0 disables it)" : ""}: ${got}`,
    portRange: (max, got) => `--port must be between 1 and ${max}: ${got}`,
    badHost: (flag, raw, wildcardOk) => `${flag} must be an IP address (no hostname${wildcardOk ? "" : ", 0.0.0.0 or ::"}): ${raw}`,
    exposed: (url) => `⚠️ Exposed to the network at ${url} — no authentication. Anyone who can reach this address sees the dashboard and the folder picker`,
    needRoot: "--root needs a path",
    pathMissing: (path) => `No such path: ${path}`,
    notAWorkspace: (path) => `No aidlc/ directory — not an AI-DLC workspace root: ${path}`,
    harnessMissing: (path) => `The directory given to --harness does not exist: ${path}`,
    needUsage: "--usage needs a value (auto|kiro|claude)",
    badUsage: (raw) => `--usage must be one of auto|kiro|claude: ${raw}`,
    needLang: "--lang needs a value (en|vi)",
    badLang: (raw) => `--lang must be one of en|vi: ${raw}`,
    unknownArg: (arg) => `Unknown argument: ${arg}`,
    noRootPicker: "No --root — choose a folder in the browser",
    manualRefreshFailed: (detail) => `Manual refresh failed (isolated): ${detail}`,
    routeFailed: (route) => `${route} failed:`,
    creditBootFailed: (detail) => `Credit subsystem failed to boot (the dashboard is still starting): ${detail}`,
    unhandled: "Unhandled error:",
    harnessNotFound: "not found",
    startupSummary: (audit, langDefault) => `audit ${audit} · lang ${langDefault} by default`,
    intentAmbiguous: (root) => `Several intents but no active-intent cursor: ${root}`,
    noWorkflow: (root) => `No AI-DLC workflow found: ${root}`
  },
  openFile: {
    spawnFailedLog: (cmd, detail) => `Could not open the file (${cmd}): ${detail}`
  }
};
var VI = {
  cli: {
    needValue: (flag) => `${flag} cần một giá trị`,
    mustBeNumber: (flag, raw) => `${flag} phải là số: ${raw}`,
    msFloor: (flag, floor, zeroOk, got) => `${flag} tính bằng mili giây và phải ít nhất ${floor}${zeroOk ? " (0 để tắt)" : ""}: ${got}`,
    portRange: (max, got) => `--port phải nằm trong khoảng 1 đến ${max}: ${got}`,
    badHost: (flag, raw, wildcardOk) => `${flag} phải là địa chỉ IP (không dùng hostname${wildcardOk ? "" : ", 0.0.0.0 hay ::"}): ${raw}`,
    exposed: (url) => `⚠️ Đang mở ra mạng tại ${url} — không có xác thực. Bất kỳ ai truy cập được địa chỉ này đều thấy dashboard và bộ chọn thư mục`,
    needRoot: "--root cần một đường dẫn",
    pathMissing: (path) => `Không có đường dẫn này: ${path}`,
    notAWorkspace: (path) => `Không có thư mục aidlc/ — không phải gốc workspace AI-DLC: ${path}`,
    harnessMissing: (path) => `Thư mục truyền cho --harness không tồn tại: ${path}`,
    needUsage: "--usage cần một giá trị (auto|kiro|claude)",
    badUsage: (raw) => `--usage phải là một trong auto|kiro|claude: ${raw}`,
    needLang: "--lang cần một giá trị (en|vi)",
    badLang: (raw) => `--lang phải là một trong en|vi: ${raw}`,
    unknownArg: (arg) => `Tham số không xác định: ${arg}`,
    noRootPicker: "Không có --root — hãy chọn thư mục trong trình duyệt",
    manualRefreshFailed: (detail) => `Làm mới thủ công thất bại (đã cô lập): ${detail}`,
    routeFailed: (route) => `${route} thất bại:`,
    creditBootFailed: (detail) => `Không khởi động được hệ thống credit (dashboard vẫn đang khởi động): ${detail}`,
    unhandled: "Lỗi chưa được xử lý:",
    harnessNotFound: "không tìm thấy",
    startupSummary: (audit, langDefault) => `audit ${audit} · lang mặc định ${langDefault}`,
    intentAmbiguous: (root) => `Có nhiều intent nhưng không có con trỏ active-intent: ${root}`,
    noWorkflow: (root) => `Không tìm thấy workflow AI-DLC: ${root}`
  },
  openFile: {
    spawnFailedLog: (cmd, detail) => `Không mở được file (${cmd}): ${detail}`
  }
};
var BY_LOCALE = { en: EN, vi: VI };
function serverStrings(locale) {
  return BY_LOCALE[locale];
}

// server/scan/artifacts.ts
import * as fs2 from "node:fs";
import * as path2 from "node:path";
var LISTED_EXT = [".md", ".html", ".json"];
function classify(name, stageSlug) {
  if (name === "memory.md")
    return "diary";
  if (name === `${stageSlug}-questions.md`)
    return "questions";
  if (name.endsWith("-questions.md"))
    return "questions";
  return "artifact";
}
var KIND_ORDER = { artifact: 0, questions: 1, diary: 2 };
function listStageArtifacts(recordDir, phase, stageSlug, unit) {
  const segments = unit ? ["construction", unit, stageSlug] : [phase, stageSlug];
  const dir = path2.join(recordDir, ...segments);
  let entries;
  try {
    entries = fs2.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const e of entries) {
    if (!e.isFile())
      continue;
    if (!LISTED_EXT.some((ext) => e.name.toLowerCase().endsWith(ext)))
      continue;
    let size = 0;
    try {
      size = fs2.statSync(path2.join(dir, e.name)).size;
    } catch {}
    out.push({
      name: e.name,
      rel: [...segments, e.name].join("/"),
      kind: classify(e.name, stageSlug),
      size,
      ...unit ? { unit } : {}
    });
  }
  return out.sort((a, b) => (a.unit ?? "").localeCompare(b.unit ?? "") || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.name.localeCompare(b.name));
}

// server/scan/audit.ts
import * as fs3 from "node:fs";
import * as path3 from "node:path";
var FIELD_RE = /^\*\*([^*]+)\*\*:[ \t]*(.*)$/;
function parseContext(ctx, isStage) {
  const segs = ctx.split(">").map((s) => s.trim()).filter((s) => s.length > 0);
  if (segs.length < 2)
    return {};
  if (isStage) {
    for (let i = 1;i < segs.length; i++) {
      const seg = segs[i];
      if (!isStage(seg))
        continue;
      return { stage: seg, unit: i > 1 ? segs[i - 1] : undefined };
    }
    return {};
  }
  if (segs.length >= 4)
    return { stage: segs[2], unit: segs[1] };
  if (segs.length === 3)
    return { stage: segs[1] };
  return {};
}
function parseAuditShard(text, shard, isStage) {
  const out = [];
  for (const block of text.replace(/\r\n/g, `
`).split(`
---
`)) {
    const fields = {};
    for (const line of block.split(`
`)) {
      const m = FIELD_RE.exec(line);
      if (m)
        fields[m[1]] = (m[2] ?? "").trim();
    }
    const ts = fields.Timestamp;
    const event = fields.Event;
    if (!ts || !event)
      continue;
    let stage = fields.Stage || fields["Stage slug"] || undefined;
    let unit = fields.Unit || undefined;
    const ctx = fields.Context;
    if (ctx) {
      const resolved = parseContext(ctx, isStage);
      if (!unit)
        unit = resolved.unit;
      if (!stage)
        stage = resolved.stage;
    }
    out.push({ ts, event, stage, unit, fields, shard });
  }
  return out;
}
function shardPaths(recordDir) {
  const dir = path3.join(recordDir, "audit");
  let entries;
  try {
    entries = fs3.readdirSync(dir);
  } catch {
    return [];
  }
  return entries.filter((f) => f.endsWith(".md")).sort().map((f) => path3.join(dir, f));
}
function readAuditLedger(recordDir, isStage) {
  const events = [];
  const shards = [];
  for (const p of shardPaths(recordDir)) {
    let text;
    try {
      text = fs3.readFileSync(p, "utf-8");
    } catch {
      continue;
    }
    const base = path3.basename(p);
    shards.push(base);
    events.push(...parseAuditShard(text, base, isStage));
  }
  events.sort((a, b) => a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0);
  const counts = new Map;
  for (const e of events)
    counts.set(e.event, (counts.get(e.event) ?? 0) + 1);
  return {
    events,
    counts,
    shards,
    firstTs: events.length > 0 ? events[0]?.ts : undefined,
    lastTs: events.length > 0 ? events[events.length - 1]?.ts : undefined
  };
}

// server/scan/deferrals.ts
import * as fs4 from "node:fs";
import * as path4 from "node:path";
var OWNER_STATUSES = [
  "passed",
  "current",
  "ahead",
  "outOfScope",
  "nextCycle",
  "unassigned"
];
var PHASE_DIRS = ["initialization", "ideation", "inception", "construction", "operation"];
var SECTION_RE = /^(#{2,3})\s+Assumptions\s*&\s*Open\s*Questions\s*$/i;
var SUB_RE = /^#{3,4}\s+(.*?)\s*$/;
var OPEN_SUB_RE = /open\s*questions?/i;
var ASSUMPTIONS_SUB_RE = /^assumptions?$/i;
var TABLE_SEP_RE = /^\s*\|[\s:|-]*-{2,}[\s:|-]*\|?\s*$/;
var TABLE_ROW_RE = /^\s*\|(.*?)\|?\s*$/;
var NONE_RE = /^(?:none|n\/a|not applicable|없음|해당\s*없음)[.!。]?$/i;
var ASSUMPTION_TAG_RE = /`?\[assumption\]`?/i;
var LIST_ITEM_RE = /^(\s*)(?:[-*+]|\d+[.)])\s+(.*)$/;
var LIST_MARKER_RE = /^\s*(?:[-*+]|\d+[.)])\s+/;
var LEDGER_ID_RE = /^\*\*((OQ|AS)[A-Z0-9.-]*\d[A-Z0-9.-]*[a-z]?)\*\*/;
var SLUG_TOKEN_RE = /[a-z][a-z0-9]*(?:-[a-z0-9]+)+/g;
var NEXT_CYCLE_RE = /(?:다음|이후|차기)\s*차수|next\s+cycle|이번\s*차수\s*밖/i;
function splitRow(line) {
  const m = TABLE_ROW_RE.exec(line);
  if (!m)
    return [];
  return (m[1] ?? "").split("|").map((c) => c.trim());
}
function tidy(s) {
  return s.replace(/\s+/g, " ").trim();
}
var CONFIRMATION_RE = /^#{2,3}\s+(?:\S+\s+)?Assumption\s+Confirmation\s*$/i;
var ANSWER_LINE_RE = /^\s*\[Answer\]:\s*(.*)$/;
var ACCEPT_RE = /^(?:a(?:[.)\s:—–-]|$)|accept\b)/i;
function parseAssumptionConfirmation(text) {
  const lines = text.replace(/\r\n/g, `
`).split(`
`);
  const start = lines.findIndex((l) => CONFIRMATION_RE.test(l));
  if (start < 0)
    return;
  const level = /^(#+)/.exec(lines[start] ?? "")?.[1]?.length ?? 2;
  const endRe = new RegExp(`^#{1,${level}}\\s`);
  const listed = [];
  let answer = "";
  let current;
  const flush = () => {
    if (current !== undefined) {
      const t = tidy(current.replace(ASSUMPTION_TAG_RE, ""));
      if (t && !/^[AB]\.\s+(?:accept assumptions|convert to follow-up questions)/i.test(t)) {
        listed.push(t);
      }
    }
    current = undefined;
  };
  for (let i = start + 1;i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (endRe.test(line) || /^---\s*$/.test(line))
      break;
    const a = ANSWER_LINE_RE.exec(line);
    if (a) {
      flush();
      if (!answer)
        answer = tidy(a[1] ?? "");
      continue;
    }
    const li = LIST_ITEM_RE.exec(line);
    if (li && (li[1] ?? "").length === 0) {
      flush();
      current = li[2] ?? "";
      continue;
    }
    if (current !== undefined && /^\s+\S/.test(line)) {
      current = `${current} ${line.trim()}`;
      continue;
    }
    flush();
  }
  flush();
  return { accepted: ACCEPT_RE.test(answer), listed };
}
function words(text) {
  const bare = text.toLowerCase().replace(/\[[^\]]*\]/g, " ").replace(/[^\p{L}\p{N}]+/gu, " ");
  return new Set(bare.split(" ").filter((w) => w.length >= 3));
}
function sameAssumption(a, b) {
  const x = words(a);
  const y = words(b);
  const small = Math.min(x.size, y.size);
  if (small < 3)
    return false;
  let shared = 0;
  for (const w of x)
    if (y.has(w))
      shared++;
  return shared / small >= 0.6;
}
function groupAssumptions(list) {
  const groups = [];
  for (const a of list) {
    const home = groups.find((g) => g.every((m) => sameAssumption(m.text, a.text)));
    if (home)
      home.push(a);
    else
      groups.push([a]);
  }
  const rank = { unconfirmed: 0, partial: 1, accepted: 2 };
  return groups.map((members) => {
    const ok = members.filter((m) => m.accepted).length;
    const status = ok === members.length ? "accepted" : ok > 0 ? "partial" : "unconfirmed";
    const text = members.reduce((l, m) => m.text.length > l.length ? m.text : l, "");
    return { text, status, members };
  }).map((g, order) => ({ g, order })).sort((a, b) => rank[a.g.status] - rank[b.g.status] || a.order - b.order).map(({ g }) => g);
}
function parseDeferralSections(text) {
  const out = { rows: [], assumptions: [], sections: 0, declaredNone: false };
  const lines = text.replace(/\r\n/g, `
`).split(`
`);
  for (let i = 0;i < lines.length; i++) {
    const head = SECTION_RE.exec(lines[i] ?? "");
    if (!head)
      continue;
    out.sections++;
    const level = (head[1] ?? "##").length;
    const endRe = new RegExp(`^#{1,${level}}\\s`);
    let sub;
    let pastSeparator = false;
    let bullet;
    let bulletIndent = 0;
    let bodyLines = 0;
    let noneLines = 0;
    const rowsBefore = out.rows.length;
    const assumptionsBefore = out.assumptions.length;
    const flushBullet = () => {
      const b = bullet;
      bullet = undefined;
      if (b === undefined)
        return;
      if (ASSUMPTION_TAG_RE.test(b)) {
        const t = tidy(b.replace(ASSUMPTION_TAG_RE, ""));
        if (t.length > 0)
          out.assumptions.push(t);
        return;
      }
      if (NONE_RE.test(tidy(b)))
        return;
      const id = LEDGER_ID_RE.exec(b);
      const kind = id ? (id[2] ?? "") === "AS" ? "assumption" : "open" : sub === "open" && bulletIndent === 0 ? "open" : undefined;
      if (kind === undefined)
        return;
      const t = tidy(id ? b.replace(LEDGER_ID_RE, "$1") : b);
      if (t.length === 0)
        return;
      if (kind === "assumption")
        out.assumptions.push(t);
      else
        out.rows.push({ item: t, assignment: "" });
    };
    for (let j = i + 1;j < lines.length; j++) {
      const line = lines[j] ?? "";
      if (endRe.test(line)) {
        i = j - 1;
        break;
      }
      const s = SUB_RE.exec(line);
      if (!s && line.trim().length > 0) {
        bodyLines++;
        if (NONE_RE.test(tidy(line.replace(LIST_MARKER_RE, ""))))
          noneLines++;
      }
      if (s) {
        flushBullet();
        const name = (s[1] ?? "").trim();
        sub = OPEN_SUB_RE.test(name) ? "open" : ASSUMPTIONS_SUB_RE.test(name) ? "assumptions" : "other";
        pastSeparator = false;
        continue;
      }
      if (line.trim().startsWith("|")) {
        flushBullet();
        if (sub !== "open")
          continue;
        if (TABLE_SEP_RE.test(line)) {
          pastSeparator = true;
          continue;
        }
        if (!pastSeparator)
          continue;
        const cells = splitRow(line);
        const item = tidy(cells[0] ?? "");
        const assignment = tidy(cells[cells.length - 1] ?? "");
        if (item.length === 0 || cells.length < 2)
          continue;
        out.rows.push({ item, assignment });
        continue;
      }
      const b = LIST_ITEM_RE.exec(line);
      if (b) {
        flushBullet();
        bulletIndent = (b[1] ?? "").length;
        bullet = b[2] ?? "";
        continue;
      }
      if (bullet !== undefined && /^\s+\S/.test(line)) {
        bullet = `${bullet} ${line.trim()}`;
        continue;
      }
      flushBullet();
    }
    flushBullet();
    if (out.rows.length === rowsBefore && out.assumptions.length === assumptionsBefore && bodyLines > 0 && noneLines === bodyLines) {
      out.declaredNone = true;
    }
  }
  return out;
}
function resolveOwner(assignment, stageStatuses, catalogSlugs) {
  const tokens = assignment.match(SLUG_TOKEN_RE) ?? [];
  for (const token of tokens) {
    const inState = stageStatuses.get(token);
    if (inState && inState.length > 0) {
      if (inState.some((s) => s === "active" || s === "awaiting" || s === "revising")) {
        return { ownerStage: token, ownerStatus: "current" };
      }
      if (inState.every((s) => s === "done" || s === "skipped")) {
        return { ownerStage: token, ownerStatus: "passed" };
      }
      return { ownerStage: token, ownerStatus: "ahead" };
    }
    if (catalogSlugs?.has(token))
      return { ownerStage: token, ownerStatus: "outOfScope" };
  }
  if (NEXT_CYCLE_RE.test(assignment))
    return { ownerStatus: "nextCycle" };
  return { ownerStatus: "unassigned" };
}
function statMtime(p) {
  try {
    return fs4.statSync(p).mtime.toISOString().replace(/\.\d{3}Z$/, "Z");
  } catch {
    return "";
  }
}
function isDir(p) {
  try {
    return fs4.statSync(p).isDirectory();
  } catch {
    return false;
  }
}
function readDir(p) {
  try {
    return fs4.readdirSync(p).sort();
  } catch {
    return [];
  }
}
function locateArtifacts(recordDir, isStage) {
  const out = [];
  const scanFiles = (relParts, phase, stage, unit, descend) => {
    for (const f of readDir(path4.join(recordDir, ...relParts))) {
      const abs = path4.join(recordDir, ...relParts, f);
      if (f.endsWith(".md")) {
        out.push({ relParts: [...relParts, f], phase, stage, unit });
        continue;
      }
      if (descend && isDir(abs)) {
        for (const g of readDir(abs)) {
          if (g.endsWith(".md"))
            out.push({ relParts: [...relParts, f, g], phase, stage, unit });
        }
      }
    }
  };
  for (const phase of PHASE_DIRS) {
    const phaseAbs = path4.join(recordDir, phase);
    if (!isDir(phaseAbs))
      continue;
    for (const child of readDir(phaseAbs)) {
      const childAbs = path4.join(phaseAbs, child);
      if (!isDir(childAbs))
        continue;
      const subdirs = readDir(childAbs).filter((g) => isDir(path4.join(childAbs, g)));
      const childIsStage = isStage ? isStage(child) : subdirs.length === 0;
      if (!childIsStage && subdirs.length > 0) {
        for (const stage of subdirs)
          scanFiles([phase, child, stage], phase, stage, child, true);
        scanFiles([phase, child], phase, child, undefined, false);
      } else {
        scanFiles([phase, child], phase, child, undefined, true);
      }
    }
  }
  return out;
}
var STATUS_RANK = {
  passed: 0,
  current: 1,
  ahead: 2,
  unassigned: 3,
  outOfScope: 4,
  nextCycle: 5
};
function readDeferrals(recordDir, opts = {}) {
  const stageStatuses = opts.stageStatuses ?? new Map;
  const nowMs = Date.parse(opts.now ?? new Date().toISOString());
  const located = locateArtifacts(recordDir, opts.isStage);
  let sections = 0;
  let emptySections = 0;
  let rows = 0;
  const byItem = new Map;
  const assumptions = new Map;
  const confirmations = new Map;
  for (const loc of located) {
    const name = loc.relParts[loc.relParts.length - 1] ?? "";
    if (!name.endsWith("-questions.md"))
      continue;
    let qtext;
    try {
      qtext = fs4.readFileSync(path4.join(recordDir, ...loc.relParts), "utf-8");
    } catch {
      continue;
    }
    const c = parseAssumptionConfirmation(qtext);
    if (c)
      confirmations.set(loc.relParts.slice(0, -1).join("/"), { rel: loc.relParts.join("/"), c });
  }
  for (const loc of located) {
    const abs = path4.join(recordDir, ...loc.relParts);
    let text;
    try {
      text = fs4.readFileSync(abs, "utf-8");
    } catch {
      continue;
    }
    if (!/Assumptions\s*&\s*Open\s*Questions/i.test(text))
      continue;
    const parsed = parseDeferralSections(text);
    sections += parsed.sections;
    const found = parsed.rows.length > 0 || parsed.assumptions.length > 0;
    if (!found) {
      if (parsed.declaredNone)
        emptySections++;
      continue;
    }
    const rel = loc.relParts.join("/");
    const since = statMtime(abs);
    for (const row of parsed.rows) {
      rows++;
      const key = row.item.toLowerCase();
      const existing = byItem.get(key);
      if (existing) {
        existing.sources.push(rel);
        if (since && (!existing.since || since < existing.since))
          existing.since = since;
        continue;
      }
      const owner = resolveOwner(row.assignment, stageStatuses, opts.catalogSlugs);
      byItem.set(key, {
        item: row.item,
        assignment: row.assignment,
        ownerStage: owner.ownerStage,
        ownerStatus: owner.ownerStatus,
        phase: loc.phase,
        stage: loc.stage,
        unit: loc.unit,
        rel,
        sources: [rel],
        since
      });
    }
    const stageDir = (loc.unit ? [loc.phase, loc.unit, loc.stage] : [loc.phase, loc.stage]).join("/");
    const confirmation = confirmations.get(stageDir);
    for (const text2 of parsed.assumptions) {
      const key = text2.toLowerCase();
      if (assumptions.has(key))
        continue;
      const accepted = confirmation?.c.accepted === true && confirmation.c.listed.some((l) => sameAssumption(l, text2));
      assumptions.set(key, {
        text: text2,
        phase: loc.phase,
        stage: loc.stage,
        unit: loc.unit,
        rel,
        since,
        accepted,
        acceptedIn: accepted ? confirmation?.rel : undefined
      });
    }
  }
  const items = [...byItem.values()];
  for (const it of items) {
    const parsedTs = Date.parse(it.since);
    it.ageSec = Number.isFinite(parsedTs) ? Math.max(0, (nowMs - parsedTs) / 1000) : undefined;
  }
  items.sort((a, b) => STATUS_RANK[a.ownerStatus] - STATUS_RANK[b.ownerStatus] || (a.since < b.since ? -1 : a.since > b.since ? 1 : 0) || a.item.localeCompare(b.item));
  const counts = Object.fromEntries(OWNER_STATUSES.map((s) => [s, 0]));
  for (const it of items)
    counts[it.ownerStatus]++;
  const ownerRollup = new Map;
  for (const it of items) {
    const key = it.ownerStage ?? `status:${it.ownerStatus}`;
    const row = ownerRollup.get(key);
    if (row)
      row.count++;
    else
      ownerRollup.set(key, { stage: it.ownerStage, status: it.ownerStatus, count: 1 });
  }
  const assumptionList = [...assumptions.values()];
  return {
    items,
    assumptions: assumptionList,
    assumptionGroups: groupAssumptions(assumptionList),
    counts,
    byOwner: [...ownerRollup.values()].sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || b.count - a.count || (a.stage ?? "").localeCompare(b.stage ?? "")),
    artifacts: located.length,
    sections,
    emptySections,
    rows,
    catalogMissing: opts.catalogSlugs === undefined
  };
}

// server/scan/harness-usage.ts
import * as fs5 from "node:fs";
import * as path5 from "node:path";
function sessionHarness(id, claudeDir, kiroRoot, kiroDirs) {
  const safe = path5.basename(id);
  if (safe !== id || safe === "" || safe === "." || safe === "..")
    return;
  if (fs5.existsSync(path5.join(claudeDir, `${safe}.jsonl`)))
    return "claude";
  for (const d of kiroDirs) {
    const base = path5.join(kiroRoot, d, safe);
    if (fs5.existsSync(base) || fs5.existsSync(`${base}.json`) || fs5.existsSync(`${base}.jsonl`)) {
      return "kiro";
    }
  }
  return;
}
function measureHarnessTurns(root, ledger, home) {
  const claudeDir = path5.join(home, ".claude", "projects", projectSlug(root));
  const kiroRoot = path5.join(home, ".kiro", "sessions");
  let kiroDirs = [];
  try {
    kiroDirs = fs5.readdirSync(kiroRoot, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {}
  const turns = { kiro: 0, claude: 0, unknown: 0 };
  const seen = new Map;
  for (const e of ledger.events) {
    if (e.event !== "HUMAN_TURN")
      continue;
    const id = e.fields.Session;
    if (!id) {
      turns.unknown++;
      continue;
    }
    if (!seen.has(id))
      seen.set(id, sessionHarness(id, claudeDir, kiroRoot, kiroDirs));
    const h = seen.get(id);
    if (h)
      turns[h]++;
    else
      turns.unknown++;
  }
  return turns;
}

// server/scan/hooks-health.ts
import * as fs7 from "node:fs";
import * as path7 from "node:path";

// server/scan/engine-dir.ts
import * as fs6 from "node:fs";
import * as path6 from "node:path";
var ENGINE_DIR = ".aidlc-engine";
function engineReadDir(recordDir, name, legacyName) {
  const engine = path6.join(recordDir, ENGINE_DIR);
  const current = path6.join(engine, name);
  try {
    const engineStat = fs6.lstatSync(engine, { throwIfNoEntry: false });
    if (engineStat !== undefined && !engineStat.isDirectory())
      return current;
    if (fs6.lstatSync(current, { throwIfNoEntry: false }) !== undefined)
      return current;
    const legacy = path6.join(recordDir, legacyName);
    return fs6.existsSync(legacy) ? legacy : current;
  } catch {
    return current;
  }
}

// server/scan/hooks-health.ts
function reasonKey(reason) {
  const head = (reason.split(":")[0] ?? "").trim();
  const base = head.length > 0 ? head : reason.trim();
  return base.length > 80 ? `${base.slice(0, 80)}…` : base;
}
function parseDrops(text) {
  const rows = [];
  for (const line of text.replace(/\r\n/g, `
`).split(`
`)) {
    if (line.trim().length === 0)
      continue;
    const tab = line.indexOf("\t");
    if (tab < 0)
      rows.push({ ts: "", reason: line.trim() });
    else
      rows.push({ ts: line.slice(0, tab).trim(), reason: line.slice(tab + 1).trim() });
  }
  return rows;
}
function readText(p) {
  try {
    return fs7.readFileSync(p, "utf-8");
  } catch {
    return;
  }
}
function readHealth(recordDir) {
  const healthDir = engineReadDir(recordDir, "hooks-health", ".aidlc-hooks-health");
  let entries = [];
  try {
    entries = fs7.readdirSync(healthDir);
  } catch {}
  const names = new Set;
  for (const f of entries) {
    if (f.endsWith(".last"))
      names.add(f.slice(0, -5));
    else if (f.endsWith(".drops"))
      names.add(f.slice(0, -6));
  }
  const hooks = [];
  for (const name of [...names].sort()) {
    const lastRaw = readText(path7.join(healthDir, `${name}.last`));
    const dropsRaw = readText(path7.join(healthDir, `${name}.drops`));
    const dropRows = dropsRaw ? parseDrops(dropsRaw) : [];
    const byReason = new Map;
    let degraded = 0;
    for (const d of dropRows) {
      if (d.reason.includes("[degraded]"))
        degraded++;
      const k = reasonKey(d.reason);
      byReason.set(k, (byReason.get(k) ?? 0) + 1);
    }
    hooks.push({
      name,
      lastFired: lastRaw?.trim() || undefined,
      drops: dropRows.length,
      degradedDrops: degraded,
      lastDrop: dropRows.length > 0 ? dropRows[dropRows.length - 1] : undefined,
      topDropReasons: [...byReason].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count).slice(0, 3)
    });
  }
  let stopGuard;
  const stopDir = engineReadDir(recordDir, "stop-hook", ".aidlc-stop-hook");
  const guardRaw = readText(path7.join(stopDir, "block-count.json"));
  if (guardRaw) {
    try {
      const j = JSON.parse(guardRaw);
      if (typeof j.signature === "string" && typeof j.count === "number") {
        stopGuard = { signature: j.signature, count: j.count };
      }
    } catch {}
  }
  const fired = hooks.map((h) => h.lastFired).filter((t) => !!t);
  return {
    hooks,
    firstFired: readText(path7.join(healthDir, ".first-fired"))?.trim() || undefined,
    lastActivity: fired.length > 0 ? fired.sort()[fired.length - 1] : undefined,
    stopGuard,
    totalDrops: hooks.reduce((n, h) => n + h.drops, 0)
  };
}

// server/scan/matrix.ts
import * as fs10 from "node:fs";
import * as path10 from "node:path";

// server/scan/parser.ts
var PHASE_ORDER = [
  "initialization",
  "ideation",
  "inception",
  "construction",
  "operation"
];
var PHASE_DISPLAY = {
  initialization: "Initialization",
  ideation: "Ideation",
  inception: "Inception",
  construction: "Construction",
  operation: "Operation"
};
var STAGE_DISPLAY = {
  "workspace-scaffold": "Workspace Scaffold",
  "workspace-detection": "Workspace Detection",
  "state-init": "State Init",
  "intent-capture": "Intent Capture",
  "market-research": "Market Research",
  feasibility: "Feasibility",
  "scope-definition": "Scope Definition",
  "team-formation": "Team Formation",
  "rough-mockups": "Rough Mockups",
  "approval-handoff": "Approval & Handoff",
  "reverse-engineering": "Reverse Engineering",
  "practices-discovery": "Practices Discovery",
  "requirements-analysis": "Requirements Analysis",
  "user-stories": "User Stories",
  "refined-mockups": "Refined Mockups",
  "application-design": "Application Design",
  "domain-design": "Domain Design",
  "contract-design": "Contract Design",
  "units-generation": "Units Generation",
  "delivery-planning": "Delivery Planning",
  "functional-design": "Functional Design",
  "nfr-requirements": "NFR Requirements",
  "nfr-design": "NFR Design",
  "infrastructure-design": "Infrastructure Design",
  "code-generation": "Code Generation",
  "build-and-test": "Build and Test",
  "ci-pipeline": "CI Pipeline",
  "deployment-pipeline": "Deployment Pipeline",
  "environment-provisioning": "Env Provisioning",
  "deployment-execution": "Deployment Execution",
  "observability-setup": "Observability Setup",
  "incident-response": "Incident Response",
  "performance-validation": "Performance Validation",
  "feedback-optimization": "Feedback & Optimization"
};
function titleCase(slug) {
  return slug.split("-").map((w) => w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w).join(" ");
}
function stageDisplay(slug, fromCatalog) {
  return fromCatalog?.(slug) ?? STAGE_DISPLAY[slug] ?? titleCase(slug);
}
var AGENT_DISPLAY = {
  orchestrator: "Orchestrator",
  "aidlc-architect-agent": "Architect Agent",
  "aidlc-architecture-reviewer-agent": "Architecture Reviewer",
  "aidlc-aws-platform-agent": "AWS Platform Agent",
  "aidlc-compliance-agent": "Compliance Agent",
  "aidlc-delivery-agent": "Delivery Agent",
  "aidlc-design-agent": "Design Agent",
  "aidlc-developer-agent": "Developer Agent",
  "aidlc-devsecops-agent": "DevSecOps Agent",
  "aidlc-operations-agent": "Operations Agent",
  "aidlc-pipeline-deploy-agent": "Pipeline & Deploy Agent",
  "aidlc-product-agent": "Product Agent",
  "aidlc-product-lead-agent": "Product Lead",
  "aidlc-quality-agent": "Quality Agent"
};
function extractField(text, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^-\\s*\\*\\*${escaped}\\*\\*:[^\\S\\n]*([^\\n]*)`, "m");
  const m = text.match(re);
  return m?.[1] !== undefined ? m[1].replace(/\r$/, "").trim() : "";
}
var BOLT_HEADING_RE = /^####\s+Bolt:\s+([a-z0-9][a-z0-9-]*)\s*$/;
var PER_UNIT_RE = /^Per unit:\s*(.+)$/m;
var BOLT_BATCHES_RE = /^Bolt batches:\s*(.+)$/m;
var BATCH_GROUP_RE = /([^\s=\[\],]+)\s*=\s*\[([^\]]*)\]/g;
function stageStatusFromBox(box, isSkipMarker) {
  if (box === "x")
    return "done";
  if (box === "-")
    return "active";
  if (box === "?")
    return "awaiting";
  if (box === "R")
    return "revising";
  if (box === "S")
    return "skipped";
  return isSkipMarker ? "skipped" : "pending";
}
function parseDeclaredPhaseStatus(text) {
  const out = {};
  const re = /^-\s*\*\*([A-Za-z]+)\*\*:\s*([A-Za-z]+)/gm;
  const section = sliceSection(text, "## Phase Progress");
  let m = re.exec(section);
  while (m !== null) {
    const key = m[1].toLowerCase();
    if (PHASE_ORDER.includes(key)) {
      out[key] = m[2];
    }
    m = re.exec(section);
  }
  return out;
}
function sliceSection(text, heading) {
  const start = text.indexOf(heading);
  if (start < 0)
    return "";
  const after = start + heading.length;
  const next = text.indexOf(`
## `, after);
  return next < 0 ? text.slice(after) : text.slice(after, next);
}
function parseStages(text, catalogName) {
  const byPhase = new Map;
  const lines = text.split(/\r?\n/);
  let current = null;
  let currentBolt;
  const stageRe = /^-\s*\[(.)\]\s*([a-z0-9-]+)/;
  for (const line of lines) {
    const head = line.match(/^###\s+([A-Za-z]+)\s+PHASE/i);
    if (head) {
      current = head[1].toLowerCase();
      currentBolt = undefined;
      if (!byPhase.has(current))
        byPhase.set(current, []);
      continue;
    }
    const boltHead = line.match(BOLT_HEADING_RE);
    if (boltHead) {
      currentBolt = boltHead[1];
      continue;
    }
    if (line.startsWith("## "))
      current = null;
    if (line.trim() === "" || /^#{1,3}\s/.test(line))
      currentBolt = undefined;
    if (!current)
      continue;
    const m = line.match(stageRe);
    if (!m)
      continue;
    const box = m[1];
    const slug = m[2];
    const isSkipMarker = /\bSKIP\b/.test(line);
    byPhase.get(current)?.push({
      slug,
      display: stageDisplay(slug, catalogName),
      status: stageStatusFromBox(box, isSkipMarker),
      execute: !isSkipMarker,
      ...currentBolt !== undefined ? { bolt: currentBolt } : {}
    });
  }
  return byPhase;
}
function displayFromSlug(slug) {
  return slug.split("-").map((w) => w ? w[0]?.toUpperCase() + w.slice(1) : w).join(" ");
}
function boltStatusFromStages(stages) {
  const exec = stages.filter((s) => s.execute);
  if (exec.length === 0)
    return "pending";
  for (const s of exec) {
    if (s.status === "active" || s.status === "awaiting" || s.status === "revising") {
      return s.status;
    }
  }
  if (exec.every((s) => s.status === "done"))
    return "done";
  return "pending";
}
var UNIT_SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
function buildConstructionBolts(text, constructionStages, currentBolt) {
  const rosterMatch = text.match(PER_UNIT_RE);
  if (!rosterMatch)
    return;
  const roster = (rosterMatch[1] ?? "").split(",").map((u) => u.trim()).filter((u) => UNIT_SLUG_RE.test(u));
  if (roster.length === 0)
    return;
  const byBolt = new Map;
  for (const s of constructionStages) {
    if (s.bolt === undefined)
      continue;
    if (!byBolt.has(s.bolt))
      byBolt.set(s.bolt, []);
    byBolt.get(s.bolt)?.push(s);
  }
  return roster.map((unit) => {
    const stages = byBolt.get(unit) ?? [];
    const executable = stages.filter((s) => s.execute && s.status !== "skipped");
    return {
      unit,
      display: displayFromSlug(unit),
      status: boltStatusFromStages(stages),
      stages,
      done: executable.filter((s) => s.status === "done").length,
      total: executable.length,
      isCurrent: unit === currentBolt
    };
  });
}
function buildConstructionBatches(text, bolts) {
  const lineMatch = text.match(BOLT_BATCHES_RE);
  if (!lineMatch)
    return;
  const byUnit = new Map(bolts.map((b) => [b.unit, b]));
  const batches = [];
  const batchLine = lineMatch[1] ?? "";
  BATCH_GROUP_RE.lastIndex = 0;
  let m = BATCH_GROUP_RE.exec(batchLine);
  while (m !== null) {
    const label = m[1];
    const members = (m[2] ?? "").split(",").map((u) => u.trim()).filter((u) => u.length > 0).map((u) => byUnit.get(u)).filter((b) => b !== undefined);
    const allStages = members.flatMap((b) => b.stages);
    batches.push({
      label,
      units: members,
      status: boltStatusFromStages(allStages),
      done: members.reduce((n, b) => n + b.done, 0),
      total: members.reduce((n, b) => n + b.total, 0),
      isCurrent: members.some((b) => b.isCurrent)
    });
    m = BATCH_GROUP_RE.exec(batchLine);
  }
  return batches.length > 0 ? batches : undefined;
}
function parseState(text, catalogName) {
  const project = extractField(text, "Project");
  const projectType = extractField(text, "Project Type");
  const stateVersion = extractField(text, "State Version");
  const unitOwnership = extractField(text, "Unit Ownership");
  const constructionIteration = extractField(text, "Construction Iteration");
  const unitProgress = parseUnitProgress(text);
  const hasUnitProgress = unitProgress !== undefined;
  const scope = extractField(text, "Scope");
  const lifecyclePhase = extractField(text, "Lifecycle Phase");
  const currentStage = extractField(text, "Current Stage");
  const nextStage = extractField(text, "Next Stage");
  const status = extractField(text, "Status");
  const activeAgent = extractField(text, "Active Agent");
  const lastUpdated = extractField(text, "Last Updated");
  const revisionCount = extractField(text, "Revision Count");
  const currentBolt = extractField(text, "Current Bolt");
  const declared = parseDeclaredPhaseStatus(text);
  const stagesByPhase = parseStages(text, catalogName);
  const phases = [];
  let overallDone = 0;
  let overallTotal = 0;
  for (const key of PHASE_ORDER) {
    const stages = stagesByPhase.get(key) ?? [];
    if (stages.length === 0 && !(key in declared))
      continue;
    const executable = stages.filter((s) => s.execute && s.status !== "skipped");
    const total = executable.length;
    const done = executable.filter((s) => s.status === "done").length;
    const declaredStatus = declared[key] ?? "";
    const skipped = declaredStatus.toLowerCase() === "skipped" || total === 0 && stages.length > 0;
    overallDone += done;
    overallTotal += total;
    phases.push({
      key,
      display: PHASE_DISPLAY[key],
      declaredStatus,
      stages,
      done,
      total,
      pct: total > 0 ? Math.round(done * 100 / total) : null,
      skipped
    });
  }
  const overallPct = overallTotal > 0 ? Math.round(overallDone * 100 / overallTotal) : 0;
  const complete = status === "Completed" || status === "Complete";
  const constructionBolts = buildConstructionBolts(text, stagesByPhase.get("construction") ?? [], currentBolt);
  const constructionBatches = constructionBolts ? buildConstructionBatches(text, constructionBolts) : undefined;
  return {
    project,
    projectType,
    ...stateVersion ? { stateVersion } : {},
    ...unitOwnership ? { unitOwnership } : {},
    ...constructionIteration ? { constructionIteration } : {},
    hasUnitProgress,
    ...unitProgress ? { unitProgress } : {},
    scope,
    lifecyclePhase,
    currentStage,
    currentStageDisplay: stageDisplay(currentStage, catalogName),
    nextStage,
    status,
    activeAgent,
    activeAgentDisplay: AGENT_DISPLAY[activeAgent] ?? activeAgent,
    lastUpdated,
    revisionCount,
    phases,
    overallDone,
    overallTotal,
    overallPct,
    complete,
    ...constructionBolts ? { constructionBolts, currentBolt } : {},
    ...constructionBatches ? { constructionBatches } : {}
  };
}
function cellStatus(cell) {
  const m = /^\[(.)\]$/.exec(cell.trim());
  if (!m)
    return;
  return stageStatusFromBox(m[1] ?? " ", false);
}
function parseUnitProgress(text) {
  const head = /^##[ \t]+Unit Progress[ \t]*$/m.exec(text.replace(/\r\n/g, `
`));
  if (!head)
    return;
  const body = text.replace(/\r\n/g, `
`).slice(head.index + head[0].length);
  const section = body.split(/^## /m)[0] ?? "";
  const lines = section.split(`
`);
  const first = lines.findIndex((l) => l.startsWith("|"));
  if (first < 0)
    return { rows: [], stageColumns: [], malformed: true };
  const table = lines.slice(first).filter((l) => l.startsWith("|")).map((l) => l.split("|").slice(1, -1).map((c) => c.trim()));
  const header = table[0];
  const separator = table[1];
  if (!header || !separator || header[0]?.toLowerCase() !== "unit") {
    return { rows: [], stageColumns: [], malformed: true };
  }
  if (separator.length !== header.length)
    return { rows: [], stageColumns: [], malformed: true };
  const lower = header.map((h) => h.toLowerCase());
  const ownerAt = lower.indexOf("owner");
  const gateAt = lower.indexOf("gate");
  const mergedAt = lower.indexOf("merged");
  const stageAt = header.map((h, i) => ({ h, i })).filter(({ i }) => i !== 0 && i !== ownerAt && i !== gateAt && i !== mergedAt);
  const rows = [];
  for (const cells of table.slice(2)) {
    if (cells.length !== header.length)
      continue;
    if (cells.every((c) => /^-+$/.test(c)))
      continue;
    const unit = cells[0];
    if (!unit)
      continue;
    const stages = {};
    for (const { h, i } of stageAt) {
      const st = cellStatus(cells[i] ?? "");
      if (st)
        stages[h] = st;
    }
    const owner = ownerAt >= 0 ? cells[ownerAt] : undefined;
    const gate = gateAt >= 0 ? cellStatus(cells[gateAt] ?? "") : undefined;
    const merged = mergedAt >= 0 ? cells[mergedAt] : undefined;
    rows.push({
      unit,
      ...owner ? { owner } : {},
      stages,
      ...gate ? { gate } : {},
      ...merged ? { merged } : {}
    });
  }
  return { rows, stageColumns: stageAt.map(({ h }) => h), malformed: false };
}

// server/scan/stage-catalog.ts
import * as fs8 from "node:fs";
import * as path8 from "node:path";
var CATALOG_SUBPATH = path8.join("tools", "data", "stage-graph.json");
var KNOWN_HARNESS_DIRS = [".claude", ".kiro", ".aidlc"];
function isHarnessDirName(name) {
  return /^\.[a-z0-9][a-z0-9._-]*$/i.test(name);
}
function hasCatalog(root, harness) {
  try {
    return fs8.statSync(path8.join(root, harness, CATALOG_SUBPATH)).isFile();
  } catch {
    return false;
  }
}
function findHarnessDir(root) {
  for (const h of KNOWN_HARNESS_DIRS) {
    if (hasCatalog(root, h))
      return h;
  }
  let entries;
  try {
    entries = fs8.readdirSync(root, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (!e.isDirectory() || !isHarnessDirName(e.name))
      continue;
    if (KNOWN_HARNESS_DIRS.includes(e.name))
      continue;
    if (hasCatalog(root, e.name))
      return e.name;
  }
  return;
}
function harnessDirsWithCatalog(root) {
  const found = [];
  for (const h of KNOWN_HARNESS_DIRS) {
    if (hasCatalog(root, h))
      found.push(h);
  }
  let entries;
  try {
    entries = fs8.readdirSync(root, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const e of entries) {
    if (!e.isDirectory() || !isHarnessDirName(e.name))
      continue;
    if (KNOWN_HARNESS_DIRS.includes(e.name))
      continue;
    if (hasCatalog(root, e.name))
      found.push(e.name);
  }
  return found;
}
var STATE_VERSION_RE = /CURRENT_STATE_VERSION\s*(?::\s*[^=]+)?=\s*["'`](\d+)["'`]/;
function readHarnessStateVersion(root, harness) {
  try {
    const text = fs8.readFileSync(path8.join(root, harness, "tools", "aidlc-lib.ts"), "utf-8");
    return STATE_VERSION_RE.exec(text)?.[1];
  } catch {
    return;
  }
}
function asStringArray(v) {
  if (!Array.isArray(v))
    return [];
  return v.filter((x) => typeof x === "string");
}
function asKindMap(v) {
  if (typeof v !== "object" || v === null)
    return {};
  const out = {};
  for (const [k, val] of Object.entries(v)) {
    const kinds = asStringArray(val);
    if (kinds.length > 0)
      out[k] = kinds;
  }
  return out;
}
function readStageCatalog(root, harnessDir) {
  const harness = harnessDir ?? findHarnessDir(root);
  if (!harness)
    return;
  const sourcePath = path8.join(root, harness, CATALOG_SUBPATH);
  let raw;
  try {
    raw = fs8.readFileSync(sourcePath, "utf-8");
  } catch {
    return;
  }
  let doc;
  try {
    doc = JSON.parse(raw);
  } catch {
    return;
  }
  if (!Array.isArray(doc))
    return;
  const stages = [];
  for (const row of doc) {
    if (typeof row !== "object" || row === null)
      continue;
    const r = row;
    const slug = r.slug;
    if (typeof slug !== "string" || slug.length === 0)
      continue;
    stages.push({
      slug,
      number: typeof r.number === "string" ? r.number : "",
      name: typeof r.name === "string" ? r.name : slug,
      phase: typeof r.phase === "string" ? r.phase : "",
      produces: asStringArray(r.produces),
      optionalProduces: asStringArray(r.optional_produces),
      producesKinds: asKindMap(r.produces_kinds),
      forEach: typeof r.for_each === "string" ? r.for_each : undefined,
      sensors: asStringArray(r.sensors)
    });
  }
  if (stages.length === 0)
    return;
  return {
    stages,
    bySlug: new Map(stages.map((s) => [s.slug, s])),
    sourcePath,
    harnessDir: harness,
    ...(() => {
      const v = readHarnessStateVersion(root, harness);
      return v ? { stateVersion: v } : {};
    })()
  };
}
function applies(stage, artifact, kind) {
  const kinds = stage.producesKinds[artifact];
  if (!kinds)
    return true;
  return kind !== undefined && kinds.includes(kind);
}
function requiredArtifacts(stage, kind) {
  return stage.produces.filter((a) => applies(stage, a, kind));
}
function expectedArtifacts(stage, kind) {
  return [...stage.produces, ...stage.optionalProduces].filter((a) => applies(stage, a, kind));
}
function vacuouslyCovered(stage, kind) {
  if (stage.produces.length === 0)
    return false;
  return requiredArtifacts(stage, kind).length === 0;
}

// server/scan/unit-info.ts
import * as fs9 from "node:fs";
import * as path9 from "node:path";
var DESCRIPTION_LABEL = /^\*\*(?:Description|Mô tả|Summary|Purpose|Mục đích)\s*:?\*\*\s*:?\s*/i;
var TITLE_HEADER = /^(?:name|title|tên)$/i;
var COMPLEXITY_HEADER = /^(?:complexity|độ phức tạp|size)$/i;
var DIR_HEADER = /^(?:directory|dir|slug|thư mục)$/i;
var MAX_DESCRIPTION = 400;
function cells(line) {
  return line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
}
function bare(cell) {
  return cell.replace(/^`|`$/g, "").trim();
}
function clip(text) {
  const one = text.replace(/\s+/g, " ").trim();
  return one.length > MAX_DESCRIPTION ? `${one.slice(0, MAX_DESCRIPTION - 1)}…` : one;
}
function parseUnitInfo(text, slugs) {
  const out = {};
  const lines = text.split(/\r?\n/);
  const known = new Set(slugs);
  const entry = (slug) => {
    out[slug] ??= {};
    return out[slug];
  };
  for (let i = 0;i + 1 < lines.length; i++) {
    if (!lines[i].trim().startsWith("|") || !/^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1]))
      continue;
    const head = cells(lines[i]);
    const dirCol = head.findIndex((h) => DIR_HEADER.test(h));
    if (dirCol < 0)
      continue;
    const titleCol = head.findIndex((h) => TITLE_HEADER.test(h));
    const sizeCol = head.findIndex((h) => COMPLEXITY_HEADER.test(h));
    for (let j = i + 2;j < lines.length && lines[j].trim().startsWith("|"); j++) {
      const row = cells(lines[j]);
      const slug = bare(row[dirCol] ?? "");
      if (!known.has(slug))
        continue;
      const u = entry(slug);
      if (titleCol >= 0 && row[titleCol])
        u.title = bare(row[titleCol]);
      if (sizeCol >= 0 && row[sizeCol])
        u.complexity = bare(row[sizeCol]);
    }
    break;
  }
  let current;
  for (const line of lines) {
    if (/^#{2,4}\s/.test(line)) {
      current = slugs.find((s) => line.includes(s));
      continue;
    }
    if (!current || !DESCRIPTION_LABEL.test(line))
      continue;
    const u = entry(current);
    u.description ??= clip(line.replace(DESCRIPTION_LABEL, ""));
  }
  return out;
}
function readUnitInfo(recordDir, slugs) {
  if (slugs.length === 0)
    return {};
  try {
    const text = fs9.readFileSync(path9.join(recordDir, "inception", "units-generation", "unit-of-work.md"), "utf-8");
    return parseUnitInfo(text, slugs);
  } catch {
    return {};
  }
}

// server/scan/matrix.ts
var PER_UNIT_STAGE_SLUGS = new Set([
  "functional-design",
  "nfr-requirements",
  "nfr-design",
  "infrastructure-design",
  "code-generation"
]);
var UNIT_LIFECYCLE_EVENTS = new Set([
  "UNIT_STARTED",
  "UNIT_PAUSED",
  "UNIT_RESUMED",
  "UNIT_COMPLETED"
]);
var GLOBAL_BOUNDARY = new Set(["WORKFLOW_STARTED", "STAGE_JUMPED"]);
function gateStages(e) {
  const explicit = e.fields?.["Gate Stages"];
  if (explicit) {
    return explicit.split(",").map((v) => v.trim()).filter((v) => v.length > 0);
  }
  return e.stage ? [e.stage] : [];
}
function readUnitLifecycle(events, opts = {}) {
  const rows = events.map((e, i) => ({ e, i }));
  const lifecycle = rows.filter(({ e }) => !!e.stage && UNIT_LIFECYCLE_EVENTS.has(e.event) && !!e.unit);
  const inUse = new Set(lifecycle.map(({ e }) => e.stage));
  const pairs = new Map;
  for (const { e } of lifecycle) {
    pairs.set(`${e.stage}\x01${e.unit}`, { stage: e.stage, unit: e.unit });
  }
  const floorFor = (stage, unit) => {
    const boundary = rows.filter(({ e }) => {
      if (e.ts === undefined)
        return false;
      if (GLOBAL_BOUNDARY.has(e.event))
        return true;
      if (e.event === "GATE_REJECTED") {
        if (!gateStages(e).includes(stage))
          return false;
        const eventUnit = e.fields?.Unit;
        return eventUnit === undefined || eventUnit === unit;
      }
      return e.event === "STAGE_STARTED" && e.stage === stage && !opts.unitMajor && !e.fields?.Workflow?.startsWith("single-stage:");
    });
    if (boundary.length === 0)
      return "unstarted#0";
    const latestTs = boundary[boundary.length - 1].e.ts;
    const tied = boundary.filter(({ e }) => e.ts === latestTs);
    if (new Set(tied.map(({ e }) => e.shard)).size > 1)
      return null;
    const ordinals = new Map;
    let floor = "unstarted#0";
    for (const { e } of boundary) {
      const n = (ordinals.get(e.event) ?? 0) + 1;
      ordinals.set(e.event, n);
      floor = `${e.event}:${e.ts}#${n}`;
    }
    return floor;
  };
  const out = new Map;
  for (const [key, { stage, unit }] of pairs) {
    const floor = floorFor(stage, opts.teamOwnership ? unit : "");
    if (floor === null) {
      out.set(key, { state: "unverifiable", reason: "ambiguous-floor" });
      continue;
    }
    if (opts.teamOwnership) {
      out.set(key, { state: "unverifiable", reason: "team-claim" });
      continue;
    }
    const mine = lifecycle.filter(({ e }) => e.stage === stage && e.unit === unit);
    const current = mine.filter(({ e }) => e.fields?.["Run floor"] === floor);
    if (current.length === 0 && mine.some(({ e }) => e.fields?.["Run floor"] === undefined)) {
      out.set(key, { state: "unverifiable", reason: "no-run-floor" });
      continue;
    }
    if (current.some(({ e }) => e.fields?.Mode === "wave")) {
      out.set(key, { state: "unverifiable", reason: "wave-fingerprint" });
      continue;
    }
    const rank = (event) => event === "UNIT_PAUSED" ? 2 : event === "UNIT_COMPLETED" ? 0 : 1;
    const reduced = [];
    for (let a = 0;a < current.length; ) {
      let b = a + 1;
      while (b < current.length && current[b].e.ts === current[a].e.ts)
        b++;
      const byShard = new Map;
      for (const row of current.slice(a, b))
        byShard.set(row.e.shard ?? "", row);
      const candidates = [...byShard.values()];
      candidates.sort((x, y) => rank(x.e.event) - rank(y.e.event) || x.i - y.i);
      reduced.push(candidates[candidates.length - 1]);
      a = b;
    }
    let settled = false;
    for (const { e } of reduced)
      settled = e.event === "UNIT_COMPLETED";
    out.set(key, { state: settled ? "settled" : "unsettled" });
  }
  return {
    inUse: (slug) => inUse.has(slug),
    state: (unit, slug) => out.get(`${slug}\x01${unit}`) ?? { state: "unsettled" }
  };
}
function isPerUnitStage(slug, catalog) {
  const row = catalog?.bySlug.get(slug);
  if (row)
    return row.forEach === "unit-of-work";
  return PER_UNIT_STAGE_SLUGS.has(slug);
}
function parseBoltDag(graphText) {
  let doc;
  try {
    doc = JSON.parse(graphText);
  } catch {
    return;
  }
  if (typeof doc !== "object" || doc === null)
    return;
  const dag = doc.bolt_dag;
  if (typeof dag !== "object" || dag === null)
    return;
  const rawUnits = dag.units;
  if (!Array.isArray(rawUnits))
    return;
  const units = [];
  for (const u of rawUnits) {
    if (typeof u !== "object" || u === null)
      continue;
    const r = u;
    const name = r.name;
    if (typeof name !== "string" || name.length === 0)
      continue;
    units.push({
      name,
      display: displayFromSlug(name),
      kind: typeof r.kind === "string" ? r.kind : undefined,
      dependsOn: Array.isArray(r.depends_on) ? r.depends_on.filter((d) => typeof d === "string") : []
    });
  }
  if (units.length === 0)
    return;
  const rawBatches = dag.batches;
  const batches = Array.isArray(rawBatches) ? rawBatches.filter((b) => Array.isArray(b)).map((b) => b.filter((n) => typeof n === "string")) : [];
  return { units, batches };
}
function readSegment(recordDir, unit, stageSlug) {
  let entries;
  try {
    entries = fs10.readdirSync(path10.join(recordDir, "construction", unit, stageSlug), {
      withFileTypes: true
    });
  } catch {
    return [];
  }
  const bases = new Set;
  for (const e of entries) {
    if (!e.isFile() || e.name.startsWith("."))
      continue;
    const base = e.name.replace(/\.[^.]+$/, "");
    if (base.endsWith("-questions"))
      continue;
    bases.add(base);
  }
  return [...bases].sort();
}
function buildConstructionMatrix(dag, constructionStages, readUnitSegment, catalog, lifecycle, stateCompat) {
  if (dag.units.length === 0)
    return;
  let receiptsInForce = false;
  const stages = [];
  for (const st of constructionStages) {
    if (!isPerUnitStage(st.slug, catalog))
      continue;
    if (!st.execute) {
      stages.push({
        slug: st.slug,
        display: st.display,
        status: st.status,
        execute: false,
        cells: [],
        complete: 0,
        partial: 0,
        unsettled: 0,
        unverified: 0,
        notApplicable: 0,
        total: 0,
        provisional: false
      });
      continue;
    }
    const catStage = catalog?.bySlug.get(st.slug);
    const cells = dag.units.map((u) => {
      const present = readUnitSegment(u.name, st.slug);
      const required = catStage ? requiredArtifacts(catStage, u.kind) : [];
      const expected = catStage ? expectedArtifacts(catStage, u.kind) : [];
      const missing = required.filter((a) => !present.includes(a));
      const artifactsMet = present.length > 0 && missing.length === 0;
      const needsReceipt = lifecycle?.inUse(st.slug) === true;
      if (needsReceipt)
        receiptsInForce = true;
      const receipt = needsReceipt ? lifecycle?.state(u.name, st.slug) : undefined;
      const state = catStage !== undefined && u.kind !== undefined && vacuouslyCovered(catStage, u.kind) ? "n/a" : present.length === 0 ? "absent" : !artifactsMet ? "partial" : receipt?.state === "unsettled" ? "unsettled" : receipt?.state === "unverifiable" ? "unverified" : "complete";
      return {
        unit: u.name,
        state,
        present,
        expected,
        required,
        missing,
        ...receipt?.reason ? { receiptReason: receipt.reason } : {}
      };
    });
    const notApplicable = cells.filter((c) => c.state === "n/a").length;
    stages.push({
      slug: st.slug,
      display: st.display,
      status: st.status,
      execute: true,
      cells,
      complete: cells.filter((c) => c.state === "complete").length,
      partial: cells.filter((c) => c.state === "partial").length,
      unsettled: cells.filter((c) => c.state === "unsettled").length,
      unverified: cells.filter((c) => c.state === "unverified").length,
      notApplicable,
      total: dag.units.length,
      provisional: st.status !== "done" && st.status !== "skipped"
    });
  }
  if (stages.length === 0)
    return;
  return {
    units: dag.units,
    stages,
    batches: dag.batches,
    contractAware: catalog !== undefined,
    stateCompat: stateCompat ?? "unknown",
    receiptAware: receiptsInForce
  };
}
var RUNTIME_GRAPH_FILE = "runtime-graph.json";
function scanConstructionMatrix(recordDir, constructionStages, catalog, lifecycle, stateCompat) {
  let graphText;
  try {
    graphText = fs10.readFileSync(path10.join(recordDir, RUNTIME_GRAPH_FILE), "utf-8");
  } catch {
    return;
  }
  const dag = parseBoltDag(graphText);
  if (!dag)
    return;
  const matrix = buildConstructionMatrix(dag, constructionStages, (unit, slug) => readSegment(recordDir, unit, slug), catalog, lifecycle, stateCompat);
  if (!matrix)
    return;
  const info = readUnitInfo(recordDir, matrix.units.map((u) => u.name));
  return {
    ...matrix,
    units: matrix.units.map((u) => info[u.name] ? { ...u, info: info[u.name] } : u)
  };
}

// server/scan/memory-diary.ts
import * as fs11 from "node:fs";
import * as path11 from "node:path";
var HEADING_TO_AXIS = {
  interpretations: "interpretations",
  deviations: "deviations",
  tradeoffs: "tradeoffs",
  "open questions": "openQuestions"
};
var PHASE_DIRS2 = ["initialization", "ideation", "inception", "construction", "operation"];
var H2_RE = /^##\s+(.+?)\s*$/;
var BULLET_RE = /^[-*]\s+(?:(\d{4}-\d{2}-\d{2}T[\d:]+Z)\s*[—-]\s*)?(.*)$/;
var PLACEHOLDER_RE = /^(?:none|n\/a|not applicable|없음|해당 없음)[.!。]?$/i;
var RESOLVED_RE = /^\s*(?:\[\s*)?(?:\(\s*)?(?:해소됨|해결됨|resolved|closed)(?:\s|\)|\]|:|—|-|$)/i;
var FOLLOW_UP_RE = /\?\s*$|(?:확인|확정|결정|정합|합류|처리|적용|구현|추가|재검토)\s*필요|필요(?:함|하다|할|가| 여부|$)|미결|미정(?!의)|이월|후속|남아|대기 중|해야\s*함|\b(?:todo|tbd|pending)\b/i;
function emptyCounts() {
  return { interpretations: 0, deviations: 0, tradeoffs: 0, openQuestions: 0 };
}
function axisFromHeading(raw) {
  const heading = raw.trim().toLowerCase();
  for (const [canonical, axis] of Object.entries(HEADING_TO_AXIS)) {
    if (heading === canonical || heading.startsWith(`${canonical} (`))
      return axis;
  }
  return;
}
function questionStatus(text) {
  if (RESOLVED_RE.test(text))
    return "resolved";
  if (FOLLOW_UP_RE.test(text))
    return "followUp";
  return "note";
}
function parseDiary(text) {
  const out = [];
  let axis;
  for (const line of text.replace(/\r\n/g, `
`).split(`
`)) {
    const h = H2_RE.exec(line);
    if (h) {
      axis = axisFromHeading(h[1]);
      continue;
    }
    if (!axis)
      continue;
    const b = BULLET_RE.exec(line);
    if (!b)
      continue;
    const body = (b[2] ?? "").trim();
    if (body.length === 0 || PLACEHOLDER_RE.test(body))
      continue;
    out.push({
      axis,
      ts: b[1],
      text: body,
      questionStatus: axis === "openQuestions" ? questionStatus(body) : undefined
    });
  }
  return out;
}
function recordKey(record, includeUnit) {
  const text = record.text.replace(/\s+/g, " ").trim().toLocaleLowerCase();
  return [
    record.axis,
    record.stage.toLocaleLowerCase(),
    includeUnit ? record.unit ?? "" : "",
    text
  ].join("\x00");
}
function normalizeRecords(stages) {
  const all = stages.flatMap((stage) => stage.entries.map((entry) => ({
    ...entry,
    rel: stage.rel,
    phase: stage.phase,
    stage: stage.stage,
    unit: stage.unit
  })));
  const unitKeys = new Set(all.filter((record) => record.unit).map((record) => recordKey(record, false)));
  const unique = new Map;
  for (const record of all) {
    if (!record.unit && unitKeys.has(recordKey(record, false)))
      continue;
    const key = recordKey(record, true);
    const previous = unique.get(key);
    if (!previous || (record.ts ?? "") > (previous.ts ?? ""))
      unique.set(key, record);
  }
  return [...unique.values()].sort((a, b) => {
    const byTime = (a.ts ?? "").localeCompare(b.ts ?? "");
    if (byTime !== 0)
      return byTime;
    return `${a.stage}/${a.unit ?? ""}/${a.text}`.localeCompare(`${b.stage}/${b.unit ?? ""}/${b.text}`);
  });
}
function isDir2(p) {
  try {
    return fs11.statSync(p).isDirectory();
  } catch {
    return false;
  }
}
function readOne(recordDir, relParts, phase, stage, unit) {
  const abs = path11.join(recordDir, ...relParts, "memory.md");
  let text;
  try {
    text = fs11.readFileSync(abs, "utf-8");
  } catch {
    return;
  }
  const entries = parseDiary(text);
  const counts = emptyCounts();
  for (const e of entries)
    counts[e.axis]++;
  return {
    rel: [...relParts, "memory.md"].join("/"),
    phase,
    stage,
    unit,
    counts,
    total: entries.length,
    entries
  };
}
function readDiaries(recordDir) {
  const stages = [];
  for (const phase of PHASE_DIRS2) {
    const phaseAbs = path11.join(recordDir, phase);
    if (!isDir2(phaseAbs))
      continue;
    let children;
    try {
      children = fs11.readdirSync(phaseAbs);
    } catch {
      continue;
    }
    for (const child of children.sort()) {
      const childAbs = path11.join(phaseAbs, child);
      if (!isDir2(childAbs))
        continue;
      let grandchildren = [];
      try {
        grandchildren = fs11.readdirSync(childAbs);
      } catch {}
      const stageSubdirs = grandchildren.filter((g) => isDir2(path11.join(childAbs, g)));
      if (stageSubdirs.length > 0) {
        for (const stage of stageSubdirs.sort()) {
          const d = readOne(recordDir, [phase, child, stage], phase, stage, child);
          if (d)
            stages.push(d);
        }
      }
      const own = readOne(recordDir, [phase, child], phase, child, undefined);
      if (own)
        stages.push(own);
    }
  }
  const records = normalizeRecords(stages);
  const totals = emptyCounts();
  for (const record of records)
    totals[record.axis]++;
  return {
    stages,
    records,
    totals,
    totalEntries: records.length
  };
}

// server/scan/outcomes.ts
import * as fs13 from "node:fs";

// server/scan/open-file.ts
import * as fs12 from "node:fs";
import * as path12 from "node:path";
var ALLOWED_EXT = new Set([".md", ".html", ".json"]);
function resolveArtifact(recordDir, rel) {
  if (!rel || rel.length > 512)
    return { ok: false, refusal: { code: "bad-rel" }, status: 400 };
  if (rel.includes("\x00"))
    return { ok: false, refusal: { code: "bad-chars" }, status: 400 };
  const base = path12.resolve(recordDir);
  const abs = path12.resolve(base, rel);
  if (abs !== base && !abs.startsWith(base + path12.sep)) {
    return { ok: false, refusal: { code: "outside-record" }, status: 403 };
  }
  if (!ALLOWED_EXT.has(path12.extname(abs).toLowerCase())) {
    return { ok: false, refusal: { code: "extension", allowed: [...ALLOWED_EXT] }, status: 403 };
  }
  let real;
  try {
    real = fs12.realpathSync(abs);
  } catch {
    return { ok: false, refusal: { code: "not-found" }, status: 404 };
  }
  const realBase = (() => {
    try {
      return fs12.realpathSync(base);
    } catch {
      return base;
    }
  })();
  if (real !== realBase && !real.startsWith(realBase + path12.sep)) {
    return { ok: false, refusal: { code: "symlink-escape" }, status: 403 };
  }
  let st;
  try {
    st = fs12.statSync(real);
  } catch {
    return { ok: false, refusal: { code: "stat-failed" }, status: 404 };
  }
  if (!st.isFile())
    return { ok: false, refusal: { code: "not-a-file" }, status: 403 };
  return { ok: true, real };
}

// server/scan/outcomes.ts
var OUTCOMES_REL = "OUTCOMES.md";
function artifactBase(root, recordDir, rel) {
  if (rel !== OUTCOMES_REL || resolveArtifact(recordDir, rel).ok)
    return recordDir;
  return resolveArtifact(root, rel).ok ? root : recordDir;
}
function readOutcomes(root, recordDir) {
  const base = artifactBase(root, recordDir, OUTCOMES_REL);
  const jailed = resolveArtifact(base, OUTCOMES_REL);
  if (!jailed.ok)
    return null;
  try {
    const st = fs13.statSync(jailed.real);
    return {
      rel: OUTCOMES_REL,
      where: base === recordDir ? "record" : "workspace",
      sizeBytes: st.size,
      modifiedAt: st.mtime.toISOString()
    };
  } catch {
    return null;
  }
}

// server/scan/questions.ts
import * as fs14 from "node:fs";
import * as path13 from "node:path";
var PHASE_DIRS3 = ["initialization", "ideation", "inception", "construction", "operation"];
var H2_RE2 = /^##\s/;
var QUESTION_HEADING_RE = /^##\s+\[?([QF]\d+(?:-?[A-Za-z0-9]+)?)\]?(?:$|[\s.:\]])/;
var H2_TITLE_RE = /^##\s+(.+?)\s*$/;
var GATE_HEADINGS = new Set([
  "consolidated summary confirmation",
  "assumption confirmation",
  "requested changes feedback"
]);
var ANSWER_RE = /^\[Answer\]:[ \t]*(.*)$/;
function parseQuestions(text) {
  const spans = [];
  let current;
  for (const line of text.replace(/\r\n/g, `
`).split(`
`)) {
    if (H2_RE2.test(line)) {
      const title = (H2_TITLE_RE.exec(line)?.[1] ?? "").trim();
      const kind = QUESTION_HEADING_RE.test(line) ? "question" : GATE_HEADINGS.has(title.toLowerCase()) ? "confirmation" : undefined;
      current = kind ? { heading: title, markers: [], kind } : undefined;
      if (current)
        spans.push(current);
      continue;
    }
    if (!current)
      continue;
    const a = ANSWER_RE.exec(line);
    if (a)
      current.markers.push((a[1] ?? "").trim());
  }
  return spans.filter((s) => s.markers.length > 0).map((s) => {
    const answer = s.markers.find((m) => m.length > 0) ?? "";
    return { heading: s.heading, answer, answered: answer.length > 0, kind: s.kind };
  });
}
function statMtime2(p) {
  try {
    return fs14.statSync(p).mtime.toISOString().replace(/\.\d{3}Z$/, "Z");
  } catch {
    return "";
  }
}
function readFileEntry(recordDir, relParts, phase, stage, unit) {
  const abs = path13.join(recordDir, ...relParts);
  let text;
  try {
    text = fs14.readFileSync(abs, "utf-8");
  } catch {
    return;
  }
  const questions = parseQuestions(text);
  return {
    rel: relParts.join("/"),
    phase,
    stage,
    unit,
    questions,
    unanswered: questions.filter((q) => !q.answered),
    mtime: statMtime2(abs)
  };
}
function scanStageDir(recordDir, relParts, phase, stage, unit, into) {
  let entries;
  try {
    entries = fs14.readdirSync(path13.join(recordDir, ...relParts));
  } catch {
    return;
  }
  for (const f of entries) {
    if (!f.endsWith("-questions.md"))
      continue;
    const e = readFileEntry(recordDir, [...relParts, f], phase, stage, unit);
    if (e)
      into.push(e);
  }
}
function isDir3(p) {
  try {
    return fs14.statSync(p).isDirectory();
  } catch {
    return false;
  }
}
function readQuestions(recordDir) {
  const files = [];
  for (const phase of PHASE_DIRS3) {
    const phaseAbs = path13.join(recordDir, phase);
    if (!isDir3(phaseAbs))
      continue;
    let children;
    try {
      children = fs14.readdirSync(phaseAbs);
    } catch {
      continue;
    }
    for (const child of children.sort()) {
      const childAbs = path13.join(phaseAbs, child);
      if (!isDir3(childAbs))
        continue;
      let grandchildren = [];
      try {
        grandchildren = fs14.readdirSync(childAbs);
      } catch {}
      const stageSubdirs = grandchildren.filter((g) => isDir3(path13.join(childAbs, g)));
      if (stageSubdirs.length > 0) {
        for (const stage of stageSubdirs.sort()) {
          scanStageDir(recordDir, [phase, child, stage], phase, stage, child, files);
        }
        scanStageDir(recordDir, [phase, child], phase, child, undefined, files);
      } else {
        scanStageDir(recordDir, [phase, child], phase, child, undefined, files);
      }
    }
  }
  const blocked = files.filter((f) => f.unanswered.length > 0).sort((a, b) => a.mtime > b.mtime ? -1 : a.mtime < b.mtime ? 1 : 0);
  return {
    files,
    blocked,
    totalQuestions: files.reduce((n, f) => n + f.questions.length, 0),
    totalUnanswered: files.reduce((n, f) => n + f.unanswered.length, 0)
  };
}

// server/scan/resolve.ts
import * as fs15 from "node:fs";
import * as path14 from "node:path";
var ACTIVE_SPACE_POINTER = "active-space";
var ACTIVE_INTENT_POINTER = "active-intent";
var DEFAULT_SPACE = "default";
var STATE_FILE = "aidlc-state.md";
var ACTIVE_SPACE_GLOB = `aidlc/${ACTIVE_SPACE_POINTER}`;
var ACTIVE_INTENT_GLOB = `aidlc/spaces/*/intents/${ACTIVE_INTENT_POINTER}`;
function readCursor(file) {
  try {
    const raw = fs15.readFileSync(file, "utf-8").trim();
    return raw;
  } catch {
    return "";
  }
}
function activeSpace(rootFs) {
  const raw = readCursor(path14.join(rootFs, "aidlc", ACTIVE_SPACE_POINTER));
  return raw.length > 0 ? raw : DEFAULT_SPACE;
}
function hasState(recordDir) {
  try {
    return fs15.existsSync(path14.join(recordDir, STATE_FILE));
  } catch {
    return false;
  }
}
function listIntentDirs(intentsDir) {
  let entries;
  try {
    entries = fs15.readdirSync(intentsDir);
  } catch {
    return [];
  }
  return entries.filter((name) => hasState(path14.join(intentsDir, name))).sort();
}
function resolveState(rootFs) {
  const space = activeSpace(rootFs);
  const intentsDir = path14.join(rootFs, "aidlc", "spaces", space, "intents");
  const rel = (record) => `aidlc/spaces/${space}/intents/${record}/${STATE_FILE}`;
  const cursor = readCursor(path14.join(intentsDir, ACTIVE_INTENT_POINTER));
  if (cursor.length > 0 && hasState(path14.join(intentsDir, cursor))) {
    return { kind: "ok", rel: rel(cursor) };
  }
  const records = listIntentDirs(intentsDir);
  if (records.length === 1)
    return { kind: "ok", rel: rel(records[0]) };
  if (records.length === 0)
    return { kind: "none" };
  return { kind: "ambiguous" };
}

// server/scan/rework.ts
var MAX_FEEDBACK = 6;
function buildRework(ledger) {
  const submissions = new Map;
  const rejections = new Map;
  const revisions = new Map;
  const revisionHigh = new Map;
  const approvals = new Map;
  const feedback = new Map;
  const lastSeen = new Map;
  const bump = (m, k) => {
    m.set(k, (m.get(k) ?? 0) + 1);
  };
  const push = (m, k, v) => {
    const list = m.get(k);
    if (list)
      list.push(v);
    else
      m.set(k, [v]);
  };
  for (const e of ledger.events) {
    const stage = e.stage;
    if (!stage)
      continue;
    lastSeen.set(stage, e.ts);
    if (e.event === "STAGE_AWAITING_APPROVAL")
      bump(submissions, stage);
    else if (e.event === "GATE_APPROVED")
      push(approvals, stage, e.ts);
    else if (e.event === "GATE_REJECTED") {
      push(rejections, stage, e.ts);
      const text = e.fields.Feedback?.trim();
      if (text) {
        const list = feedback.get(stage) ?? [];
        list.push({ at: e.ts, text });
        feedback.set(stage, list);
      }
    } else if (e.event === "STAGE_REVISING") {
      bump(revisions, stage);
      const raw = e.fields["Revision count"];
      if (raw && /^\d+$/.test(raw.trim())) {
        const n = Number(raw.trim());
        if (n > (revisionHigh.get(stage) ?? 0))
          revisionHigh.set(stage, n);
      }
      const text = e.fields.Feedback?.trim();
      if (text && !(feedback.get(stage) ?? []).some((f) => f.text === text)) {
        const list = feedback.get(stage) ?? [];
        list.push({ at: e.ts, text });
        feedback.set(stage, list);
      }
    }
  }
  const stages = [];
  for (const [stage, rejectedAt] of rejections) {
    const first = rejectedAt[0];
    const last = rejectedAt[rejectedAt.length - 1];
    const after = (approvals.get(stage) ?? []).filter((ts) => ts > last);
    const settled = after.length > 0;
    const end = settled ? after[after.length - 1] : lastSeen.get(stage) ?? last;
    const reworkSec = Math.max(0, (Date.parse(end) - Date.parse(first)) / 1000);
    const high = revisionHigh.get(stage);
    stages.push({
      stage,
      submissions: submissions.get(stage) ?? 0,
      rejections: rejectedAt.length,
      revisions: revisions.get(stage) ?? 0,
      ...high === undefined ? {} : { revisionHigh: high },
      firstRejectedAt: first,
      reworkSec: Number.isFinite(reworkSec) ? reworkSec : 0,
      settled,
      feedback: (feedback.get(stage) ?? []).slice().reverse().slice(0, MAX_FEEDBACK)
    });
  }
  stages.sort((a, b) => b.reworkSec - a.reworkSec);
  const n = (k) => ledger.counts.get(k) ?? 0;
  return {
    stages,
    approved: n("GATE_APPROVED"),
    rejected: n("GATE_REJECTED"),
    revisions: n("STAGE_REVISING"),
    jumps: n("STAGE_JUMPED"),
    freezeBlocked: n("REVIEW_FREEZE_BLOCKED"),
    reworkSec: stages.reduce((sum, s) => sum + s.reworkSec, 0),
    provisional: stages.some((s) => !s.settled)
  };
}

// server/scan/sensors.ts
import * as fs16 from "node:fs";
import * as path15 from "node:path";
var FIELD_RE2 = /^\*\*([^*]+)\*\*:[ \t]*(.*)$/;
var NOT_FINDINGS = new Set([
  "pass",
  "findings_count",
  "errors",
  "unreferenced",
  "reason",
  "scanned_files",
  "consumes",
  "headings",
  "template",
  "template_expected",
  "questions_file"
]);
var FACT_ITEMS = 8;
function findingFacts(j) {
  const out = [];
  for (const [key, v] of Object.entries(j)) {
    if (NOT_FINDINGS.has(key))
      continue;
    if (Array.isArray(v)) {
      const items = v.filter((x) => typeof x === "string" && x.trim().length > 0);
      if (items.length === 0)
        continue;
      out.push({
        key,
        items: items.slice(0, FACT_ITEMS),
        more: items.length > FACT_ITEMS ? items.length - FACT_ITEMS : undefined
      });
    } else if (typeof v === "number") {
      if (v === 0)
        out.push({ key, value: "0" });
    } else if (typeof v === "string") {
      const s = v.trim();
      if (s && s.toLowerCase() !== "ok")
        out.push({ key, value: s });
    }
  }
  return out;
}
function parseSensorDetail(text, fileName, stage) {
  const fields = {};
  for (const line of text.replace(/\r\n/g, `
`).split(`
`)) {
    const m = FIELD_RE2.exec(line);
    if (m)
      fields[m[1]] = (m[2] ?? "").trim();
    if (line.startsWith("## Findings"))
      break;
  }
  const base = fileName.endsWith(".md") ? fileName.slice(0, -3) : fileName;
  const cut = base.lastIndexOf("-");
  if (cut <= 0)
    return;
  const sensorId = base.slice(0, cut);
  const fireId = fields["Fire id"] || base.slice(cut + 1);
  const errors = [];
  const unreferenced = [];
  let findingsCount;
  let reason;
  let facts = [];
  const fence = /```json\n([\s\S]*?)\n```/.exec(text);
  if (fence) {
    try {
      const j = JSON.parse(fence[1] ?? "");
      if (typeof j.findings_count === "number")
        findingsCount = j.findings_count;
      if (Array.isArray(j.errors)) {
        for (const e of j.errors) {
          if (typeof e !== "object" || e === null)
            continue;
          const r = e;
          if (typeof r.file !== "string" || typeof r.message !== "string")
            continue;
          errors.push({
            file: r.file,
            line: typeof r.line === "number" ? r.line : undefined,
            column: typeof r.column === "number" ? r.column : undefined,
            message: r.message
          });
        }
      }
      if (Array.isArray(j.unreferenced)) {
        for (const u of j.unreferenced)
          if (typeof u === "string")
            unreferenced.push(u);
      }
      if (typeof j.reason === "string" && j.reason.trim())
        reason = j.reason.trim();
      facts = findingFacts(j);
    } catch {}
  }
  return {
    fireId,
    sensorId,
    stage,
    ts: fields.Timestamp,
    outputPath: fields["Output path"],
    findingsCount,
    errors,
    unreferenced,
    reason,
    facts,
    file: fileName
  };
}
function readDetailBodies(recordDir) {
  const out = new Map;
  const root = engineReadDir(recordDir, "sensors", ".aidlc-sensors");
  let stageDirs;
  try {
    stageDirs = fs16.readdirSync(root);
  } catch {
    return out;
  }
  for (const stage of stageDirs) {
    let files;
    try {
      files = fs16.readdirSync(path15.join(root, stage));
    } catch {
      continue;
    }
    for (const f of files) {
      if (!f.endsWith(".md"))
        continue;
      let text;
      try {
        text = fs16.readFileSync(path15.join(root, stage, f), "utf-8");
      } catch {
        continue;
      }
      const body = parseSensorDetail(text, f, stage);
      if (body)
        out.set(body.fireId, body);
    }
  }
  return out;
}
function readSensorReport(recordDir, ledger) {
  const bodies = readDetailBodies(recordDir);
  const claimed = new Set;
  const perStage = new Map;
  const stageOf = (stage) => {
    let s = perStage.get(stage);
    if (!s) {
      s = { stage, fired: 0, passed: 0, failed: 0, budgetOverride: 0, pending: 0, byId: new Map };
      perStage.set(stage, s);
    }
    return s;
  };
  const terminal = new Map;
  for (const e of ledger.events) {
    if (e.event === "SENSOR_PASSED" || e.event === "SENSOR_FAILED" || e.event === "SENSOR_BUDGET_OVERRIDE") {
      const fid = e.fields["Fire id"];
      if (fid)
        terminal.set(fid, e.event);
    }
  }
  const failures = [];
  for (const e of ledger.events) {
    if (e.event === "SENSOR_FIRED") {
      const stage = e.stage ?? "(unattributed)";
      const s = stageOf(stage);
      s.fired++;
      const id = e.fields["Sensor ID"] ?? "(unknown)";
      s.byId.set(id, (s.byId.get(id) ?? 0) + 1);
      const fid = e.fields["Fire id"];
      const t = fid ? terminal.get(fid) : undefined;
      if (t === "SENSOR_PASSED")
        s.passed++;
      else if (t === "SENSOR_FAILED")
        s.failed++;
      else if (t === "SENSOR_BUDGET_OVERRIDE")
        s.budgetOverride++;
      else
        s.pending++;
      continue;
    }
    if (e.event !== "SENSOR_FAILED")
      continue;
    const fireId = e.fields["Fire id"] ?? "";
    const body = fireId ? bodies.get(fireId) : undefined;
    if (body)
      claimed.add(fireId);
    const countRaw = e.fields["Findings count"];
    failures.push({
      id: e.fields["Sensor ID"] ?? body?.sensorId ?? "(unknown)",
      stage: e.stage ?? body?.stage ?? "(unattributed)",
      fireId,
      ts: e.ts,
      outputPath: body?.outputPath,
      findingsCount: body?.findingsCount ?? (countRaw && /^\d+$/.test(countRaw) ? Number(countRaw) : undefined),
      errors: body?.errors ?? [],
      unreferenced: body?.unreferenced ?? [],
      reason: body?.reason,
      facts: body?.facts ?? [],
      detailFile: body?.file
    });
  }
  failures.reverse();
  const stages = [...perStage.values()];
  return {
    stages,
    failures,
    totalFired: stages.reduce((n, s) => n + s.fired, 0),
    totalPassed: stages.reduce((n, s) => n + s.passed, 0),
    totalFailed: stages.reduce((n, s) => n + s.failed, 0),
    orphanDetailFiles: [...bodies.keys()].filter((k) => !claimed.has(k)).length,
    failuresWithoutBody: failures.filter((f) => f.detailFile === undefined).length
  };
}

// server/scan/timing.ts
var GATE_OPEN = new Set([
  "DECISION_RECORDED",
  "QUESTION_ASKED",
  "GATE_OPENED",
  "STAGE_AWAITING_APPROVAL"
]);
var GATE_CLOSE = new Set([
  "HUMAN_TURN",
  "QUESTION_ANSWERED",
  "SUMMARY_CONFIRMATION_RECORDED",
  "GATE_APPROVED",
  "GATE_REJECTED"
]);
var SESSION_RESUME = new Set([
  "GUARDRAIL_LOADED",
  "HEALTH_CHECKED",
  "SESSION_STARTED",
  "SESSION_RESUMED"
]);
var AGENT_OPEN = new Set(["REVIEW_REQUESTED", "SUBAGENT_DISPATCHED", "MERGE_DISPATCH"]);
var AGENT_CLOSE = new Set(["SUBAGENT_COMPLETED", "REVIEW_COMPLETED"]);
var IDLE_FLOOR_SEC = 60;
var SUSPECT_SEC = 300;
var BIN_SEC = 6 * 3600;
function secs(a, b) {
  return (Date.parse(b) - Date.parse(a)) / 1000;
}
function classifyGaps(events, onGap) {
  let humanWaitSec = 0;
  let parkedSec = 0;
  let inferredParkSec = 0;
  let observedSec = 0;
  let conversationSec = 0;
  let unknownSec = 0;
  let delegatedSec = 0;
  let parkAnomalies = 0;
  const parkedShards = new Set;
  const unknown = [];
  const firstIdx = new Map;
  const lastIdx = new Map;
  events.forEach((event, i) => {
    if (!firstIdx.has(event.shard))
      firstIdx.set(event.shard, i);
    lastIdx.set(event.shard, i);
  });
  const presentAt = (i) => {
    const out = [];
    for (const [shard, first] of firstIdx) {
      if (first <= i && (lastIdx.get(shard) ?? -1) >= i + 1)
        out.push(shard);
    }
    return out;
  };
  const delegatedGaps = new Set;
  const openDelegation = new Map;
  events.forEach((event, i) => {
    if (AGENT_OPEN.has(event.event)) {
      if (!openDelegation.has(event.shard))
        openDelegation.set(event.shard, i);
    } else if (AGENT_CLOSE.has(event.event)) {
      const from = openDelegation.get(event.shard);
      if (from !== undefined) {
        for (let g = from;g < i; g++)
          delegatedGaps.add(g);
        openDelegation.delete(event.shard);
      }
    }
  });
  for (let i = 0;i < events.length - 1; i++) {
    const a = events[i];
    const b = events[i + 1];
    const gap = secs(a.ts, b.ts);
    if (!Number.isFinite(gap) || gap <= 0)
      continue;
    if (a.event === "WORKFLOW_PARKED") {
      if (parkedShards.has(a.shard))
        parkAnomalies++;
      parkedShards.add(a.shard);
    } else if (a.event === "WORKFLOW_UNPARKED") {
      if (!parkedShards.has(a.shard))
        parkAnomalies++;
      parkedShards.delete(a.shard);
    }
    const present = presentAt(i);
    const parkedPresent = present.filter((shard) => parkedShards.has(shard));
    let bucket;
    if (present.length > 0 && parkedPresent.length === present.length) {
      parkedSec += gap;
      bucket = "parked";
    } else if (GATE_OPEN.has(a.event) && GATE_CLOSE.has(b.event) && gap >= IDLE_FLOOR_SEC) {
      humanWaitSec += gap;
      bucket = "humanWait";
    } else if (SESSION_RESUME.has(b.event) && gap >= IDLE_FLOOR_SEC) {
      parkedSec += gap;
      inferredParkSec += gap;
      bucket = "parked";
    } else if (delegatedGaps.has(i)) {
      delegatedSec += gap;
      observedSec += gap;
      bucket = "observed";
    } else if (a.event === "HUMAN_TURN" && b.event === "HUMAN_TURN" && a.shard === b.shard) {
      conversationSec += gap;
      bucket = "conversation";
    } else if (gap >= SUSPECT_SEC) {
      unknownSec += gap;
      unknown.push({ seconds: gap, fromEvent: a.event, toEvent: b.event, at: a.ts });
      bucket = "unknown";
    } else {
      observedSec += gap;
      bucket = "observed";
    }
    onGap?.(a.ts, b.ts, bucket);
  }
  const idleSec = humanWaitSec + parkedSec;
  const workSec = observedSec + unknownSec;
  return {
    humanWaitSec,
    parkedSec,
    inferredParkSec,
    observedSec,
    conversationSec,
    unknownSec,
    delegatedSec,
    parkAnomalies,
    unknown,
    idleSec,
    agentSec: delegatedSec,
    workSec,
    suspect: unknown
  };
}
function emptyWorkload() {
  return { artifacts: 0, sensors: 0, sensorFailures: 0, delegations: 0, humanTurns: 0 };
}
function shardLabel(shard) {
  const base = shard.endsWith(".md") ? shard.slice(0, -3) : shard;
  const noClone = base.replace(/-[0-9a-f]{12}$/i, "");
  return noClone.replace(/-(?=[a-z]*\d)[a-z0-9]{8,}$/i, "");
}
function topKeys(counts, limit) {
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([k]) => k);
}
function buildWorkers(events) {
  const byShard = new Map;
  for (const e of events) {
    const list = byShard.get(e.shard);
    if (list)
      list.push(e);
    else
      byShard.set(e.shard, [e]);
  }
  const out = [];
  for (const [shard, evs] of byShard) {
    const split = classifyGaps(evs);
    const stages = new Map;
    const units = new Map;
    let gatesApproved = 0;
    let stagesCompleted = 0;
    let endedParked = false;
    for (const e of evs) {
      if (e.stage)
        stages.set(e.stage, (stages.get(e.stage) ?? 0) + 1);
      if (e.unit)
        units.set(e.unit, (units.get(e.unit) ?? 0) + 1);
      if (e.event === "GATE_APPROVED")
        gatesApproved++;
      else if (e.event === "STAGE_COMPLETED")
        stagesCompleted++;
      else if (e.event === "WORKFLOW_PARKED")
        endedParked = true;
      else if (e.event === "WORKFLOW_UNPARKED")
        endedParked = false;
    }
    const firstTs = evs[0].ts;
    const lastTs = evs[evs.length - 1].ts;
    out.push({
      shard,
      label: shardLabel(shard),
      cloneId: /-([0-9a-f]{12})\.md$/.exec(shard)?.[1],
      endedParked,
      events: evs.length,
      firstTs,
      lastTs,
      elapsedSec: secs(firstTs, lastTs),
      humanWaitSec: split.humanWaitSec,
      parkedSec: split.parkedSec,
      observedSec: split.observedSec,
      conversationSec: split.conversationSec,
      unknownSec: split.unknownSec,
      delegatedSec: split.delegatedSec,
      idleSec: split.idleSec,
      agentSec: split.agentSec,
      workSec: split.workSec,
      gatesApproved,
      stagesCompleted,
      stages: topKeys(stages, 4),
      units: topKeys(units, 12)
    });
  }
  return out.sort((a, b) => b.events - a.events);
}
function binFloor(ms) {
  const d = new Date(ms);
  d.setHours(d.getHours() - d.getHours() % (BIN_SEC / 3600), 0, 0, 0);
  return d.getTime();
}
var BUCKET_FIELD = {
  humanWait: "humanWaitSec",
  parked: "parkedSec",
  observed: "observedSec",
  conversation: "conversationSec",
  unknown: "unknownSec"
};
function buildBins(gaps, firstTs, endTs) {
  const start = binFloor(Date.parse(firstTs));
  const end = Date.parse(endTs);
  if (!Number.isFinite(start) || !Number.isFinite(end))
    return [];
  const width = BIN_SEC * 1000;
  const bins = [];
  for (let at = start;at < end || bins.length === 0; at += width) {
    bins.push({
      start: new Date(at).toISOString(),
      humanWaitSec: 0,
      parkedSec: 0,
      observedSec: 0,
      conversationSec: 0,
      unknownSec: 0
    });
  }
  for (const g of gaps) {
    const from = Date.parse(g.from);
    const to = Date.parse(g.to);
    const field = BUCKET_FIELD[g.bucket];
    const first = Math.max(0, Math.floor((from - start) / width));
    for (let k = first;k < bins.length; k++) {
      const lo = Math.max(from, start + k * width);
      const hi = Math.min(to, start + (k + 1) * width);
      if (hi <= lo)
        break;
      bins[k][field] += (hi - lo) / 1000;
    }
  }
  return bins;
}
function buildTiming(ledger, nowTs) {
  if (ledger.events.length === 0) {
    return {
      stages: [],
      total: classifyGaps([]),
      sinceLastEventSec: 0,
      elapsedSec: 0,
      bins: [],
      workers: [],
      parallel: false,
      clones: 0,
      overlapSec: 0,
      handoverSec: 0,
      personIdleSec: 0,
      personWorkSec: 0,
      personHumanWaitSec: 0,
      personParkedSec: 0,
      personObservedSec: 0,
      personConversationSec: 0,
      personUnknownSec: 0,
      personElapsedSec: 0
    };
  }
  const all = ledger.events;
  const startIndex = all.findIndex((e) => e.event === "WORKFLOW_STARTED");
  const from = startIndex >= 0 ? startIndex : 0;
  const completedIndex = all.findLastIndex((e, i) => i >= from && e.event === "WORKFLOW_COMPLETED");
  const actual = all.slice(from, completedIndex >= 0 ? completedIndex + 1 : undefined);
  const firstTs = actual[0].ts;
  const lastActualTs = actual[actual.length - 1].ts;
  const requestedEnd = completedIndex >= 0 ? lastActualTs : nowTs ?? lastActualTs;
  const endTs = Date.parse(requestedEnd) >= Date.parse(lastActualTs) ? requestedEnd : lastActualTs;
  const open = new Map;
  const raw = new Map;
  const finalKind = new Map;
  const order = [];
  let awaitingStage;
  const close = (stage, endedAt, endKind) => {
    const current = open.get(stage);
    if (!current)
      return;
    const list = raw.get(stage) ?? [];
    list.push({ startedAt: current.startedAt, endedAt, endKind });
    raw.set(stage, list);
    open.delete(stage);
    finalKind.set(stage, endKind);
  };
  for (const e of actual) {
    const stage = e.stage;
    if (!stage)
      continue;
    if (!order.includes(stage))
      order.push(stage);
    if (e.event === "STAGE_STARTED") {
      close(stage, e.ts, "superseded");
      open.set(stage, { startedAt: e.ts, awaiting: false });
      if (awaitingStage === stage)
        awaitingStage = undefined;
    } else if (e.event === "STAGE_COMPLETED") {
      close(stage, e.ts, "completed");
      if (awaitingStage === stage)
        awaitingStage = undefined;
    } else if (e.event === "STAGE_SKIPPED") {
      close(stage, e.ts, "skipped");
      if (awaitingStage === stage)
        awaitingStage = undefined;
    } else if (e.event === "STAGE_AWAITING_APPROVAL") {
      awaitingStage = stage;
      const current = open.get(stage);
      if (current)
        current.awaiting = true;
    }
  }
  for (const [stage, current] of open) {
    close(stage, lastActualTs, current.awaiting ? "awaiting-approval" : "in-flight");
  }
  const stages = [];
  for (const stage of order) {
    const stageSegments = raw.get(stage);
    if (!stageSegments?.length)
      continue;
    const segments = stageSegments.map((segment) => {
      const within = actual.filter((e) => e.ts >= segment.startedAt && e.ts <= segment.endedAt);
      const split = classifyGaps(within);
      return {
        ...segment,
        ...split,
        elapsedSec: secs(segment.startedAt, segment.endedAt)
      };
    });
    const sum = (pick) => segments.reduce((n, segment) => n + pick(segment), 0);
    const workload = emptyWorkload();
    for (const e of actual) {
      if (e.stage !== stage)
        continue;
      if (e.event === "ARTIFACT_CREATED" || e.event === "ARTIFACT_UPDATED")
        workload.artifacts++;
      else if (e.event === "SENSOR_FIRED")
        workload.sensors++;
      else if (e.event === "SENSOR_FAILED")
        workload.sensorFailures++;
      else if (e.event === "SUBAGENT_COMPLETED")
        workload.delegations++;
    }
    for (const segment of stageSegments) {
      workload.humanTurns += actual.filter((e) => e.event === "HUMAN_TURN" && e.ts >= segment.startedAt && e.ts <= segment.endedAt).length;
    }
    const humanWaitSec = sum((s) => s.humanWaitSec);
    const parkedSec = sum((s) => s.parkedSec);
    const observedSec = sum((s) => s.observedSec);
    const conversationSec = sum((s) => s.conversationSec);
    const unknownSec = sum((s) => s.unknownSec);
    const delegatedSec = sum((s) => s.delegatedSec);
    const unknown = segments.flatMap((s) => s.unknown);
    const idleSec = humanWaitSec + parkedSec;
    const workSec = observedSec + unknownSec;
    stages.push({
      stage,
      startedAt: segments[0].startedAt,
      endedAt: segments[segments.length - 1].endedAt,
      endKind: finalKind.get(stage) ?? "in-flight",
      elapsedSec: sum((s) => s.elapsedSec),
      segments,
      humanWaitSec,
      parkedSec,
      inferredParkSec: sum((s) => s.inferredParkSec),
      observedSec,
      conversationSec,
      unknownSec,
      delegatedSec,
      parkAnomalies: sum((s) => s.parkAnomalies),
      unknown,
      idleSec,
      agentSec: delegatedSec,
      workSec,
      suspect: unknown,
      workload
    });
  }
  const workers = buildWorkers(actual);
  const elapsedSec = secs(firstTs, endTs);
  const personElapsedSec = workers.reduce((n, w) => n + w.elapsedSec, 0);
  let overlapSec = 0;
  for (let i = 0;i < workers.length; i++) {
    for (let j = i + 1;j < workers.length; j++) {
      const a = workers[i];
      const b = workers[j];
      const from = Math.max(Date.parse(a.firstTs), Date.parse(b.firstTs));
      const to = Math.min(Date.parse(a.lastTs), Date.parse(b.lastTs));
      if (to > from)
        overlapSec += (to - from) / 1000;
    }
  }
  const spans = workers.map((w) => ({ from: Date.parse(w.firstTs), to: Date.parse(w.lastTs) })).sort((a, b) => a.from - b.from);
  let coveredSec = 0;
  let cursor = Number.NEGATIVE_INFINITY;
  for (const s of spans) {
    const from = Math.max(s.from, cursor);
    if (s.to > from) {
      coveredSec += (s.to - from) / 1000;
      cursor = s.to;
    }
  }
  const lastEventSpanSec = secs(firstTs, lastActualTs);
  const handoverSec = Math.max(0, lastEventSpanSec - coveredSec);
  const gaps = [];
  const total = classifyGaps(actual, (from, to, bucket) => gaps.push({ from, to, bucket }));
  return {
    stages,
    total,
    firstTs,
    lastTs: endTs,
    lastEventTs: lastActualTs,
    sinceLastEventSec: Math.max(0, secs(lastActualTs, endTs)),
    elapsedSec,
    awaitingStage,
    bins: buildBins(gaps, firstTs, lastActualTs),
    workers,
    parallel: workers.length > 1,
    clones: new Set(workers.map((w) => w.cloneId ?? w.shard)).size,
    overlapSec,
    handoverSec,
    personIdleSec: workers.reduce((n, w) => n + w.idleSec, 0),
    personWorkSec: workers.reduce((n, w) => n + w.workSec, 0),
    personHumanWaitSec: workers.reduce((n, w) => n + w.humanWaitSec, 0),
    personParkedSec: workers.reduce((n, w) => n + w.parkedSec, 0),
    personObservedSec: workers.reduce((n, w) => n + w.observedSec, 0),
    personConversationSec: workers.reduce((n, w) => n + w.conversationSec, 0),
    personUnknownSec: workers.reduce((n, w) => n + w.unknownSec, 0),
    personElapsedSec,
    parallelism: elapsedSec > 0 && overlapSec > 0 ? personElapsedSec / elapsedSec : undefined
  };
}

// server/model/freshness.ts
import * as fs17 from "node:fs";
var LAG_TOLERANCE_SEC = 300;
function mtimeIso(p) {
  try {
    return fs17.statSync(p).mtime.toISOString().replace(/\.\d{3}Z$/, "Z");
  } catch {
    return;
  }
}
function ageSec(asOf, now) {
  if (!asOf)
    return;
  const a = Date.parse(asOf);
  const n = Date.parse(now);
  if (!Number.isFinite(a) || !Number.isFinite(n))
    return;
  return Math.max(0, (n - a) / 1000);
}
function buildProvenance(input) {
  const { now, auditLastTs } = input;
  const mk = (source, asOf, stale = false, staleReason) => ({
    source,
    asOf,
    ageSec: ageSec(asOf, now),
    stale,
    staleReason
  });
  const graphAsOf = input.graphLastEventTs ?? mtimeIso(input.graphPath);
  let graphStale = false;
  let graphReason;
  if (graphAsOf && auditLastTs) {
    const lag = (Date.parse(auditLastTs) - Date.parse(graphAsOf)) / 1000;
    if (Number.isFinite(lag) && lag > LAG_TOLERANCE_SEC) {
      graphStale = true;
      graphReason = { code: "graph-behind", lagSec: lag, sensorDrift: input.sensorDrift };
    }
  } else if (!graphAsOf) {
    graphStale = true;
    graphReason = { code: "graph-unreadable" };
  }
  const stateAsOf = input.stateLastUpdated ?? mtimeIso(input.statePath);
  return {
    disk: mk("disk", now),
    audit: mk("audit", auditLastTs),
    "state.md": mk("state.md", stateAsOf),
    "runtime-graph": mk("runtime-graph", graphAsOf, graphStale, graphReason),
    "hooks-health": mk("hooks-health", input.hooksLastActivity),
    "stage-graph": input.catalogPath ? mk("stage-graph", mtimeIso(input.catalogPath)) : mk("stage-graph", undefined, true, { code: "stage-graph-missing" })
  };
}
function graphLastEvent(graphPath) {
  let raw;
  try {
    raw = fs17.readFileSync(graphPath, "utf-8");
  } catch {
    return;
  }
  let doc;
  try {
    doc = JSON.parse(raw);
  } catch {
    return;
  }
  if (typeof doc !== "object" || doc === null)
    return;
  const stages = doc.stages;
  if (!Array.isArray(stages))
    return;
  let latest;
  for (const s of stages) {
    if (typeof s !== "object" || s === null)
      continue;
    const r = s;
    for (const k of ["completed_at", "started_at"]) {
      const v = r[k];
      if (typeof v === "string" && (!latest || v > latest))
        latest = v;
    }
  }
  return latest;
}

// server/model/assemble.ts
var RECENT_EVENT_LIMIT = 300;
function resolveUsageKind(mode, harnessDir) {
  if (mode !== "auto")
    return mode;
  return harnessDir === ".claude" ? "claude" : "kiro";
}
function errText(err) {
  return err instanceof Error ? err.message : String(err);
}
function emptyTokens(window) {
  return {
    status: "none",
    totals: { input: 0, output: 0, cacheRead: 0, cacheCreate: 0, thinking: 0 },
    grandTotal: 0,
    cachedPromptRatio: null,
    sessionTime: null,
    byModel: [],
    messages: 0,
    sidechainMessages: 0,
    sessions: 0,
    trend: { window, points: [], summary: { latest: null, min: null, max: null, count: 0 } },
    lastActivityAt: null,
    firstActivityAt: null,
    dir: null,
    triedPath: "",
    notes: []
  };
}
function emptyCredit(window, collecting = false) {
  return {
    status: collecting ? "loading" : "none",
    current: null,
    lastSuccessAt: null,
    freshness: { stale: false, lastSuccessAt: null },
    trend: { window, points: [], summary: { latest: null, min: null, max: null, count: 0 } },
    warning: null,
    pollHalt: null
  };
}

class NoRunError extends Error {
  kind;
  root;
  constructor(kind, root) {
    const t = serverStrings(DEFAULT_LOCALE).cli;
    super(kind === "ambiguous" ? t.intentAmbiguous(root) : t.noWorkflow(root));
    this.kind = kind;
    this.root = root;
    this.name = "NoRunError";
  }
}
function isoNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}
function readRegistry(root, space, record) {
  const p = path16.join(root, "aidlc", "spaces", space, "intents", "intents.json");
  let raw;
  try {
    raw = fs18.readFileSync(p, "utf-8");
  } catch {
    return {};
  }
  try {
    const doc = JSON.parse(raw);
    if (!Array.isArray(doc))
      return {};
    for (const e of doc) {
      if (typeof e !== "object" || e === null)
        continue;
      const r = e;
      if (r.dirName !== record)
        continue;
      return {
        slug: typeof r.slug === "string" ? r.slug : undefined,
        scope: typeof r.scope === "string" ? r.scope : undefined,
        status: typeof r.status === "string" ? r.status : undefined
      };
    }
  } catch {}
  return {};
}
function buildGates(ledger, revisionCount, awaiting) {
  const n = (k) => ledger.counts.get(k) ?? 0;
  const rev = revisionCount && /^\d+$/.test(revisionCount.trim()) ? Number(revisionCount.trim()) : undefined;
  return {
    approved: n("GATE_APPROVED"),
    rejected: n("GATE_REJECTED"),
    revisionCount: rev,
    awaitingStage: awaiting,
    jumps: n("STAGE_JUMPED")
  };
}
function buildBlockers(questions, currentStage, now) {
  const out = [];
  for (const f of questions.blocked) {
    for (const q of f.unanswered) {
      const since = f.mtime;
      const parsed = Date.parse(since);
      out.push({
        stage: f.stage,
        unit: f.unit,
        heading: q.heading,
        kind: q.kind,
        rel: f.rel,
        since,
        waitingSec: Number.isFinite(parsed) ? Math.max(0, (Date.parse(now) - parsed) / 1000) : undefined,
        isCurrentStage: currentStage !== undefined && f.stage === currentStage
      });
    }
  }
  return out.sort((a, b) => {
    if (a.isCurrentStage !== b.isCurrentStage)
      return a.isCurrentStage ? -1 : 1;
    return a.since > b.since ? -1 : a.since < b.since ? 1 : 0;
  });
}
function eventDetail(fields) {
  for (const k of [
    "Details",
    "Reason",
    "Sensor ID",
    "Question",
    "Decision",
    "Target",
    "Error",
    "Source"
  ]) {
    const v = fields[k];
    if (v && v.length > 0)
      return v;
  }
  return;
}
function assemble(root, harnessDir, usageCtx) {
  const resolved = resolveState(root);
  if (resolved.kind !== "ok")
    throw new NoRunError(resolved.kind, root);
  const now = isoNow();
  const warnings = [];
  const statePath = path16.join(root, resolved.rel);
  const recordDir = path16.dirname(statePath);
  const graphPath = path16.join(recordDir, "runtime-graph.json");
  const harnesses = harnessDirsWithCatalog(root);
  let measured;
  let discoveredHarness = harnessDir ?? harnesses[0];
  if (!harnessDir && harnesses.length > 1) {
    measured = measureHarnessTurns(root, readAuditLedger(recordDir), usageCtx?.home ?? os2.homedir());
    const lead = measured.kiro > measured.claude ? ".kiro" : measured.claude > measured.kiro ? ".claude" : undefined;
    if (lead && harnesses.includes(lead))
      discoveredHarness = lead;
  }
  let catalog;
  try {
    catalog = readStageCatalog(root, discoveredHarness);
  } catch {
    catalog = undefined;
  }
  if (!catalog) {
    warnings.push(harnessDir ? { code: "catalog-read-failed", harnessDir } : { code: "catalog-not-found" });
  }
  const isStage = catalog ? (s) => catalog?.bySlug.has(s) : undefined;
  let stateText;
  try {
    stateText = fs18.readFileSync(statePath, "utf-8");
  } catch {
    throw new NoRunError("none", root);
  }
  const state = parseState(stateText, catalog ? (s) => catalog?.bySlug.get(s)?.name : undefined);
  const ledger = readAuditLedger(recordDir, isStage);
  if (ledger.events.length === 0)
    warnings.push({ code: "audit-empty" });
  const sensors = readSensorReport(recordDir, ledger);
  const questions = readQuestions(recordDir);
  const diaries = readDiaries(recordDir);
  const health = readHealth(recordDir);
  const timing = buildTiming(ledger, now);
  const stageStatuses = new Map;
  for (const p of state.phases) {
    for (const s of p.stages) {
      const seen = stageStatuses.get(s.slug);
      if (seen)
        seen.push(s.status);
      else
        stageStatuses.set(s.slug, [s.status]);
    }
  }
  const deferrals = readDeferrals(recordDir, {
    stageStatuses,
    catalogSlugs: catalog ? new Set(catalog.bySlug.keys()) : undefined,
    isStage,
    now
  });
  const harnessVersion = catalog?.stateVersion;
  const versionMismatch = harnessVersion !== undefined && state.stateVersion !== undefined && harnessVersion !== state.stateVersion;
  if (versionMismatch && catalog && state.stateVersion !== undefined && harnessVersion) {
    warnings.push({
      code: "state-version-mismatch",
      stateVersion: state.stateVersion,
      harnessVersion,
      harnessDir: catalog.harnessDir
    });
  }
  const stateVersionReadable = state.stateVersion !== undefined && /^\d+$/.test(state.stateVersion);
  const stateCompat = versionMismatch ? "incompatible" : stateVersionReadable && harnessVersion !== undefined ? "verified" : "unknown";
  if (!stateVersionReadable) {
    warnings.push({ code: "state-version-unreadable", stateVersion: state.stateVersion });
  }
  const team = state.unitOwnership?.toLowerCase() === "team";
  const unitMajorMode = state.constructionIteration?.toLowerCase() === "unit-major";
  const teamMode = team && unitMajorMode;
  if (team && !unitMajorMode) {
    warnings.push({
      code: "team-without-unit-major",
      constructionIteration: state.constructionIteration
    });
  }
  if (state.unitProgress?.malformed) {
    warnings.push({ code: "unit-progress-malformed" });
  } else if (teamMode && !state.unitProgress) {
    warnings.push({ code: "unit-progress-missing" });
  }
  const stateSlugs = state.phases.flatMap((p) => p.stages.map((st) => st.slug));
  const unknownToCatalog = catalog ? stateSlugs.filter((sl) => !catalog?.bySlug.has(sl)) : [];
  const versionsAgree = harnessVersion !== undefined && state.stateVersion !== undefined && !versionMismatch;
  const missingFromState = catalog && versionsAgree ? [...catalog.bySlug.keys()].filter((sl) => !stateSlugs.includes(sl)) : [];
  const rosterMismatch = unknownToCatalog.length > 0 || missingFromState.length > 0;
  if (rosterMismatch) {
    warnings.push({
      code: "roster-mismatch",
      stateVersion: state.stateVersion,
      unknownToCatalog,
      missingFromState
    });
  }
  const construction = state.phases.find((p) => p.key === "construction");
  const matrix = construction ? scanConstructionMatrix(recordDir, construction.stages, rosterMismatch || versionMismatch ? undefined : catalog, readUnitLifecycle(ledger.events, { unitMajor: unitMajorMode, teamOwnership: team }), stateCompat) : undefined;
  const artifacts = {};
  const units = matrix ? matrix.units.map((u) => u.name) : [];
  for (const p of state.phases) {
    for (const s of p.stages) {
      if (s.bolt) {
        artifacts[`construction/${s.bolt}/${s.slug}`] ??= listStageArtifacts(recordDir, p.key, s.slug, s.bolt);
        continue;
      }
      const key = `${p.key}/${s.slug}`;
      if (artifacts[key])
        continue;
      const merged = listStageArtifacts(recordDir, p.key, s.slug);
      if (p.key === "construction") {
        for (const u of units)
          merged.push(...listStageArtifacts(recordDir, p.key, s.slug, u));
        merged.sort((a, b) => (a.unit ?? "").localeCompare(b.unit ?? "") || a.name.localeCompare(b.name));
      }
      artifacts[key] = merged;
    }
  }
  let sensorDrift;
  const graphFired = (() => {
    try {
      const doc = JSON.parse(fs18.readFileSync(graphPath, "utf-8"));
      if (!Array.isArray(doc?.stages))
        return;
      return doc.stages.reduce((n, s) => n + (Array.isArray(s.sensor_firings) ? s.sensor_firings.length : 0), 0);
    } catch {
      return;
    }
  })();
  if (graphFired !== undefined && sensors.totalFired > graphFired) {
    sensorDrift = { fired: sensors.totalFired, missing: sensors.totalFired - graphFired };
  }
  const provenance = buildProvenance({
    now,
    auditLastTs: ledger.lastTs,
    stateLastUpdated: state.lastUpdated,
    statePath,
    graphPath,
    graphLastEventTs: graphLastEvent(graphPath),
    hooksLastActivity: health.lastActivity,
    catalogPath: catalog?.sourcePath,
    sensorDrift
  });
  const relParts = resolved.rel.split("/");
  const space = relParts[2] ?? "default";
  const record = relParts[4] ?? path16.basename(recordDir);
  const identity = {
    root,
    space,
    record,
    stateRel: resolved.rel,
    recordDir,
    harnessDir: catalog?.harnessDir,
    ...readRegistry(root, space, record)
  };
  const window = usageCtx?.window ?? "30d";
  const mode = usageCtx?.mode ?? "auto";
  const usageKind = resolveUsageKind(mode, catalog?.harnessDir ?? discoveredHarness);
  if (measured && measured.kiro === measured.claude) {
    warnings.push({ code: "harness-coexist", harnesses, chosen: usageKind });
  }
  let usage;
  if (usageKind === "claude") {
    try {
      const agg = readTranscripts(root, window, {
        home: usageCtx?.home,
        now: new Date(now),
        memo: usageCtx?.memo
      });
      usage = { kind: "claude", tokens: assembleTokens(agg, window) };
    } catch (err) {
      warnings.push({ code: "token-usage-failed", detail: errText(err) });
      usage = { kind: "claude", tokens: emptyTokens(window) };
    }
  } else if (usageCtx?.store) {
    try {
      usage = {
        kind: "kiro",
        credit: assembleCredit(usageCtx.store, new Date(now), window, usageCtx.collecting, usageCtx.pollHalt ?? null)
      };
    } catch (err) {
      warnings.push({ code: "credit-assembly-failed", detail: errText(err) });
      usage = { kind: "kiro", credit: emptyCredit(window, usageCtx.collecting) };
    }
  } else {
    usage = { kind: "kiro", credit: emptyCredit(window, usageCtx?.collecting) };
  }
  const recent = ledger.events.slice(-RECENT_EVENT_LIMIT).reverse().map((e) => ({
    ts: e.ts,
    event: e.event,
    stage: e.stage,
    unit: e.unit,
    detail: eventDetail(e.fields),
    shard: e.shard
  }));
  return {
    generatedAt: now,
    identity,
    state,
    matrix,
    sensors,
    questions,
    diaries,
    deferrals,
    health,
    timing,
    blockers: buildBlockers(questions, state.currentStage, now),
    gates: buildGates(ledger, state.revisionCount, timing.awaitingStage),
    rework: buildRework(ledger),
    usage,
    eventCounts: [...ledger.counts].sort((a, b) => b[1] - a[1]),
    recentEvents: recent,
    totalEvents: ledger.events.length,
    provenance,
    warnings,
    artifacts,
    stageNumbers: Object.fromEntries((catalog?.stages ?? []).filter((s) => s.number).map((s) => [s.slug, s.number])),
    outcomes: readOutcomes(root, recordDir)
  };
}

// apps/kirocrew/backend/src/server.ts
var BASE = "/api/apps/aidlc-ledger";
var PORT = Number(process.env.PORT ?? 0);
var ROOT = process.env.AIDLC_LEDGER_ROOT?.trim() || undefined;

class Refusal extends Error {
  code;
  status;
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status;
  }
}
function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(payload)
  });
  res.end(payload);
}
function isWorkspace(root) {
  try {
    return fs19.statSync(`${root}/aidlc`).isDirectory();
  } catch {
    return false;
  }
}
function model() {
  if (!ROOT)
    throw new Refusal("no-workspace", 409);
  if (!isWorkspace(ROOT))
    throw new Refusal("not-a-workspace", 400);
  const assembled = assemble(ROOT);
  const { usage, ...payload } = assembled;
  return payload;
}
var server = createServer((req, res) => {
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
          message: err instanceof Error ? err.message : String(err)
        }
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
