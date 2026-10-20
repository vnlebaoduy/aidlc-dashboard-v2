// Ledger summary: the three open-item ledgers, a figure each, never summed. Only the
// artifact ledger has owners, so only it carries the owner-status breakdown.

import { Empty, Note, Section, Stat, WarnNote } from "@/components/page";
import { TONE_TEXT, type Tone, ToneBadge } from "@/components/status";
import { useI18n } from "@/i18n";
import { Rich } from "@/lib/rich";
import type { DashboardModel } from "@server/model/types";
import type { AssumptionGroupStatus, OwnerStatus } from "@server/scan/deferrals";
import { CircleCheckIcon, ListTodoIcon, TriangleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  ASSUMPTION_ICON,
  ASSUMPTION_TONE,
  Chip,
  DIARY_NOTE_ICON,
  FOLLOW_UP_ICON,
  type LedgerState,
  type OpenDiary,
  OwnerBadge,
} from "./faces";

/** The two that need action, then the two that are merely scheduled or ownerless. */
const KPI_ORDER: OwnerStatus[] = ["passed", "current", "ahead", "unassigned"];

function Ledger({
  n,
  tone,
  label,
  source,
  chips,
}: {
  n: number;
  tone: Tone;
  label: string;
  source: string;
  chips: ReactNode;
}) {
  return (
    <Stat
      label={label}
      value={n}
      tone={TONE_TEXT[tone]}
      sub={
        <>
          <Rich html={source} />
          <div className="mt-2 flex flex-wrap gap-1.5">{chips}</div>
        </>
      }
    />
  );
}

export function LedgerSummary({
  m,
  state,
  diary,
}: {
  m: DashboardModel;
  state: LedgerState;
  diary: OpenDiary;
}) {
  const { s } = useI18n();
  const t = s.deferrals;
  const d = m.deferrals;

  if (state !== "items") {
    return (
      <Section title={t.section} icon={<ListTodoIcon />}>
        {state === "noSections" ? (
          <Empty>
            <Rich html={t.noSections(d.artifacts)} />
          </Empty>
        ) : state === "unread" ? (
          <Empty className="border-warning/50 text-foreground/80">
            <TriangleAlertIcon
              className="mx-auto mb-2 size-5 text-warning-foreground"
              aria-hidden
            />
            <Rich
              html={t.unreadSections(d.sections, d.sections - d.emptySections, d.emptySections)}
            />
          </Empty>
        ) : (
          <Empty>
            <ToneBadge tone="ok" icon={CircleCheckIcon} title={t.noOpenPillTip} className="mb-2">
              {t.noOpenPill}
            </ToneBadge>
            <div>
              <Rich html={t.allNone(d.sections)} />
            </div>
          </Empty>
        )}
      </Section>
    );
  }

  // Urgency of the whole ledger is its worst live status, not its size.
  const itemsTone: Tone =
    d.counts.passed > 0 || d.counts.unassigned > 0 ? "bad" : d.counts.current > 0 ? "warn" : "mute";
  const exits = d.counts.nextCycle + d.counts.outOfScope;
  const groupCount = (st: AssumptionGroupStatus) =>
    d.assumptionGroups.filter((g) => g.status === st).length;

  return (
    <Section title={t.section} icon={<ListTodoIcon />} contentClassName="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Ledger
          n={d.items.length}
          tone={itemsTone}
          label={t.ledgerItems}
          source={t.ledgerItemsSource}
          chips={KPI_ORDER.map((st) => <OwnerBadge key={st} status={st} n={d.counts[st]} />)}
        />
        {d.assumptionGroups.length > 0 ? (
          <Ledger
            n={d.assumptionGroups.length}
            tone={groupCount("partial") > 0 ? "warn" : "mute"}
            label={t.ledgerAssumptions}
            source={t.ledgerAssumptionsSource}
            chips={(["unconfirmed", "partial", "accepted"] as const).map((st) => (
              <Chip
                key={st}
                tone={ASSUMPTION_TONE[st]}
                icon={ASSUMPTION_ICON[st]}
                label={t.assumptionStatus[st].label}
                tip={st === "unconfirmed" ? t.chipUnassignedTip : t.assumptionStatus[st].tip}
                n={groupCount(st)}
              />
            ))}
          />
        ) : null}
        {diary.open.length > 0 ? (
          <Ledger
            n={diary.open.length}
            tone={diary.followUp > 0 ? "warn" : "mute"}
            label={t.ledgerDiary}
            source={t.ledgerDiarySource}
            chips={
              <>
                <Chip
                  tone="warn"
                  icon={FOLLOW_UP_ICON}
                  label={t.chipFollowUp}
                  tip={t.chipFollowUpTip}
                  n={diary.followUp}
                />
                <Chip
                  tone="mute"
                  icon={DIARY_NOTE_ICON}
                  label={t.chipOther}
                  tip={t.chipOtherTip}
                  n={diary.open.length - diary.followUp}
                />
              </>
            }
          />
        ) : null}
      </div>
      <Note>
        <Rich html={t.ledgersNote} />
      </Note>
      <p className="text-sm leading-6 text-muted-foreground">
        <Rich html={t.lead(d.items.length, d.sections, d.rows, exits)} />
      </p>
      {d.catalogMissing ? (
        <WarnNote>
          <Rich html={t.catalogMissingNote} />
        </WarnNote>
      ) : null}
    </Section>
  );
}
