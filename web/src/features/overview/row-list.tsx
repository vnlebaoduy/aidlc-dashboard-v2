// The two building blocks of the overview cards (v1 render/card-kit.ts): a tabbed card
// and a list of bar-backed rows — a faint bar behind the label, the value right-aligned.
//
// A card's tab is CONTROLLED, and only the reader's pick is stored. Until the reader
// picks, the card follows its data-derived default (current phase, first problem tab),
// so a poll that moves the run moves the card with it; once picked, the pick sticks.

import { Section } from "@/components/page";
import { TONE_TEXT, type Tone } from "@/components/status";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import {
  ArrowRightIcon,
  CircleCheckIcon,
  CircleXIcon,
  type LucideIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { type ReactNode, useState } from "react";

/** Rows a card shows before folding the rest into "+N more". */
export const CARD_ROWS = 6;

// Static so Tailwind generates them: the faint tone behind a row's label.
const ROW_BAR: Record<Tone, string> = {
  ok: "bg-success/15",
  warn: "bg-warning/20",
  bad: "bg-destructive/15",
  info: "bg-info/15",
  alt: "bg-chart-2/15",
  mute: "bg-muted-foreground/10",
  live: "bg-primary/35 live-stripes",
};

export interface Row {
  key: string;
  icon?: ReactNode;
  label: ReactNode;
  /** Muted trailer after the label (" · units 2/3", "→ owner"). */
  sub?: ReactNode;
  value: ReactNode;
  /** Bar length 0–100. Omitted = no bar. */
  pct?: number;
  tone?: Tone;
  tip?: string;
  /** Dashed outline: "no record", which must never read as a healthy row. */
  dashed?: boolean;
  /** Dimmed: skipped / not applicable / parked. */
  dim?: boolean;
}

export function RowList({
  rows,
  head,
  headTip,
  max,
  empty,
  note,
}: {
  rows: Row[];
  head?: [string, string];
  headTip?: string;
  max?: number;
  empty?: string;
  note?: string;
}) {
  const { s } = useI18n();
  const shown = max === undefined ? rows : rows.slice(0, max);
  const rest = rows.length - shown.length;
  return (
    <div className="space-y-1">
      {head ? (
        <div className="flex justify-between gap-3 px-2 text-xs font-medium text-muted-foreground">
          <span>{head[0]}</span>
          <span
            title={headTip}
            className={cn(headTip && "cursor-help underline decoration-dotted underline-offset-2")}
          >
            {head[1]}
          </span>
        </div>
      ) : null}
      {shown.length > 0 ? (
        <ul className="space-y-1">
          {shown.map((r) => (
            <RowItem key={r.key} r={r} />
          ))}
        </ul>
      ) : (
        <p className="rounded-sm border border-dashed px-2 py-2 text-sm text-muted-foreground">
          {empty ?? "—"}
        </p>
      )}
      {rest > 0 ? (
        <p className="px-2 text-xs text-muted-foreground">{s.cards.moreRows(rest)}</p>
      ) : null}
      {note ? <p className="px-2 pt-1 text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}

function RowItem({ r }: { r: Row }) {
  const w = r.pct === undefined ? undefined : Math.max(0, Math.min(100, r.pct));
  return (
    <li
      title={r.tip}
      className={cn(
        "relative flex min-h-8 items-center gap-3 overflow-hidden rounded-sm px-2 py-1 text-sm",
        r.dashed && "border border-dashed",
        r.dim && "opacity-60",
      )}
    >
      {w !== undefined ? (
        <span
          aria-hidden
          className={cn("absolute inset-y-0 left-0 rounded-sm", ROW_BAR[r.tone ?? "info"])}
          style={{ width: `${w}%` }}
        />
      ) : null}
      <span className="relative flex min-w-0 flex-1 items-center gap-2">
        {r.icon}
        <span className="min-w-0 truncate">
          {r.label}
          {r.sub ? <span className="text-muted-foreground">{r.sub}</span> : null}
        </span>
      </span>
      <span className="relative shrink-0 text-right tabular">{r.value}</span>
    </li>
  );
}

export type CountTone = "ok" | "warn" | "bad" | "mute";

// Muted counts are "–" or "…" already; an icon there would add noise, not meaning.
const COUNT_ICON: Partial<Record<CountTone, LucideIcon>> = {
  ok: CircleCheckIcon,
  warn: TriangleAlertIcon,
  bad: CircleXIcon,
};

const COUNT_TONE: Record<CountTone, Tone> = { ok: "ok", warn: "warn", bad: "bad", mute: "mute" };

/** A tab's count. Toned counts carry an icon so the tone is never colour alone. */
function CountChip({ text, tone }: { text: string; tone?: CountTone }) {
  const Icon = tone ? COUNT_ICON[tone] : undefined;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full bg-card px-1.5 text-xs leading-5 font-semibold tabular",
        tone ? TONE_TEXT[COUNT_TONE[tone]] : "text-muted-foreground",
      )}
    >
      {Icon ? <Icon aria-hidden className="size-3" /> : null}
      {text}
    </span>
  );
}

export interface CardTab {
  label: string;
  count?: { text: string; tone?: CountTone };
  body: ReactNode;
}

export interface CardLink {
  to: "/stages" | "/timeline" | "/decisions" | "/usage";
  label: string;
}

/**
 * A summary card: title, pill tabs, the selected panel, and links to the page holding
 * the full view. `selected` is the data-derived default; a reader's pick overrides it.
 */
export function TabbedCard({
  id,
  title,
  icon,
  tabs,
  selected = 0,
  empty,
  links,
}: {
  id: string;
  title: string;
  icon: ReactNode;
  tabs: CardTab[];
  selected?: number;
  /** Shown instead of tabs when there are none. */
  empty?: string;
  links: CardLink[];
}) {
  const [picked, setPicked] = useState<string>();
  const values = tabs.map((_, i) => String(i));
  const fallback = String(Math.min(Math.max(selected, 0), Math.max(tabs.length - 1, 0)));
  const value = picked !== undefined && values.includes(picked) ? picked : fallback;
  return (
    <Section
      id={id}
      title={title}
      icon={icon}
      className="h-full min-w-0"
      contentClassName="flex flex-1 flex-col gap-4"
    >
      {tabs.length === 0 ? (
        <p className="rounded-sm border border-dashed px-2 py-2 text-sm text-muted-foreground">
          {empty ?? "—"}
        </p>
      ) : (
        <Tabs value={value} onValueChange={setPicked} className="min-w-0 gap-3">
          {/* Wraps instead of scrolling: a clipped phase tab hides its count and reads as absent. */}
          <TabsList
            aria-label={title}
            className="flex-wrap rounded-2xl group-data-[orientation=horizontal]/tabs:h-auto"
          >
            {tabs.map((t, i) => (
              <TabsTrigger key={t.label} value={String(i)} className="h-8">
                {t.label}
                {t.count ? <CountChip text={t.count.text} tone={t.count.tone} /> : null}
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((t, i) => (
            <TabsContent key={t.label} value={String(i)}>
              {t.body}
            </TabsContent>
          ))}
        </Tabs>
      )}
      <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1">
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            search={(p) => p}
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-blue underline-offset-4 hover:underline"
          >
            {l.label}
            <ArrowRightIcon aria-hidden className="size-3.5" />
          </Link>
        ))}
      </div>
    </Section>
  );
}
