// The list rows of the decisions page: an artifact item, an assumption, a diary open
// question. Each reads left to right as status → where it was recorded → where it is
// owed → how long → the sentence, with both source links. Long lists fold past LIMIT.

import { OpenInEditor, ViewLink } from "@/components/art-link";
import { Empty } from "@/components/page";
import { TONE_TEXT } from "@/components/status";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useI18n } from "@/i18n";
import { dur, fullTs, shortTs } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AssumptionGroup, DeferralAssumption, DeferralItem } from "@server/scan/deferrals";
import type { DiaryRecord } from "@server/scan/memory-diary";
import { ArrowRightIcon, ChevronDownIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import {
  ASSUMPTION_ICON,
  ASSUMPTION_TONE,
  Chip,
  DIARY_NOTE_ICON,
  FOLLOW_UP_ICON,
  OwnerBadge,
  clip,
  origin,
} from "./faces";

/** Rows shown before the rest folds behind a "more" toggle. */
const LIMIT = 20;

function Row({
  badge,
  route,
  meta,
  rel,
  text,
  foot,
}: {
  badge: ReactNode;
  route: ReactNode;
  meta?: ReactNode;
  rel: string;
  text: string;
  foot?: ReactNode;
}) {
  const t = useI18n().s.deferrals;
  return (
    <li className="space-y-2 rounded-lg border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
        {badge}
        <span className="flex min-w-0 flex-wrap items-center gap-1.5 font-mono">{route}</span>
        {meta}
        <span className="ml-auto flex items-center gap-1">
          <ViewLink rel={rel} title={t.viewTip(rel)} className="text-xs font-medium">
            {t.sourceLink}
          </ViewLink>
          <OpenInEditor rel={rel} label={t.openTip(rel)} />
        </span>
      </div>
      <p className="text-sm leading-6 wrap-break-word">{text}</p>
      {foot}
    </li>
  );
}

export function ItemRow({ it }: { it: DeferralItem }) {
  const t = useI18n().s.deferrals;
  return (
    <Row
      badge={<OwnerBadge status={it.ownerStatus} />}
      route={
        <>
          <span className="min-w-0 break-all text-muted-foreground">{origin(it)}</span>
          <ArrowRightIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 break-all font-medium">{it.ownerStage ?? "—"}</span>
        </>
      }
      meta={
        <>
          {it.sources.length > 1 ? (
            <Badge variant="outline" className="tabular" title={it.sources.join("\n")}>
              +{it.sources.length - 1}
            </Badge>
          ) : null}
          <span className="tabular text-muted-foreground" title={t.ageTip}>
            {dur(it.ageSec)}
          </span>
        </>
      }
      rel={it.rel}
      text={clip(it.item, 300)}
      foot={
        it.assignment.length > 0 ? (
          // The cell is markdown and its slugs arrive backticked; inside <code> the
          // backticks are redundant, so they come off here, not in the scanner.
          <p className="text-xs text-muted-foreground wrap-break-word">
            {t.assignLabel}{" "}
            <code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-foreground">
              {clip(it.assignment.replace(/`/g, ""), 160)}
            </code>
          </p>
        ) : null
      }
    />
  );
}

/**
 * One assumption, however many artifacts restate it. The badge is the group's status;
 * with more than one restatement, the "written in N places" toggle lists each place with
 * its own status, so a partly accepted group says exactly which copy nobody asked about.
 */
export function AssumptionGroupRow({ g }: { g: AssumptionGroup }) {
  const t = useI18n().s.deferrals;
  const [open, setOpen] = useState(false);
  const first = g.members[0] as DeferralAssumption;
  const face = t.assumptionStatus[g.status];
  const stages = [...new Set(g.members.map((m) => origin(m)))];
  return (
    <Row
      badge={
        <Chip
          tone={ASSUMPTION_TONE[g.status]}
          icon={ASSUMPTION_ICON[g.status]}
          label={face.label}
          tip={face.tip}
        />
      }
      route={<span className="min-w-0 break-all text-muted-foreground">{stages.join(" · ")}</span>}
      rel={first.rel}
      text={clip(g.text, 260)}
      foot={
        g.members.length > 1 ? (
          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger className="inline-flex items-center gap-1 rounded-sm text-xs font-medium text-brand-blue outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
              <ChevronDownIcon
                className={cn("size-3.5 transition-transform", open && "rotate-180")}
                aria-hidden
              />
              {t.assumptionSources(g.members.length)}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="mt-2 space-y-1.5 border-l pl-3">
                {g.members.map((m) => (
                  <MemberLine key={m.rel + m.text} m={m} />
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        ) : first.accepted && first.acceptedIn ? (
          <AcceptedIn rel={first.acceptedIn} />
        ) : null
      }
    />
  );
}

function MemberLine({ m }: { m: DeferralAssumption }) {
  const t = useI18n().s.deferrals;
  const st = m.accepted ? "accepted" : "unconfirmed";
  const Icon = ASSUMPTION_ICON[st];
  return (
    <li className="space-y-0.5 text-xs">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <Icon
          className={cn("size-3.5 shrink-0", TONE_TEXT[ASSUMPTION_TONE[st]])}
          aria-label={t.assumptionStatus[st].label}
          role="img"
        />
        <span className="font-mono text-muted-foreground">{origin(m)}</span>
        <ViewLink rel={m.rel} title={t.viewTip(m.rel)} className="font-mono">
          {m.rel.split("/").pop()}
        </ViewLink>
      </div>
      <p className="text-muted-foreground wrap-break-word">{clip(m.text, 200)}</p>
      {m.accepted && m.acceptedIn ? <AcceptedIn rel={m.acceptedIn} /> : null}
    </li>
  );
}

function AcceptedIn({ rel }: { rel: string }) {
  const t = useI18n().s.deferrals;
  return (
    <p className="text-xs text-success-foreground">
      {t.assumptionAcceptedIn}{" "}
      <ViewLink rel={rel} title={t.viewTip(rel)} className="font-mono">
        {rel.split("/").pop()}
      </ViewLink>
    </p>
  );
}

export function DiaryRow({ r, now }: { r: DiaryRecord; now: number }) {
  const t = useI18n().s.deferrals;
  const followUp = r.questionStatus === "followUp";
  const age = r.ts ? (now - Date.parse(r.ts)) / 1000 : undefined;
  return (
    <Row
      badge={
        <Chip
          tone={followUp ? "warn" : "mute"}
          icon={followUp ? FOLLOW_UP_ICON : DIARY_NOTE_ICON}
          label={followUp ? t.diaryFollowUpPill : t.diaryNotePill}
          tip={followUp ? t.diaryFollowUpTip : t.diaryNoteTip}
        />
      }
      route={<span className="min-w-0 break-all text-muted-foreground">{origin(r)}</span>}
      meta={
        r.ts ? (
          <span className="tabular text-muted-foreground" title={fullTs(r.ts)}>
            {shortTs(r.ts)}
            {age !== undefined && age >= 0 ? ` · ${dur(age)}` : ""}
          </span>
        ) : null
      }
      rel={r.rel}
      text={clip(r.text, 260)}
    />
  );
}

/** A full list, folded past LIMIT; an empty one says "None." rather than vanishing. */
export function RowList<T>({
  rows,
  render,
  moreKey,
}: {
  rows: T[];
  render: (row: T, i: number) => ReactNode;
  moreKey: string;
}) {
  const t = useI18n().s.deferrals;
  const [open, setOpen] = useState(false);
  if (rows.length === 0) return <Empty>{t.noneApplicable}</Empty>;
  const rest = rows.slice(LIMIT);
  return (
    <div className="space-y-2">
      <ul className="space-y-2">{rows.slice(0, LIMIT).map(render)}</ul>
      {rest.length > 0 ? (
        <Collapsible open={open} onOpenChange={setOpen} className="space-y-2">
          <CollapsibleTrigger className="inline-flex items-center gap-1.5 rounded-sm px-1 py-1 text-sm font-medium text-brand-blue outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
            <ChevronDownIcon
              className={cn("size-4 transition-transform", open && "rotate-180")}
              aria-hidden
            />
            {t.more(moreKey, rest.length)}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="space-y-2">{rest.map((row, i) => render(row, i + LIMIT))}</ul>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  );
}
