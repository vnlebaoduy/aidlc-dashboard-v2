// The usage window (`?cw=`): 7d / 30d / all as pills, yellow when active. Changing it
// rewrites only `cw` in the URL, so every other search param survives and the run query
// re-keys on the new window.

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useWindow } from "@/hooks/use-run";
import { useI18n } from "@/i18n";
import type { TrendWindow } from "@server/credit/trend/trend";
import { useNavigate } from "@tanstack/react-router";

const WINDOW_ORDER: readonly TrendWindow[] = ["7d", "30d", "all"];

export function WindowToggle({ label }: { label: string }) {
  const { s } = useI18n();
  const cw = useWindow();
  const navigate = useNavigate();
  const chip: Record<TrendWindow, string> = {
    "7d": s.usage.window7d,
    "30d": s.usage.window30d,
    all: s.usage.windowAll,
  };
  const long: Record<TrendWindow, string> = {
    "7d": s.usage.windowLong7d,
    "30d": s.usage.windowLong30d,
    all: s.usage.windowLongAll,
  };
  return (
    <ToggleGroup
      type="single"
      value={cw}
      spacing={1}
      aria-label={label}
      onValueChange={(v) => {
        if (v === "7d" || v === "30d" || v === "all") {
          void navigate({ to: ".", search: (p) => ({ ...p, cw: v }) });
        }
      }}
      className="rounded-full border bg-card p-1"
    >
      {WINDOW_ORDER.map((w) => (
        <ToggleGroupItem
          key={w}
          value={w}
          aria-label={long[w]}
          className="h-8 rounded-full px-3.5 text-foreground/60 hover:bg-muted hover:text-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          {chip[w]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
