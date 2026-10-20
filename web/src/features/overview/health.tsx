// Run Health card (v1 render/status.ts renderRunHealth) and the "Needs you" strip.
//
// Run Health is one tab per signal (your answers, stuck, failed checks). Each tab's COUNT
// carries the signal: toned when there is something to act on, green when the source was
// read and is clear, a muted dash when there is no record — "no record" never reads as
// healthy. The card opens on the first tab with a problem. A completed run collapses to
// one summary tab, every ask left on it shown as parked.
//
// No `role="status"`: the model re-polls, and a live region would re-announce the card.

import { ViewLink } from "@/components/art-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type Strings, useI18n } from "@/i18n";
import { dur, share } from "@/lib/format";
import {
  type ChecksReading,
  type HumanReading,
  type StuckReading,
  buildStatus,
} from "@server/model/status";
import type { Blocker, DashboardModel } from "@server/model/types";
import {
  CircleCheckIcon,
  CircleXIcon,
  HeartPulseIcon,
  type LucideIcon,
  MessageCircleQuestionIcon,
  OctagonPauseIcon,
  ShieldAlertIcon,
  StampIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { type CardTab, type CountTone, type Row, RowList, TabbedCard } from "./row-list";

const icon = (Icon: LucideIcon, cls: string) => (
  <Icon aria-hidden className={`size-4 shrink-0 ${cls}`} />
);

/**
 * One unanswered ask. `parked` overrides the blocker's own `isCurrentStage`: on a
 * finished run every ask is a loose end, even one in the stage state.md names as current.
 */
function askRow(b: Blocker, s: Strings, maxWait: number, parked = !b.isCurrentStage): Row {
  const where = b.unit ? `${b.unit} · ${b.stage}` : b.stage;
  return {
    key: `${b.rel}#${b.heading}`,
    icon: icon(
      b.kind === "confirmation" ? StampIcon : MessageCircleQuestionIcon,
      parked ? "text-muted-foreground" : "text-warning-foreground",
    ),
    label: `${parked ? `${s.blockers.staleStage} · ` : ""}${where} · ${b.heading}`,
    sub: (
      <>
        {b.kind === "confirmation" ? ` · ${s.blockers.confirmation}` : null}
        {" · "}
        <ViewLink rel={b.rel} title={s.blockers.viewTip(b.rel)} className="inline">
          {b.rel.split("/").pop() ?? b.rel}
        </ViewLink>
      </>
    ),
    value: dur(b.waitingSec),
    pct: b.waitingSec === undefined ? undefined : share(b.waitingSec, maxWait),
    tone: parked ? "mute" : "warn",
    dim: parked,
    tip: b.kind === "confirmation" ? s.blockers.confirmationTip : undefined,
  };
}

function answersTab(h: HumanReading | undefined, m: DashboardModel, s: Strings): CardTab {
  const x = s.status;
  const maxWait = Math.max(0, ...m.blockers.map((b) => b.waitingSec ?? 0));
  const rows: Row[] = [];
  if (h?.awaitingGate) {
    rows.push({
      key: "gate",
      icon: icon(StampIcon, "text-warning-foreground"),
      label: x.humanGate(h.awaitingGate),
      sub: ` · ${x.humanGateSource}`,
      value: "",
      pct: 100,
      tone: "warn",
    });
  }
  // buildBlockers already sorts current-stage asks first; parked ones follow, dimmed.
  for (const b of m.blockers) rows.push(askRow(b, s, maxWait));
  // An open gate is usually answered IN the current-stage questions file, so adding it to
  // their count would report one approval twice. It counts on its own only when no
  // current ask carries it.
  const current = h?.current ?? 0;
  const open = current > 0 ? current : h?.awaitingGate ? 1 : 0;
  return {
    label: s.cards.answersTab,
    count: { text: String(open), tone: open > 0 ? "warn" : "ok" },
    // Not capped: this card is the only place the asks are listed, so a "+N more" would
    // make the rest unreachable.
    body: (
      <RowList
        rows={rows}
        head={[s.cards.colAsk, s.cards.colWait]}
        empty={x.humanNone}
        note={x.humanSource}
      />
    ),
  };
}

function stuckTab(r: StuckReading, s: Strings): CardTab {
  const x = s.status;
  let row: Row;
  let count: { text: string; tone: CountTone };
  switch (r.state) {
    case "no-record":
      row = { key: "stuck", label: x.stuckNoRecord, value: "—", dashed: true };
      count = { text: "–", tone: "mute" };
      break;
    case "clear":
      row = {
        key: "stuck",
        icon: icon(CircleCheckIcon, "text-success-foreground"),
        label: x.stuckClear,
        value: "0",
        tone: "ok",
      };
      count = { text: "0", tone: "ok" };
      break;
    case "earlier-stage":
      row = {
        key: "stuck",
        icon: icon(CircleCheckIcon, "text-success-foreground"),
        label: x.stuckClear,
        sub: ` · ${x.stuckEarlier(r.stage)}`,
        value: "0",
        tone: "ok",
      };
      count = { text: "0", tone: "ok" };
      break;
    case "blocked":
      row = {
        key: "stuck",
        icon: icon(OctagonPauseIcon, "text-warning-foreground"),
        label: x.stuckBlocked(r.count),
        sub: ` · ${r.stage}`,
        value: String(r.count),
        pct: 100,
        tone: "warn",
      };
      count = { text: String(r.count), tone: "warn" };
      break;
  }
  return {
    label: s.cards.stuckTab,
    count,
    body: (
      <RowList
        rows={[{ ...row, tip: x.stuckTip }]}
        head={[s.cards.colGuard, s.cards.colCount]}
        note={x.stuckSource}
      />
    ),
  };
}

function checksTab(r: ChecksReading, m: DashboardModel, s: Strings): CardTab {
  const x = s.status;
  const now = Date.parse(m.generatedAt);
  const failures = m.sensors.failures.filter((f) => f.stage === m.state.currentStage);
  const rows: Row[] = failures.map((f, i) => {
    const age = (now - Date.parse(f.ts)) / 1000;
    const why = failureWhy(f);
    const file = f.outputPath?.split("/").pop();
    return {
      key: `${f.fireId}#${i}`,
      icon: icon(CircleXIcon, "text-danger-foreground"),
      label: f.id,
      sub: [file, why]
        .filter(Boolean)
        .map((t) => ` · ${t}`)
        .join(""),
      value: Number.isFinite(age) && age >= 0 ? dur(age) : "—",
      pct: 100,
      tone: "bad",
      // The row truncates; the tooltip carries the full explanation.
      tip: [f.outputPath, why, x.checksFailedTip].filter(Boolean).join("\n"),
    };
  });
  let count: { text: string; tone: CountTone };
  switch (r.state) {
    case "none":
      rows.push({ key: "none", label: x.checksNone, value: "—", dashed: true });
      count = { text: "–", tone: "mute" };
      break;
    case "in-flight":
      rows.push({ key: "flight", label: x.checksInFlight(r.pending), value: "", dashed: true });
      count = r.failed > 0 ? { text: String(r.failed), tone: "bad" } : { text: "…", tone: "mute" };
      break;
    case "failed":
      // The roll-up counted a failure whose firing is not in the failure list — still
      // say it happened rather than show nothing.
      if (failures.length === 0) {
        rows.push({
          key: "failed",
          icon: icon(CircleXIcon, "text-danger-foreground"),
          label: x.checksFailed(r.failed),
          value: "",
          pct: 100,
          tone: "bad",
        });
      }
      count = { text: String(r.failed), tone: "bad" };
      break;
    case "passed":
      rows.push({
        key: "passed",
        icon: icon(CircleCheckIcon, "text-success-foreground"),
        label: x.checksPassed(r.passed),
        value: "",
        tone: "ok",
      });
      count = { text: "0", tone: "ok" };
      break;
  }
  return {
    label: s.cards.checksTab,
    count,
    body: (
      <RowList
        rows={rows}
        head={[s.cards.colCheck, s.cards.colWhen]}
        max={6}
        note={x.checksSource}
      />
    ),
  };
}

/**
 * One line saying WHY a firing failed, from its detail body: the sensor's own `reason`
 * first, then the non-empty findings (`h2_count: 0`, `missing_from_upstream_ids: …`),
 * then the unreferenced inputs and errors; the bare count only when nothing else exists.
 */
function failureWhy(f: DashboardModel["sensors"]["failures"][number]): string {
  if (f.reason) return f.reason;
  const parts = f.facts.map(
    (k) => `${k.key}: ${k.items ? k.items.join(", ") + (k.more ? ` +${k.more}` : "") : k.value}`,
  );
  if (f.unreferenced.length > 0) parts.push(`unreferenced: ${f.unreferenced.join(", ")}`);
  if (f.errors.length > 0)
    parts.push(
      f.errors
        .map((e) => e.message)
        .slice(0, 3)
        .join("; "),
    );
  if (parts.length === 0 && f.findingsCount !== undefined) return `findings: ${f.findingsCount}`;
  return parts.join(" · ");
}

export function RunHealthCard({ m }: { m: DashboardModel }) {
  const { s } = useI18n();
  const st = buildStatus(m);
  const links = [{ to: "/timeline", label: s.cards.moreTimeline }] as const;
  const common = {
    id: "card-health",
    title: s.cards.healthTitle,
    icon: <HeartPulseIcon />,
    links: [...links],
  };

  if (st.run.state === "complete") {
    // A finished run: past blocks and failed checks are history. What is left to show is
    // that it finished, and any ask it left unanswered.
    const maxWait = Math.max(0, ...m.blockers.map((b) => b.waitingSec ?? 0));
    const rows: Row[] = [
      {
        key: "complete",
        icon: icon(CircleCheckIcon, "text-success-foreground"),
        label: s.status.runComplete,
        value: "",
        tone: "ok",
      },
      ...m.blockers.map((b) => askRow(b, s, maxWait, true)),
    ];
    return (
      <TabbedCard
        {...common}
        tabs={[
          { label: s.cards.summaryTab, body: <RowList rows={rows} note={s.status.runSource} /> },
        ]}
      />
    );
  }

  const tabs = [
    answersTab(st.human, m, s),
    stuckTab(st.stuck ?? { state: "no-record" }, s),
    checksTab(st.checks ?? { state: "none" }, m, s),
  ];
  const problem = tabs.findIndex((t) => t.count?.tone === "warn" || t.count?.tone === "bad");
  return <TabbedCard {...common} tabs={tabs} selected={problem < 0 ? 0 : problem} />;
}

// ── Needs you ────────────────────────────────────────────────────────────────

function NeedItem({ icon: el, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex min-w-0 items-start gap-2 text-sm">
      <span className="mt-0.5">{el}</span>
      <span className="min-w-0 break-words">{children}</span>
    </li>
  );
}

/**
 * The page's first answer to "what needs me": every actionable reading from buildStatus
 * — current-stage asks, an open gate no ask carries, a stuck stop hook, failed checks in
 * this stage. Parked asks and history are left to Run Health. Nothing actionable → one
 * calm line, never an empty card.
 */
export function NeedsYou({ m }: { m: DashboardModel }) {
  const { s, c } = useI18n();
  const x = s.status;
  const st = buildStatus(m);
  const asks = m.blockers.filter((b) => b.isCurrentStage && st.run.state !== "complete");
  const gate = st.human?.awaitingGate && asks.length === 0 ? st.human.awaitingGate : undefined;
  const stuck = st.stuck?.state === "blocked" ? st.stuck : undefined;
  const checks =
    st.checks?.state === "failed" || (st.checks?.state === "in-flight" && st.checks.failed > 0)
      ? st.checks
      : undefined;
  const failures = checks ? m.sensors.failures.filter((f) => f.stage === m.state.currentStage) : [];

  if (asks.length === 0 && !gate && !stuck && !checks) {
    const done = st.run.state === "complete";
    return (
      <p className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm">
        <CircleCheckIcon aria-hidden className="size-4 shrink-0 text-success-foreground" />
        <span className="font-medium">{done ? x.runComplete : x.humanNone}</span>
        <span className="text-muted-foreground">· {done ? x.runSource : x.humanSource}</span>
      </p>
    );
  }

  return (
    <Card className="border-warning/60 bg-warning/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlertIcon aria-hidden className="size-4 text-warning-foreground" />
          {c.overviewPage.needsYou}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {gate ? (
            <NeedItem icon={icon(StampIcon, "text-warning-foreground")}>
              <span className="font-medium">{x.humanGate(gate)}</span>
              <span className="text-muted-foreground"> · {x.humanGateSource}</span>
            </NeedItem>
          ) : null}
          {asks.map((b) => (
            <NeedItem
              key={`${b.rel}#${b.heading}`}
              icon={icon(
                b.kind === "confirmation" ? StampIcon : MessageCircleQuestionIcon,
                "text-warning-foreground",
              )}
            >
              <span className="font-medium">{b.heading}</span>
              <span className="text-muted-foreground">
                {" · "}
                {b.unit ? `${b.unit} · ${b.stage}` : b.stage}
                {b.kind === "confirmation" ? ` · ${s.blockers.confirmation}` : ""}
                {" · "}
                {c.overviewPage.waiting(dur(b.waitingSec))}
                {" · "}
              </span>
              <ViewLink rel={b.rel} title={s.blockers.viewTip(b.rel)} className="inline">
                {b.rel.split("/").pop() ?? b.rel}
              </ViewLink>
            </NeedItem>
          ))}
          {stuck ? (
            <NeedItem icon={icon(OctagonPauseIcon, "text-warning-foreground")}>
              <span className="font-medium" title={x.stuckTip}>
                {x.stuckBlocked(stuck.count)}
              </span>
              <span className="text-muted-foreground">
                {" · "}
                {stuck.stage} · {x.stuckSource}
              </span>
            </NeedItem>
          ) : null}
          {checks ? (
            <NeedItem icon={icon(CircleXIcon, "text-danger-foreground")}>
              <span className="font-medium" title={x.checksFailedTip}>
                {x.checksFailed(checks.failed)}
              </span>
              <span className="text-muted-foreground">
                {failures.length > 0
                  ? ` · ${[...new Set(failures.map((f) => f.id))].join(", ")}`
                  : ""}{" "}
                · {x.checksSource}
              </span>
            </NeedItem>
          ) : null}
        </ul>
      </CardContent>
    </Card>
  );
}
