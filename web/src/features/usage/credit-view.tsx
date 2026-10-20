// Kiro credit: the quota snapshot polled from `kiro-cli /usage` (v1 credit-view.ts).
// Top to bottom: status, the facts that qualify the figures (first run, slowed polling,
// last attempt failed, stale), the figures, how much of the plan is gone, the trend.

import { LineChart, trendAria } from "@/components/charts";
import { Empty, Note, Section, Stat, WarnNote } from "@/components/page";
import { type Tone, ToneBadge } from "@/components/status";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { type Strings, useI18n } from "@/i18n";
import { shortTs } from "@/lib/format";
import type { PollHalt } from "@server/credit/pipeline/polling-scheduler";
import type { CreditStatus, CreditViewModel } from "@server/credit/view/credit-model";
import {
  ChartLineIcon,
  ChevronDownIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleXIcon,
  ClockAlertIcon,
  CoinsIcon,
  LoaderCircleIcon,
  type LucideIcon,
  TimerOffIcon,
  TriangleAlertIcon,
} from "lucide-react";

const STATUS: Record<CreditStatus, { tone: Tone; icon: LucideIcon }> = {
  loading: { tone: "mute", icon: LoaderCircleIcon },
  ok: { tone: "ok", icon: CircleCheckIcon },
  partial: { tone: "warn", icon: CircleAlertIcon },
  failure: { tone: "bad", icon: CircleXIcon },
  none: { tone: "mute", icon: CircleDashedIcon },
};

function statusWord(status: CreditStatus, s: Strings): string {
  const t = s.usage;
  if (status === "loading") return t.statusLoading;
  if (status === "ok") return t.statusOk;
  if (status === "partial") return t.statusPartial;
  if (status === "failure") return t.statusFailure;
  return t.statusNone;
}

/** Missing or NaN → em dash. Grouping is fixed (as v1), not by locale. */
function fmtNumber(n: number | null): string {
  if (n === null || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** 0–1 ratio → percent, one decimal, unclamped. Missing or NaN → em dash. */
function fmtRatio(r: number | null): string {
  if (r === null || Number.isNaN(r)) return "—";
  return `${(r * 100).toFixed(1)}%`;
}

/**
 * Polling slowed after consecutive failures. A different fact from "the last attempt
 * failed", so it is its own block: merged, the reader would take frozen figures as live.
 */
function HaltNotice({ halt }: { halt: PollHalt }) {
  const { s } = useI18n();
  const retryEvery = String(Math.max(1, Math.round(halt.retryEveryMs / 60_000)));
  return (
    <Alert className="border-warning/40 bg-warning/5">
      <TimerOffIcon className="text-warning-foreground" aria-hidden />
      <AlertDescription className="text-foreground/80">
        <p>{s.usage.pollHalted(String(halt.failures), retryEvery)}</p>
        {halt.lastReason === undefined ? null : (
          <p className="text-xs text-muted-foreground">
            {s.usage.pollHaltedReason(halt.lastReason)}
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}

function FailureAlert({ warning }: { warning: { raw: string; reason: string } }) {
  const { s } = useI18n();
  return (
    <Alert variant="destructive">
      <TriangleAlertIcon aria-hidden />
      <AlertDescription className="min-w-0">
        <p>{s.usage.fetchFailed(warning.reason)}</p>
        <Collapsible className="w-full min-w-0">
          <CollapsibleTrigger asChild>
            <Button variant="link" size="sm" className="group h-auto px-0 text-destructive">
              <ChevronDownIcon
                aria-hidden
                className="transition-transform group-data-[state=open]:rotate-180"
              />
              {s.usage.rawSummary}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-sm bg-muted p-3 font-mono text-xs text-foreground">
              {warning.raw || s.usage.rawEmpty}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      </AlertDescription>
    </Alert>
  );
}

export function CreditView({ credit }: { credit: CreditViewModel }) {
  const { s, c } = useI18n();
  const t = s.usage;
  const st = STATUS[credit.status];
  const cur = credit.current;
  const ratio = cur?.usageRatio ?? null;
  const ratioText = ratio === null ? t.ratioUnavailable : t.ratioLabel(fmtRatio(ratio));
  const aria = trendAria(credit.trend, s);

  return (
    <div className="space-y-6">
      <Section
        title={t.creditSection}
        icon={<CoinsIcon />}
        action={
          <div className="flex flex-wrap justify-end gap-1.5">
            <ToneBadge tone={st.tone} icon={st.icon}>
              {statusWord(credit.status, s)}
            </ToneBadge>
            {credit.freshness.stale ? (
              <ToneBadge tone="warn" icon={ClockAlertIcon}>
                {t.stalePill}
              </ToneBadge>
            ) : null}
          </div>
        }
        contentClassName="space-y-4"
      >
        {credit.status === "loading" ? (
          <output className="block text-sm text-muted-foreground">{t.firstCollection}</output>
        ) : null}
        {credit.status === "none" ? <Empty>{t.noCreditYet}</Empty> : null}
        {credit.pollHalt !== null ? <HaltNotice halt={credit.pollHalt} /> : null}
        {credit.status === "failure" && credit.warning !== null ? (
          <FailureAlert warning={credit.warning} />
        ) : null}
        {credit.freshness.stale ? <WarnNote>{t.staleNote}</WarnNote> : null}

        {cur !== null ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <Stat label={t.rowPlan} value={cur.planName ?? "—"} dashed={cur.planName === null} />
              <Stat
                label={t.rowUsed}
                value={fmtNumber(cur.usedAmount)}
                dashed={cur.usedAmount === null}
              />
              <Stat
                label={t.rowRemaining}
                value={fmtNumber(cur.remainingAmount)}
                dashed={cur.remainingAmount === null}
              />
              <Stat
                label={t.rowLimit}
                value={fmtNumber(cur.planLimit)}
                dashed={cur.planLimit === null}
              />
              <Stat label={t.rowRatio} value={fmtRatio(ratio)} dashed={ratio === null} />
            </div>
            <div className="space-y-2">
              <Progress
                value={ratio === null ? null : Math.max(0, Math.min(100, ratio * 100))}
                aria-label={ratioText}
                className="h-3 bg-muted"
              />
              <Note>{ratioText}</Note>
            </div>
            <Note>{t.lastSuccess(shortTs(credit.lastSuccessAt ?? undefined))}</Note>
          </>
        ) : null}
      </Section>

      <Section title={c.usagePage.trend} icon={<ChartLineIcon />} description={aria}>
        <LineChart series={credit.trend} s={s} aria={aria} />
      </Section>
    </div>
  );
}
