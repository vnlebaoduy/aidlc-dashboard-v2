// Pure formatters shared with the server (ages roll up to days; durations never do).
export { dur, hours, mins, shortTs } from "@server/i18n/common";

export function pct(n: number | null | undefined, digits = 0): string {
  return n === null || n === undefined || !Number.isFinite(n) ? "—" : `${n.toFixed(digits)}%`;
}

export function share(v: number, max: number): number {
  return max > 0 ? (v / max) * 100 : 0;
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function compact(n: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(
    n,
  );
}

/** Full local timestamp with its zone, for tooltips: `2026-10-06 13:04:33 GMT+7`. */
export function fullTs(ts: string): string {
  const ms = Date.parse(ts);
  if (Number.isNaN(ms)) return ts;
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  const off = -d.getTimezoneOffset();
  const zone = `GMT${off >= 0 ? "+" : "-"}${Math.floor(Math.abs(off) / 60)}${off % 60 ? `:${p(Math.abs(off) % 60)}` : ""}`;
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} ${zone}`;
}
