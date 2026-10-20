// Server-side copy: the only sentences this process writes itself — CLI diagnostics
// and one console log line. Everything the reader sees in the browser is UI copy and
// lives in the web client (`web/src/i18n`); the server sends codes and facts only.

import type { Locale } from "../model/types";

/**
 * CLI diagnostics. The operator typed the flag, so these are read in a terminal rather
 * than in the browser — but they are still user-facing, and `--lang` is resolved by a
 * pre-pass over argv so even a parse error can answer in the right language.
 * `USAGE` itself is already English on both sides and is not duplicated here.
 */
export interface CliStrings {
  needValue(flag: string): string;
  mustBeNumber(flag: string, raw: string): string;
  msFloor(flag: string, floor: number, zeroOk: boolean, got: number): string;
  portRange(max: number, got: number): string;
  /** `wildcardOk` = the flag also takes 0.0.0.0 / :: (`--host`); `--allow-host` does not. */
  badHost(flag: string, raw: string, wildcardOk: boolean): string;
  exposed(url: string): string;
  readonly needRoot: string;
  pathMissing(path: string): string;
  notAWorkspace(path: string): string;
  harnessMissing(path: string): string;
  readonly needUsage: string;
  badUsage(raw: string): string;
  readonly needLang: string;
  badLang(raw: string): string;
  unknownArg(arg: string): string;
  readonly noRootPicker: string;
  // Startup and isolated-failure lines the operator reads to judge whether the run is
  // healthy. They follow `--lang`: there is one operator per process and that flag is
  // exactly their choice.
  manualRefreshFailed(detail: string): string;
  routeFailed(route: string): string;
  creditBootFailed(detail: string): string;
  readonly unhandled: string;
  readonly harnessNotFound: string;
  startupSummary(audit: number, langDefault: string): string;
  intentAmbiguous(root: string): string;
  noWorkflow(root: string): string;
}

export interface ServerStrings {
  readonly cli: CliStrings;
  readonly openFile: {
    /** Console-only: the async spawn error that would otherwise kill the process. */
    spawnFailedLog(cmd: string, detail: string): string;
  };
}

const EN: ServerStrings = {
  cli: {
    needValue: (flag) => `${flag} needs a value`,
    mustBeNumber: (flag, raw) => `${flag} must be a number: ${raw}`,
    msFloor: (flag, floor, zeroOk, got) =>
      `${flag} is in milliseconds and must be at least ${floor}${zeroOk ? " (0 disables it)" : ""}: ${got}`,
    portRange: (max, got) => `--port must be between 1 and ${max}: ${got}`,
    badHost: (flag, raw, wildcardOk) =>
      `${flag} must be an IP address (no hostname${wildcardOk ? "" : ", 0.0.0.0 or ::"}): ${raw}`,
    exposed: (url) =>
      `⚠️ Exposed to the network at ${url} — no authentication. Anyone who can reach this address sees the dashboard and the folder picker`,
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
    creditBootFailed: (detail) =>
      `Credit subsystem failed to boot (the dashboard is still starting): ${detail}`,
    unhandled: "Unhandled error:",
    harnessNotFound: "not found",
    startupSummary: (audit, langDefault) => `audit ${audit} · lang ${langDefault} by default`,
    intentAmbiguous: (root) => `Several intents but no active-intent cursor: ${root}`,
    noWorkflow: (root) => `No AI-DLC workflow found: ${root}`,
  },
  openFile: {
    spawnFailedLog: (cmd, detail) => `Could not open the file (${cmd}): ${detail}`,
  },
};

const VI: ServerStrings = {
  cli: {
    needValue: (flag) => `${flag} cần một giá trị`,
    mustBeNumber: (flag, raw) => `${flag} phải là số: ${raw}`,
    msFloor: (flag, floor, zeroOk, got) =>
      `${flag} tính bằng mili giây và phải ít nhất ${floor}${zeroOk ? " (0 để tắt)" : ""}: ${got}`,
    portRange: (max, got) => `--port phải nằm trong khoảng 1 đến ${max}: ${got}`,
    badHost: (flag, raw, wildcardOk) =>
      `${flag} phải là địa chỉ IP (không dùng hostname${wildcardOk ? "" : ", 0.0.0.0 hay ::"}): ${raw}`,
    exposed: (url) =>
      `⚠️ Đang mở ra mạng tại ${url} — không có xác thực. Bất kỳ ai truy cập được địa chỉ này đều thấy dashboard và bộ chọn thư mục`,
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
    creditBootFailed: (detail) =>
      `Không khởi động được hệ thống credit (dashboard vẫn đang khởi động): ${detail}`,
    unhandled: "Lỗi chưa được xử lý:",
    harnessNotFound: "không tìm thấy",
    startupSummary: (audit, langDefault) => `audit ${audit} · lang mặc định ${langDefault}`,
    intentAmbiguous: (root) => `Có nhiều intent nhưng không có con trỏ active-intent: ${root}`,
    noWorkflow: (root) => `Không tìm thấy workflow AI-DLC: ${root}`,
  },
  openFile: {
    spawnFailedLog: (cmd, detail) => `Không mở được file (${cmd}): ${detail}`,
  },
};

const BY_LOCALE: Record<Locale, ServerStrings> = { en: EN, vi: VI };

export function serverStrings(locale: Locale): ServerStrings {
  return BY_LOCALE[locale];
}
