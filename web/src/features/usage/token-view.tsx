// Claude Code tokens, aggregated from local transcripts (v1 token-view.ts). No quota
// exists there, so this reports measured tokens rather than a share of an unknown limit.
// Top to bottom: status and the notes that qualify the count, the totals, per model,
// session time (an independent cross-check), the daily trend.

import { LineChart, windowLabel } from "@/components/charts";
import { Note, Section, Stat } from "@/components/page";
import { Bar, type Tone, ToneBadge } from "@/components/status";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { type Strings, useI18n } from "@/i18n";
import { hours, shortTs } from "@/lib/format";
import { Rich, esc } from "@/lib/rich";
import type { TokenNote, TokenStatus, TokenViewModel } from "@server/credit/claude/token-model";
import {
  BoxesIcon,
  ChartLineIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CpuIcon,
  InfoIcon,
  type LucideIcon,
  TimerIcon,
  TriangleAlertIcon,
} from "lucide-react";

const STATUS: Record<TokenStatus, { tone: Tone; icon: LucideIcon }> = {
  ok: { tone: "ok", icon: CircleCheckIcon },
  partial: { tone: "warn", icon: CircleAlertIcon },
  none: { tone: "mute", icon: CircleDashedIcon },
};

function fmtNumber(n: number | null, locale: string): string {
  if (n === null || Number.isNaN(n)) return "—";
  return n.toLocaleString(locale);
}

/** 0–1 ratio → percent, one decimal. Missing → em dash. */
function fmtPercent(ratio: number | null): string {
  if (ratio === null || Number.isNaN(ratio)) return "—";
  return `${(ratio * 100).toFixed(1)}%`;
}

function noteText(note: TokenNote, s: Strings): string {
  const t = s.usage;
  const n = (v: number) => fmtNumber(v, s.locale);
  switch (note.code) {
    case "no-transcripts":
      return t.noteNoTranscripts(note.triedPath);
    case "files-capped":
      return t.noteFilesCapped(n(note.count));
    case "unreadable-files":
      return t.noteUnreadableFiles(n(note.count));
    case "malformed-lines":
      return t.noteMalformedLines(n(note.count));
    default: {
      const unhandled: never = note;
      return unhandled;
    }
  }
}

function statusWord(status: TokenStatus, s: Strings): string {
  if (status === "ok") return s.usage.statusOk;
  if (status === "partial") return s.usage.tokenPartial;
  return s.usage.statusNone;
}

function ModelTable({ tokens }: { tokens: TokenViewModel }) {
  const { s } = useI18n();
  const t = s.usage;
  const n = (v: number) => fmtNumber(v, s.locale);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t.colModel}</TableHead>
          <TableHead className="text-right">{t.rowTokenTotal}</TableHead>
          <TableHead className="text-right">{t.rowOutput}</TableHead>
          <TableHead className="text-right">{t.rowMessages}</TableHead>
          <TableHead className="min-w-40">{t.colShare}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tokens.byModel.map((row) => {
          // Same sum as transcript-reader.ts `totalOf` (node-only module): thinking sits inside output.
          const total =
            row.totals.input + row.totals.output + row.totals.cacheRead + row.totals.cacheCreate;
          const share = tokens.grandTotal > 0 ? (total / tokens.grandTotal) * 100 : null;
          return (
            <TableRow key={row.model}>
              <TableCell className="font-mono text-xs">{row.model}</TableCell>
              <TableCell className="text-right tabular">{n(total)}</TableCell>
              <TableCell className="text-right tabular">{n(row.totals.output)}</TableCell>
              <TableCell className="text-right tabular">{n(row.messages)}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Bar pct={share ?? 0} className="min-w-20 flex-1" />
                  <span className="w-12 text-right text-xs text-muted-foreground tabular">
                    {share === null ? "—" : `${share.toFixed(1)}%`}
                  </span>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/**
 * Session wall clock from `cost-state` checkpoints. Not authoritative: the timeline
 * answers the same question from the audit ledger, and sessions do not map onto stages,
 * so the copy says so. Nothing renders when the run has no such records.
 */
function SessionTime({ tokens }: { tokens: TokenViewModel }) {
  const { s, c } = useI18n();
  const t = s.usage;
  const st = tokens.sessionTime;
  if (st === null) return null;
  const n = (v: number) => fmtNumber(v, s.locale);
  if (st.sessions === 0) {
    if (st.straddling === 0) return null;
    return (
      <Section title={c.usagePage.sessionTime} icon={<TimerIcon />}>
        <Note>{t.sessionAllStraddling(n(st.straddling))}</Note>
      </Section>
    );
  }
  return (
    <Section title={c.usagePage.sessionTime} icon={<TimerIcon />} contentClassName="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t.rowSessionWall} value={hours(st.totalSec)} />
        <Stat
          label={t.rowSessionApi}
          value={hours(st.apiSec)}
          sub={st.apiRatio === null ? undefined : fmtPercent(st.apiRatio)}
        />
        <Stat label={t.rowSessionTool} value={hours(st.toolSec)} />
        <Stat label={t.rowSessionCount} value={n(st.sessions)} />
      </div>
      {st.straddling > 0 ? <Note>{t.sessionStraddling(n(st.straddling))}</Note> : null}
      <Note>{t.sessionCrossCheck}</Note>
    </Section>
  );
}

export function TokenView({ tokens }: { tokens: TokenViewModel }) {
  const { s, c } = useI18n();
  const t = s.usage;
  const st = STATUS[tokens.status];
  const n = (v: number | null) => fmtNumber(v, s.locale);
  const w = windowLabel(tokens.trend.window, s);
  const { summary } = tokens.trend;
  const trendText =
    summary.count === 0
      ? t.tokenChartEmpty(w)
      : t.tokenChartSummary(w, summary.count, n(summary.min), n(summary.max), n(summary.latest));
  const span =
    tokens.firstActivityAt !== null && tokens.lastActivityAt !== null
      ? `${esc(shortTs(tokens.firstActivityAt))} — ${esc(shortTs(tokens.lastActivityAt))}`
      : "—";

  return (
    <div className="space-y-6">
      <Section
        title={t.tokenSection}
        icon={<CpuIcon />}
        action={
          <div className="flex flex-wrap justify-end gap-1.5">
            <ToneBadge tone={st.tone} icon={st.icon}>
              {statusWord(tokens.status, s)}
            </ToneBadge>
            <Badge variant="muted">Claude Code</Badge>
          </div>
        }
        contentClassName="space-y-4"
      >
        {tokens.notes.map((note) => (
          <Alert key={note.code} className="border-warning/40 bg-warning/5">
            <TriangleAlertIcon className="text-warning-foreground" aria-hidden />
            <AlertDescription className="break-words text-foreground/80">
              {noteText(note, s)}
            </AlertDescription>
          </Alert>
        ))}
        {tokens.status === "none" && tokens.dir !== null ? (
          <p className="text-sm text-muted-foreground">{t.noTokens}</p>
        ) : null}

        {tokens.messages > 0 ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Stat label={t.rowTokenTotal} value={n(tokens.grandTotal)} />
              <Stat label={t.rowInput} value={n(tokens.totals.input)} />
              <Stat label={t.rowOutput} value={n(tokens.totals.output)} />
              <Stat label={t.rowThinking} value={n(tokens.totals.thinking)} />
              <Stat label={t.rowCacheRead} value={n(tokens.totals.cacheRead)} />
              <Stat label={t.rowCacheCreate} value={n(tokens.totals.cacheCreate)} />
              <Stat
                label={
                  <Tooltip>
                    <TooltipTrigger className="inline-flex items-center gap-1 underline decoration-dotted underline-offset-4">
                      {t.rowCachedPrompt}
                      <InfoIcon aria-hidden className="size-3" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">{t.rowCachedPromptTip}</TooltipContent>
                  </Tooltip>
                }
                value={fmtPercent(tokens.cachedPromptRatio)}
                dashed={tokens.cachedPromptRatio === null}
              />
              <Stat label={t.rowSessions} value={n(tokens.sessions)} />
              <Stat label={t.rowMessages} value={n(tokens.messages)} />
            </div>
            <Note>
              <Rich html={t.span(span)} />
            </Note>
            {tokens.sidechainMessages > 0 ? (
              <Note>{t.sidechain(n(tokens.sidechainMessages))}</Note>
            ) : null}
          </>
        ) : null}
      </Section>

      {tokens.messages > 0 && tokens.byModel.length > 0 ? (
        <Section title={c.usagePage.byModel} icon={<BoxesIcon />}>
          <ModelTable tokens={tokens} />
        </Section>
      ) : null}

      {tokens.messages > 0 ? <SessionTime tokens={tokens} /> : null}

      <Section title={c.usagePage.trend} icon={<ChartLineIcon />} description={trendText}>
        <LineChart series={tokens.trend} s={s} aria={trendText} format={n} />
      </Section>
    </div>
  );
}
