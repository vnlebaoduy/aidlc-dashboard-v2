// The one status vocabulary: a lucide icon + a word + a tone. Every page uses these, so
// a stage, a cell or a source reads the same everywhere. Colour is never the only cue.

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CellState } from "@server/scan/matrix";
import type { StageStatus } from "@server/scan/parser";
import {
  CircleCheckIcon,
  CircleDashedIcon,
  CircleIcon,
  CirclePauseIcon,
  CirclePlayIcon,
  CircleSlashIcon,
  type LucideIcon,
  RotateCcwIcon,
  ShieldQuestionIcon,
  SquareCheckIcon,
  SquareDashedIcon,
  SquareDotIcon,
  SquareIcon,
  SquareMinusIcon,
} from "lucide-react";

/**
 * `live` is "the run is working on this right now": yellow, the brand's active colour.
 * Yellow is never text on a light surface (DESIGN.md), so text and icons take the dark
 * amber `warning-foreground`, and the yellow itself is a fill — bars, badges, the pill.
 */
export type Tone = "ok" | "warn" | "bad" | "info" | "alt" | "mute" | "live";

export const TONE_TEXT: Record<Tone, string> = {
  ok: "text-success-foreground",
  warn: "text-warning-foreground",
  bad: "text-danger-foreground",
  info: "text-info-foreground",
  alt: "text-chart-2",
  mute: "text-muted-foreground",
  live: "text-warning-foreground",
};

export const TONE_BAR: Record<Tone, string> = {
  ok: "bg-success",
  warn: "bg-warning",
  bad: "bg-destructive",
  info: "bg-info",
  alt: "bg-chart-2",
  mute: "bg-muted-foreground/40",
  live: "bg-primary relative live-stripes",
};

const TONE_BADGE: Record<
  Tone,
  "success" | "warning" | "danger" | "info" | "secondary" | "muted" | "default"
> = {
  ok: "success",
  warn: "warning",
  bad: "danger",
  info: "info",
  alt: "secondary",
  mute: "muted",
  live: "default",
};

export function ToneBadge({
  tone,
  icon: Icon,
  children,
  title,
  className,
}: {
  tone: Tone;
  icon?: LucideIcon;
  children: React.ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <Badge variant={TONE_BADGE[tone]} title={title} className={className}>
      {Icon ? <Icon aria-hidden /> : null}
      {children}
    </Badge>
  );
}

export const STAGE_ICON: Record<StageStatus, LucideIcon> = {
  done: CircleCheckIcon,
  active: CirclePlayIcon,
  awaiting: CirclePauseIcon,
  revising: RotateCcwIcon,
  skipped: CircleSlashIcon,
  pending: CircleIcon,
};

export const STAGE_TONE: Record<StageStatus, Tone> = {
  done: "ok",
  active: "live",
  awaiting: "warn",
  revising: "warn",
  skipped: "mute",
  pending: "mute",
};

/** The running stage's icon breathes; every other status is still. */
export function StageIcon({ status, className }: { status: StageStatus; className?: string }) {
  const Icon = STAGE_ICON[status];
  return (
    <Icon
      aria-hidden
      className={cn(
        "size-4 shrink-0",
        TONE_TEXT[STAGE_TONE[status]],
        status === "active" && "animate-pulse",
        className,
      )}
    />
  );
}

export const CELL_ICON: Record<CellState, LucideIcon> = {
  complete: SquareCheckIcon,
  unsettled: ShieldQuestionIcon,
  unverified: SquareDotIcon,
  partial: SquareDashedIcon,
  "n/a": SquareMinusIcon,
  absent: SquareIcon,
};

export const CELL_TONE: Record<CellState, Tone> = {
  complete: "ok",
  unsettled: "warn",
  unverified: "alt",
  partial: "warn",
  "n/a": "mute",
  absent: "mute",
};

export function CellIcon({ state, className }: { state: CellState; className?: string }) {
  const Icon = CELL_ICON[state];
  return (
    <Icon aria-hidden className={cn("size-4 shrink-0", TONE_TEXT[CELL_TONE[state]], className)} />
  );
}

export { CircleDashedIcon as UnknownIcon };

/** A thin horizontal bar, 0–100. */
export function Bar({
  pct,
  tone = "info",
  className,
}: { pct: number; tone?: Tone; className?: string }) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className={cn("h-full rounded-full transition-[width] duration-300", TONE_BAR[tone])}
        style={{ width: `${w}%` }}
      />
    </div>
  );
}
