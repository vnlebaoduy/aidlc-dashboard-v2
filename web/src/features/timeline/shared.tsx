// Pieces every Timeline section shares: the five-bucket vocabulary (same order and
// swatches as v1's breakdown, gantt fill and `ganttLegend`), the share formatter, and
// the folding card that stands in for v1's `<details>`.

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { Strings } from "@/i18n";
import { LEGEND } from "@/lib/rich";
import { cn } from "@/lib/utils";
import type { GapSplit } from "@server/scan/timing";
import { ChevronDownIcon } from "lucide-react";
import { type ReactNode, useState } from "react";

export type Split = Pick<
  GapSplit,
  "humanWaitSec" | "parkedSec" | "observedSec" | "conversationSec" | "unknownSec"
>;

export type BucketKind = "wait" | "parked" | "observed" | "conv" | "unknown";

export interface Bucket {
  kind: BucketKind;
  label: string;
  tip: string;
  sec: number;
  /** Swatch / fill class, shared with the `<i class="lg …">` legend in catalogue copy. */
  swatch: string;
}

/** The five buckets of one split, in v1's order: wait, parked, observed, conv, unknown. */
export function bucketsOf(g: Split, t: Strings["timeline"]): Bucket[] {
  const rows: [BucketKind, string, string, number][] = [
    ["wait", t.bucketWait, t.bucketWaitTip, g.humanWaitSec],
    ["parked", t.bucketParked, t.bucketParkedTip, g.parkedSec],
    ["observed", t.bucketObserved, t.bucketObservedTip, g.observedSec],
    ["conv", t.bucketConversation, t.bucketConversationTip, g.conversationSec],
    ["unknown", t.bucketUnknown, t.bucketUnknownTip, g.unknownSec],
  ];
  return rows.map(([kind, label, tip, sec]) => ({
    kind,
    label,
    tip,
    sec,
    swatch: LEGEND[kind] ?? "",
  }));
}

/** `value / total` as a one-decimal percentage string; "0.0" when there is no total. */
export function pctOf(value: number, total: number): string {
  return total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
}

export function Swatch({ className }: { className: string }) {
  return (
    <span aria-hidden className={cn("inline-block size-2.5 shrink-0 rounded-sm", className)} />
  );
}

/** A card whose body folds away — v1's `<details>`, with the summary as the title. */
export function FoldSection({
  title,
  icon,
  defaultOpen,
  children,
  id,
}: {
  title: ReactNode;
  icon: ReactNode;
  defaultOpen: boolean;
  children: ReactNode;
  id?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card id={id} className="scroll-mt-20">
      <Collapsible open={open} onOpenChange={setOpen} className="flex flex-col gap-4">
        <CardHeader>
          <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-sm text-left text-base font-semibold leading-6 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
            <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>
            <span className="min-w-0 flex-1">{title}</span>
            <ChevronDownIcon
              aria-hidden
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform",
                open && "rotate-180",
              )}
            />
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="min-w-0 space-y-4">{children}</CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
