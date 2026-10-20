"use client";

import { cn } from "@/lib/utils";
import { Progress as ProgressPrimitive } from "radix-ui";
import type * as React from "react";

/**
 * `live`: the work this bar measures is still going. The fill gets drifting stripes
 * (`.live-stripes`, styles.css) so a bar that has not moved for minutes still reads
 * as running rather than stuck. Pass it only while the run is actually running — a
 * complete or unknown run must look still.
 */
function Progress({
  className,
  value,
  live = false,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & { live?: boolean }) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      data-live={live || undefined}
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-primary/20", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          "h-full w-full flex-1 bg-primary transition-all",
          live && "relative live-stripes",
        )}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
