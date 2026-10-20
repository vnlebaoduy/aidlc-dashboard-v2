// Pure formatting helpers shared by the server: durations and timestamps.

/** Minutes, one decimal — the unit the timing panels read in. */
export function mins(sec: number): string {
  return (sec / 60).toFixed(1);
}

/**
 * Compact duration for an AGE — how long ago something happened, or how long a
 * question has been waiting: 45s / 12m / 3.4h / 2.1d. Calendar days are the right
 * unit here because that is what the reader is asking ("this has sat for 4 days").
 *
 * NOT for the timing panel — use `hours()` there. See the note on it.
 */
export function dur(sec: number | undefined): string {
  if (sec === undefined || !Number.isFinite(sec)) return "—";
  if (sec < 60) return `${Math.round(sec)}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  if (sec < 86400) return `${(sec / 3600).toFixed(1)}h`;
  return `${(sec / 86400).toFixed(1)}d`;
}

/**
 * The same, but a duration NEVER rolls up past hours: 45s / 12m / 139.5h.
 *
 * WHY THE DAY UNIT IS BANNED FROM THE TIMING PANEL. `d` there means a 24-hour
 * calendar day, and a reader spends it as a *working* day of roughly eight hours.
 * On one real run the KPI row read `5.8d 팀 벽시계 · 3.4d 일시중지 · 1.2d 관측 실행`
 * — so the run looked like it had worked about one day, when 1.2d is 28.8 hours, or
 * well over three working days. The error is a factor of three and it lands on the
 * one number the panel exists to convey.
 *
 * A single unit also makes the row comparable at a glance: `139.5h / 81.9h / 28.8h`
 * can be read against each other, `5.8d / 3.4d / 18.4h` cannot.
 *
 * Sub-hour values keep `m` and `s`. The confusion this fixes is specific to the
 * day/work-day collision — nobody reads `25m` as a unit of effort — and `0.4h`
 * would be worse, with `45s` becoming a misleading `0.0h`.
 *
 * Working days are deliberately NOT derived here. An 8-hour day is a configured
 * convention, not something the ledger measured, and this dashboard does not put a
 * synthesised number where it promises a measured one (same rule as the missing
 * usage quota).
 */
export function hours(sec: number | undefined): string {
  if (sec === undefined || !Number.isFinite(sec)) return "—";
  if (sec < 60) return `${Math.round(sec)}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  return `${(sec / 3600).toFixed(1)}h`;
}

/**
 * `2026-07-30T05:26:20Z` → `07-30 12:26` in the LOCAL zone of whoever formats it — the
 * reader's browser (GMT+7 → +7h). It used to slice the ISO text, which printed UTC
 * while the chart axes (`getHours`) printed local time, so the same moment read two
 * ways on one page. Unparseable input is returned as is; empty yields an em dash.
 */
export function shortTs(ts: string | undefined): string {
  if (!ts) return "—";
  const ms = Date.parse(ts);
  if (Number.isNaN(ms)) return ts;
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
