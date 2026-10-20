// Run state in one pill: pulsing dot while running, check when complete, dashed when
// unknown. Lives in the header, so every page answers "is it moving?".

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useI18n } from "@/i18n";
import { dur } from "@/lib/format";
import { cn } from "@/lib/utils";
import { buildStatus } from "@server/model/status";
import type { DashboardModel } from "@server/model/types";
import { CircleCheckIcon, CircleDashedIcon } from "lucide-react";

export function RunPill({ m, className }: { m: DashboardModel; className?: string }) {
  const { s } = useI18n();
  const st = buildStatus(m).run;
  const x = s.status;
  const base =
    "inline-flex h-7 min-w-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium";
  if (st.state === "complete")
    return (
      <span
        className={cn(
          base,
          "shrink-0 border-success/30 bg-success/10 text-success-foreground",
          className,
        )}
      >
        <CircleCheckIcon className="size-3.5" aria-hidden />
        {x.runComplete}
      </span>
    );
  if (st.state === "unknown")
    return (
      <span className={cn(base, "shrink-0 border-dashed text-muted-foreground", className)}>
        <CircleDashedIcon className="size-3.5" aria-hidden />
        {x.runUnknown}
      </span>
    );
  const phase = m.state.lifecyclePhase;
  const where = phase ? `${phase} › ${st.stageDisplay}` : st.stageDisplay;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          // Running is the brand's active yellow, as a fill with black text (never yellow
          // text on a light surface — DESIGN.md). The dot pings; the rest is still.
          className={cn(
            base,
            "border-primary bg-primary text-primary-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
            className,
          )}
        >
          <span className="relative flex size-2 shrink-0" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary-foreground opacity-50" />
            <span className="relative inline-flex size-2 rounded-full bg-primary-foreground" />
          </span>
          <span className="shrink-0">{x.running}</span>
          <span className="truncate font-normal text-primary-foreground/70">
            {x.runningSub(where, dur(st.lastEventAgeSec))}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{x.runTip}</TooltipContent>
    </Tooltip>
  );
}
