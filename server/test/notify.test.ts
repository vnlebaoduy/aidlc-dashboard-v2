// Notification detection (web/src/lib/notify/detect.ts). Pure, so it is tested here
// with the server suite against the real fixture model.

import { describe, expect, test } from "bun:test";
import * as path from "node:path";
import { diffNotices, noticesOf } from "../../web/src/lib/notify/detect";
import { assemble } from "../model/assemble";
import type { DashboardModel } from "../model/types";

const FIXTURE = path.join(import.meta.dir, "..", "..", "fixtures", "reference");
const base = assemble(FIXTURE);
/** A later read's clock. */
const NOW = "2100-01-01T00:00:00Z";

function withEvent(m: DashboardModel, event: string, ts: string, stage = "code-generation") {
  return { ...m, recentEvents: [{ ts, event, stage, shard: "s1" }, ...m.recentEvents] };
}

describe("notifications", () => {
  test("first read is a baseline: nothing fires, every current fact is remembered", () => {
    const d = diffNotices(noticesOf(base), null, base.generatedAt);
    expect(d.fresh).toEqual([]);
    expect(d.seen.keys.length).toBe(noticesOf(base).length);
  });

  test("a new milestone event fires once, then never again", () => {
    const { seen } = diffNotices(noticesOf(base), null, base.generatedAt);
    const next = withEvent(base, "STAGE_COMPLETED", "2099-01-01T00:00:00Z");
    const first = diffNotices(noticesOf(next), seen, NOW);
    expect(first.fresh.map((n) => [n.kind, n.tier])).toEqual([["stage-completed", "milestone"]]);
    expect(diffNotices(noticesOf(next), first.seen, NOW).fresh).toEqual([]);
  });

  test("noise events never notify", () => {
    const { seen } = diffNotices(noticesOf(base), null, base.generatedAt);
    let m = base;
    for (const e of [
      "STAGE_STARTED",
      "HUMAN_TURN",
      "SENSOR_PASSED",
      "SENSOR_FIRED",
      "ARTIFACT_CREATED",
    ]) {
      m = withEvent(m, e, `2099-01-01T00:00:0${m.recentEvents.length % 10}Z`);
    }
    expect(diffNotices(noticesOf(m), seen, NOW).fresh).toEqual([]);
  });

  test("an open gate is an action, keyed by stage, and refires only after it clears", () => {
    const closed = { ...base, gates: { ...base.gates, awaitingStage: undefined } };
    const open = { ...base, gates: { ...base.gates, awaitingStage: "functional-design" } };
    const { seen } = diffNotices(noticesOf(closed), null, NOW);
    const opened = diffNotices(noticesOf(open), seen, NOW);
    expect(opened.fresh.map((n) => [n.kind, n.tier, n.subject])).toEqual([
      ["gate", "action", "functional-design"],
    ]);
    // Still open on the next poll: no repeat.
    expect(diffNotices(noticesOf(open), opened.seen, NOW).fresh).toEqual([]);
    // Approved, then reopened later: that is news again.
    const cleared = diffNotices(noticesOf(closed), opened.seen, NOW);
    expect(diffNotices(noticesOf(open), cleared.seen, NOW).fresh.map((n) => n.kind)).toEqual([
      "gate",
    ]);
  });

  test("only current-stage asks call the reader; parked ones stay quiet", () => {
    const ask = {
      stage: "x",
      heading: "Q9. Pick a region",
      kind: "question" as const,
      rel: "inception/x/x-questions.md",
      since: "2099-01-01T00:00:00Z",
    };
    const { seen } = diffNotices(noticesOf({ ...base, blockers: [] }), null, base.generatedAt);
    const m = {
      ...base,
      blockers: [
        { ...ask, isCurrentStage: true },
        { ...ask, heading: "Q1. Old", isCurrentStage: false },
      ],
    };
    const fresh = diffNotices(noticesOf(m), seen, NOW).fresh;
    expect(fresh.map((n) => [n.kind, n.detail, n.rel])).toEqual([
      ["ask", "Q9. Pick a region", "inception/x/x-questions.md"],
    ]);
  });

  test("an event that scrolled out of the recent window cannot come back as new", () => {
    const m = withEvent(base, "UNIT_COMPLETED", "2099-01-01T00:00:00Z");
    const { seen } = diffNotices(noticesOf(m), null, NOW);
    // Next read: the event is gone from recentEvents (window moved) …
    const gone = diffNotices(noticesOf(base), seen, NOW);
    // … and when an older read shows it again, it is still remembered.
    expect(diffNotices(noticesOf(m), gone.seen, NOW).fresh).toEqual([]);
  });

  test("a baseline with nothing to notice does not replay history on the next read", () => {
    // The bug: an empty first read stored an empty set, and the next read announced every
    // milestone still in the 300-event window as new (13 toasts at once on a real run).
    const quiet = {
      ...base,
      recentEvents: [],
      blockers: [],
      gates: { ...base.gates, awaitingStage: undefined },
    };
    const { seen } = diffNotices(noticesOf(quiet), null, "2026-10-06T06:00:00Z");
    const history = withEvent(base, "STAGE_COMPLETED", "2026-10-06T04:00:00Z");
    expect(
      diffNotices(noticesOf(history), seen, NOW).fresh.filter((n) => n.tier === "milestone"),
    ).toEqual([]);
    // …while an event after the baseline is still news.
    const later = withEvent(history, "STAGE_COMPLETED", "2026-10-06T06:30:00Z", "ci-pipeline");
    expect(diffNotices(noticesOf(later), seen, NOW).fresh.map((n) => n.subject)).toContain(
      "ci-pipeline",
    );
  });
});
