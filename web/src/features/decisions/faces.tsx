// The status vocabulary of the deferral ledgers: one tone + lucide icon per owner status
// and per diary question kind. The words come from the catalogue; tone stays here.

import { type Tone, ToneBadge } from "@/components/status";
import { useI18n } from "@/i18n";
import type { AssumptionGroupStatus, DeferralReport, OwnerStatus } from "@server/scan/deferrals";
import type { DiaryRecord } from "@server/scan/memory-diary";
import {
  CircleAlertIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleHelpIcon,
  CircleOffIcon,
  CirclePlayIcon,
  CircleSlashIcon,
  ForwardIcon,
  type LucideIcon,
  MessageCircleWarningIcon,
  NotebookPenIcon,
} from "lucide-react";

/** Urgency of each owner status: a finished owner or no owner is the worst. */
export const OWNER_TONE: Record<OwnerStatus, Tone> = {
  passed: "bad",
  current: "warn",
  ahead: "mute",
  outOfScope: "warn",
  nextCycle: "mute",
  unassigned: "bad",
};

export const OWNER_ICON: Record<OwnerStatus, LucideIcon> = {
  passed: CircleAlertIcon,
  current: CirclePlayIcon,
  ahead: CircleDashedIcon,
  outOfScope: CircleOffIcon,
  nextCycle: ForwardIcon,
  unassigned: CircleHelpIcon,
};

/**
 * Assumption groups. Unconfirmed is muted, not red: an assumption is a declared
 * unknown, not a missed decision. Partial is amber because something the reader
 * accepted was carried somewhere they were never asked about it.
 */
export const ASSUMPTION_TONE: Record<AssumptionGroupStatus, Tone> = {
  accepted: "ok",
  partial: "warn",
  unconfirmed: "mute",
};
export const ASSUMPTION_ICON: Record<AssumptionGroupStatus, LucideIcon> = {
  accepted: CircleCheckIcon,
  partial: CircleSlashIcon,
  unconfirmed: CircleHelpIcon,
};

export const FOLLOW_UP_ICON = MessageCircleWarningIcon;
export const DIARY_NOTE_ICON = NotebookPenIcon;

/** Cut a verbatim workspace sentence at `max` characters, saying so with an ellipsis. */
export function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** Where an entry was recorded: `unit / stage`, or the stage alone. */
export function origin(r: { stage: string; unit?: string }): string {
  return r.unit ? `${r.unit} / ${r.stage}` : r.stage;
}

/** A status word with its icon and an optional count; a zero count is muted. */
export function Chip({
  tone,
  icon,
  label,
  tip,
  n,
}: {
  tone: Tone;
  icon: LucideIcon;
  label: string;
  tip: string;
  n?: number;
}) {
  return (
    <ToneBadge tone={n === 0 ? "mute" : tone} icon={icon} title={tip}>
      {label}
      {n !== undefined ? <span className="font-semibold tabular">{n}</span> : null}
    </ToneBadge>
  );
}

export function OwnerBadge({ status, n }: { status: OwnerStatus; n?: number }) {
  const f = useI18n().s.deferrals.faces[status];
  return (
    <Chip tone={OWNER_TONE[status]} icon={OWNER_ICON[status]} label={f.label} tip={f.tip} n={n} />
  );
}

export interface OpenDiary {
  /** Unresolved `## Open questions` entries: newest first, follow-ups ahead of notes. */
  open: DiaryRecord[];
  followUp: number;
  resolved: number;
}

/**
 * The memory.md open-questions ledger. The heading is the declaration, so a `note`
 * entry counts as open like a `followUp` one; `questionStatus` only sorts.
 */
export function openDiary(records: DiaryRecord[]): OpenDiary {
  const all = records.filter((r) => r.axis === "openQuestions");
  const open = all
    .filter((r) => r.questionStatus !== "resolved")
    .reverse()
    .sort((a, b) =>
      a.questionStatus === b.questionStatus ? 0 : a.questionStatus === "followUp" ? -1 : 1,
    );
  return {
    open,
    followUp: open.filter((r) => r.questionStatus === "followUp").length,
    resolved: all.length - open.length,
  };
}

/** The three body branches of the ledger: nothing to read, unread shapes, all `None.`. */
export type LedgerState = "noSections" | "unread" | "allNone" | "items";

export function ledgerState(d: DeferralReport): LedgerState {
  if (d.sections === 0) return "noSections";
  if (d.items.length > 0 || d.assumptions.length > 0) return "items";
  return d.sections - d.emptySections > 0 ? "unread" : "allNone";
}
