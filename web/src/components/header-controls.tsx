import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useReload, useRun } from "@/hooks/use-run";
import { LOCALES, persistLocale, useI18n } from "@/i18n";
import { type Theme, useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import type { Locale } from "@server/model/types";
import {
  CheckIcon,
  LanguagesIcon,
  LoaderCircleIcon,
  MonitorIcon,
  MoonIcon,
  RefreshCwIcon,
  SunIcon,
} from "lucide-react";
import { useEffect } from "react";

/** Reload: button, `r` key. Shows when the model was last read. */
export function ReloadButton() {
  const { s } = useI18n();
  const run = useRun();
  const reload = useReload();
  const busy = reload.isPending || (run.isFetching && !run.isLoading);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "r" || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName) || t.isContentEditable)) return;
      reload.mutate();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reload]);

  const at = run.dataUpdatedAt ? new Date(run.dataUpdatedAt).toLocaleTimeString() : "";
  return (
    <div className="flex items-center gap-2">
      <span
        aria-live="polite"
        className={cn(
          "hidden text-xs text-muted-foreground tabular lg:inline",
          run.isError && "text-danger-foreground",
        )}
      >
        {run.isError ? s.page.jsRefreshFailed : at ? `${s.page.jsRefreshedPrefix}${at}` : ""}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={() => reload.mutate()}
            disabled={reload.isPending}
            aria-busy={busy || undefined}
          >
            {busy ? (
              <LoaderCircleIcon className="animate-spin" aria-hidden />
            ) : (
              <RefreshCwIcon aria-hidden />
            )}
            <span className="hidden sm:inline">{s.page.reloadLabel}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{s.page.reloadTitle}</TooltipContent>
      </Tooltip>
    </div>
  );
}

export function LanguageMenu() {
  const { s, locale } = useI18n();
  const label: Record<Locale, string> = { en: s.page.langEn, vi: s.page.langVi };
  const choose = (l: Locale) => {
    if (l === locale) return;
    persistLocale(l);
    location.reload();
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={s.page.langGroupLabel}>
          <LanguagesIcon aria-hidden />
          <span className="hidden uppercase md:inline">{locale}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{s.page.langGroupLabel}</DropdownMenuLabel>
        {LOCALES.map((l) => (
          <DropdownMenuItem key={l} lang={l} onSelect={() => choose(l)}>
            <CheckIcon aria-hidden className={l === locale ? "opacity-100" : "opacity-0"} />
            {label[l]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ThemeMenu() {
  const { c } = useI18n();
  const { theme, setTheme } = useTheme();
  const items: { v: Theme; label: string; Icon: typeof SunIcon }[] = [
    { v: "light", label: c.theme.light, Icon: SunIcon },
    { v: "dark", label: c.theme.dark, Icon: MoonIcon },
    { v: "system", label: c.theme.system, Icon: MonitorIcon },
  ];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={c.theme.label}>
          <SunIcon className="dark:hidden" aria-hidden />
          <MoonIcon className="hidden dark:block" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{c.theme.label}</DropdownMenuLabel>
        {items.map(({ v, label, Icon }) => (
          <DropdownMenuItem key={v} onSelect={() => setTheme(v)}>
            <Icon aria-hidden />
            <span className="flex-1">{label}</span>
            {theme === v ? <CheckIcon aria-hidden /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
