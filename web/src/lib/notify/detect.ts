// What deserves a notification, derived from one model snapshot.
//
// Every notifiable fact gets a STABLE KEY. A key the reader has not seen before is
// news; a key seen before never fires again, however many polls repeat it. That is
// what makes this immune to reloads, page switches and two tabs — the alternative,
// diffing consecutive models, double-fires on reload and misses a state that flipped
// on and off between two polls.
//
// Two tiers (DESIGN.md · Notifications):
//   action    — the run needs the reader: an open gate, an unanswered ask, a stop hook
//               blocking in a loop, a failed check in the current stage, run complete.
//               Toast + OS notification + count in the tab title.
//   milestone — progress worth knowing: a stage / unit / phase completed, a gate
//               rejected (rework), the workflow parked. Toast only.
// Everything else (STAGE_STARTED, HUMAN_TURN, SENSOR_PASSED …) stays in the audit and
// is never notified.
//
// Pure: no DOM, no storage — `bun test` covers it (detect.test.ts).

// Relative, not `@server/*`: `bun test` (server tsconfig) imports this file too.
import { buildStatus } from "../../../../server/model/status";
import type { DashboardModel } from "../../../../server/model/types";

export type Tier = "action" | "milestone";

export type NoticeKind =
  | "gate"
  | "ask"
  | "stuck"
  | "check-failed"
  | "run-complete"
  | "stage-completed"
  | "unit-completed"
  | "phase-completed"
  | "gate-rejected"
  | "workflow-parked";

export interface Notice {
  key: string;
  tier: Tier;
  kind: NoticeKind;
  /** Stage / unit / phase the notice is about (verbatim from the run). */
  subject: string;
  /** Extra verbatim text: the ask heading, the failure count. */
  detail?: string;
  /** Record-relative file to open, when there is one. */
  rel?: string;
  /** When it happened, ISO. Conditions without an event use the model's clock. */
  ts: string;
}

const MILESTONE_EVENTS: Record<string, NoticeKind> = {
  STAGE_COMPLETED: "stage-completed",
  UNIT_COMPLETED: "unit-completed",
  PHASE_COMPLETED: "phase-completed",
  GATE_REJECTED: "gate-rejected",
  WORKFLOW_PARKED: "workflow-parked",
};

/** Every notifiable fact in this snapshot, newest first within each tier. */
export function noticesOf(m: DashboardModel): Notice[] {
  const out: Notice[] = [];
  const st = buildStatus(m);
  const now = m.generatedAt;

  // ---- action: conditions, keyed by WHAT is open, not by when we saw it ----------
  const gate = m.gates.awaitingStage;
  if (gate) {
    out.push({ key: `gate:${gate}`, tier: "action", kind: "gate", subject: gate, ts: now });
  }
  for (const b of m.blockers) {
    if (!b.isCurrentStage) continue; // a parked ask is a loose end, not a call to act
    out.push({
      key: `ask:${b.rel}#${b.heading}`,
      tier: "action",
      kind: "ask",
      subject: b.unit ? `${b.unit} · ${b.stage}` : b.stage,
      detail: b.heading,
      rel: b.rel,
      ts: b.since,
    });
  }
  if (st.stuck?.state === "blocked") {
    // Keyed by stage only: a count climbing 3 → 4 → 5 is the same problem, not three.
    out.push({
      key: `stuck:${st.stuck.stage}`,
      tier: "action",
      kind: "stuck",
      subject: st.stuck.stage,
      detail: String(st.stuck.count),
      ts: now,
    });
  }
  if (st.checks?.state === "failed" && m.state.currentStage) {
    out.push({
      key: `check-failed:${m.state.currentStage}`,
      tier: "action",
      kind: "check-failed",
      subject: m.state.currentStage,
      detail: String(st.checks.failed),
      ts: now,
    });
  }
  if (st.run.state === "complete") {
    out.push({
      key: `run-complete:${m.identity.record}`,
      tier: "action",
      kind: "run-complete",
      subject: m.identity.slug ?? m.identity.record,
      ts: now,
    });
  }

  // ---- milestone: audit events, keyed by the event itself ------------------------
  for (const e of m.recentEvents) {
    const kind = MILESTONE_EVENTS[e.event];
    if (!kind) continue;
    const subject = e.unit ? `${e.unit} · ${e.stage ?? ""}` : (e.stage ?? "");
    out.push({
      key: `ev:${e.shard}:${e.ts}:${e.event}:${e.stage ?? ""}:${e.unit ?? ""}`,
      tier: "milestone",
      kind,
      subject,
      ts: e.ts,
    });
  }
  return out;
}

/**
 * What this browser already knows about a workspace.
 *
 * `keys` are the facts seen. `since` is the clock of the read that started tracking.
 * An EVENT older than `since` is history, never news, even when its key is missing
 * from `keys`. Without it, a baseline read that happened to hold no notices left an
 * empty set, and the next read replayed every milestone in the 300-event window as
 * "new" (13 toasts at once on a real run).
 */
export interface Seen {
  since: string;
  keys: string[];
}

export interface Diff {
  fresh: Notice[];
  seen: Seen;
}

/**
 * Notices this browser has not seen. With no `seen` yet (first read of this workspace
 * here) nothing is fresh: the current state becomes the baseline, so opening the page
 * never replays the run's history as a flood of toasts.
 *
 * - Conditions (gate, ask, stuck, failed check, complete) are new when their key is.
 *   `keys` is replaced by the current ones, so a gate that clears and later reopens
 *   fires again.
 * - Events (milestones) must ALSO be newer than `since`. Their keys are kept even
 *   after they scroll out of `recentEvents`, so an event can never come back as new.
 */
export function diffNotices(notices: Notice[], seen: Seen | null, now: string): Diff {
  const keys = notices.map((n) => n.key);
  if (seen === null) return { fresh: [], seen: { since: now, keys } };
  const prior = new Set(seen.keys);
  const fresh = notices.filter(
    (n) => !prior.has(n.key) && (n.tier === "action" || n.ts > seen.since),
  );
  const keptEvents = seen.keys.filter((k) => k.startsWith("ev:"));
  return {
    fresh,
    seen: { since: seen.since, keys: [...new Set([...keys, ...keptEvents])].slice(-2000) },
  };
}
