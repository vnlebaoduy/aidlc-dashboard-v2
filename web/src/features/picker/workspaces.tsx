// "Workspaces found": every workspace discovery could find, plus every one opened before.
// Each entry fills its own summary (progress, blockers, stage) after paint, at most four
// reads at a time, so the list itself never waits on them.
//
// Two layouts. Cards suit a handful; past MANY a 3-column card grid runs to several
// screens (20 workspaces measured ≈ 2 screens at 1440×900) and pushes "Browse folders"
// out of sight, so the default becomes a compact list (one row each) and a filter over
// name and path appears. The reader's explicit choice is kept per browser.

import { Empty, ErrorState, Note, Section } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useI18n } from "@/i18n";
import { api, selectHref } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { WorkspaceSummary } from "@server/scan/summary";
import type { WorkspaceMatch } from "@server/scan/workspaces";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  FileWarningIcon,
  FolderCheckIcon,
  FolderSearch2Icon,
  HistoryIcon,
  LayoutGridIcon,
  ListIcon,
  LoaderCircleIcon,
  MapPinIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SearchIcon,
  Trash2Icon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { useId, useRef, useState } from "react";

type Found = WorkspaceMatch & { current?: boolean };
type Layout = "cards" | "list";

/** Above this many, the list layout is the default and the filter is shown. */
const MANY = 6;
/** Rows shown before "Show N more" when nothing is filtered; one screen at 1440×900. */
const PAGE = 8;
const LAYOUT_KEY = "aidlc-picker-layout";
const REMOVED_KEY = "aidlc-picker-removed";

// Four at a time, as in v1: each summary read is synchronous on the server's one event
// loop, so an unbounded fan-out answers the last card no sooner and delays everything
// else. A finished job hands its slot straight to the next waiter, so a new caller can
// never slip in between and push the count past the cap.
const LANES = 4;
let running = 0;
const waiting: (() => void)[] = [];

async function inLane<T>(job: () => Promise<T>): Promise<T> {
  if (running < LANES) running++;
  else await new Promise<void>((resolve) => waiting.push(resolve));
  try {
    return await job();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else running--;
  }
}

export function FoundWorkspaces() {
  const { s, c, locale } = useI18n();
  const t = s.picker;
  const qc = useQueryClient();
  const found = useQuery({ queryKey: ["workspaces"], queryFn: api.workspaces, staleTime: 60_000 });
  const busy = found.isFetching;
  const filterId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [chosen, setChosen] = useState<Layout | null>(
    () => (localStorage.getItem(LAYOUT_KEY) as Layout | null) ?? null,
  );
  const [removed, setRemoved] = useState<string[]>(() => {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(REMOVED_KEY) ?? "[]");
      return Array.isArray(value) ? value.filter((p): p is string => typeof p === "string") : [];
    } catch {
      return [];
    }
  });

  function updateRemoved(paths: string[]) {
    setRemoved(paths);
    try {
      localStorage.setItem(REMOVED_KEY, JSON.stringify(paths));
    } catch {
      // Storage unavailable: removal still applies for this page.
    }
  }

  async function rescan() {
    await found.refetch();
    await qc.invalidateQueries({ queryKey: ["summary"] });
  }

  // The server lists the active workspace apart (so the switcher can name it); here it is
  // one of the found workspaces again, first and marked current.
  const d = found.data;
  const list: Found[] = d
    ? [...(d.active ? [{ ...d.active, current: true }] : []), ...d.workspaces].filter(
        (w) => !removed.includes(w.path),
      )
    : [];
  const many = list.length > MANY || query.trim().length > 0;
  const layout: Layout = chosen ?? (many ? "list" : "cards");
  const needle = query.trim().toLocaleLowerCase();
  const matches = needle
    ? list.filter(
        (w) =>
          w.name.toLocaleLowerCase().includes(needle) ||
          w.path.toLocaleLowerCase().includes(needle),
      )
    : list;
  // A filter shows every match: it is already the reader narrowing the list, and a cut
  // there would hide the one row they typed for. Unfiltered, the first page leads (the
  // current, launch-dir and recent ones sort first) and the rest is one click away.
  const capped = !needle && !expanded && matches.length > PAGE + 2;
  const shown = capped ? matches.slice(0, PAGE) : matches;

  return (
    <Section
      id="found"
      title={t.foundHeading}
      icon={<FolderSearch2Icon />}
      description={
        d ? (
          <span>
            <span className="font-semibold text-foreground tabular">
              {needle ? t.foundFiltered(String(matches.length), String(list.length)) : list.length}
            </span>
            {t.foundSuffix} ·{" "}
            <span className="tabular">
              {t.scanned(d.scannedDirectories.toLocaleString(locale))}
            </span>
          </span>
        ) : null
      }
      action={
        <Button
          variant="outline"
          size="sm"
          onClick={rescan}
          disabled={busy}
          aria-busy={busy || undefined}
        >
          {busy ? (
            <LoaderCircleIcon className="animate-spin" aria-hidden />
          ) : (
            <RefreshCwIcon aria-hidden />
          )}
          {t.rescan}
        </Button>
      }
    >
      {d ? (
        <div className="space-y-3">
          {removed.length > 0 ? (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="h-auto whitespace-normal text-left"
                onClick={() => updateRemoved([])}
              >
                <RotateCcwIcon aria-hidden />
                {t.restoreRemoved(String(removed.length))}
              </Button>
            </div>
          ) : null}
          {list.length > 1 || needle ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {many ? (
                <div className="relative min-w-0 flex-1">
                  <label htmlFor={filterId} className="sr-only">
                    {t.foundFilterLabel}
                  </label>
                  <SearchIcon
                    className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    ref={inputRef}
                    id={filterId}
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setQuery("");
                    }}
                    placeholder={t.foundFilterPlaceholder}
                    autoComplete="off"
                    spellCheck={false}
                    className="rounded-sm pr-9 pl-8 [&::-webkit-search-cancel-button]:hidden"
                  />
                  {needle ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2"
                      aria-label={t.filterClear}
                      title={t.filterClear}
                      onClick={() => {
                        setQuery("");
                        inputRef.current?.focus();
                      }}
                    >
                      <XIcon aria-hidden />
                    </Button>
                  ) : null}
                </div>
              ) : null}
              <ToggleGroup
                type="single"
                value={layout}
                onValueChange={(v) => {
                  if (!v) return;
                  localStorage.setItem(LAYOUT_KEY, v);
                  setChosen(v as Layout);
                }}
                aria-label={t.viewLabel}
                className="ml-auto rounded-full border bg-card p-1"
              >
                {(
                  [
                    ["cards", t.viewCards, LayoutGridIcon],
                    ["list", t.viewList, ListIcon],
                  ] as const
                ).map(([v, label, Icon]) => (
                  <ToggleGroupItem
                    key={v}
                    value={v}
                    aria-label={label}
                    title={label}
                    className="h-7 gap-1.5 rounded-full! px-3 text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                  >
                    <Icon aria-hidden />
                    <span className="hidden sm:inline">{label}</span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          ) : null}
          {list.length === 0 ? (
            <Empty>{t.noWorkspacesFound}</Empty>
          ) : shown.length === 0 ? (
            <Empty>{t.foundNoMatch}</Empty>
          ) : layout === "list" ? (
            <ul className="divide-y rounded-lg border">
              {shown.map((w) => (
                <li key={w.path}>
                  <WorkspaceRow w={w} onRemove={() => updateRemoved([...removed, w.path])} />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {shown.map((w) => (
                <li key={w.path} className="flex min-w-0">
                  <WorkspaceCard w={w} onRemove={() => updateRemoved([...removed, w.path])} />
                </li>
              ))}
            </ul>
          )}
          {capped || (expanded && !needle && matches.length > PAGE + 2) ? (
            <div className="flex justify-center">
              <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
                {expanded ? <ChevronUpIcon aria-hidden /> : <ChevronDownIcon aria-hidden />}
                {expanded ? t.showLess : t.showMore(String(matches.length - PAGE))}
              </Button>
            </div>
          ) : null}
          {d.truncated ? <Note className="text-warning-foreground">{t.truncated}</Note> : null}
        </div>
      ) : found.isError ? (
        <ErrorState
          error={found.error}
          action={
            <Button size="sm" variant="outline" className="mt-3" onClick={() => found.refetch()}>
              {c.retry}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
        </div>
      )}
    </Section>
  );
}

function Marks({ w }: { w: Found }) {
  const { s } = useI18n();
  const t = s.picker;
  if (!w.current && !w.nearLaunch && !w.recent) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {w.current ? (
        <Badge variant="success">
          <CircleCheckIcon aria-hidden />
          {t.currentMark}
        </Badge>
      ) : null}
      {w.nearLaunch ? (
        <Badge variant="info">
          <MapPinIcon aria-hidden />
          {t.launchMark}
        </Badge>
      ) : null}
      {w.recent && !w.current ? (
        <Badge variant="muted">
          <HistoryIcon aria-hidden />
          {t.recentMark}
        </Badge>
      ) : null}
    </div>
  );
}

function OpenButton({
  w,
  className,
  variant = "default",
  compact = false,
}: { w: Found; className?: string; variant?: "default" | "outline"; compact?: boolean }) {
  const { s } = useI18n();
  const t = s.picker;
  return (
    <Button
      size="sm"
      variant={variant}
      asChild
      className={cn(compact && "max-sm:size-8 max-sm:px-0", className)}
      title={compact ? t.openAction : undefined}
    >
      <a href={selectHref(w.path)} aria-label={`${t.openAction}: ${w.name}`}>
        <span className={cn(compact && "max-sm:sr-only")}>{t.openAction}</span>
        <ArrowRightIcon aria-hidden />
      </a>
    </Button>
  );
}

function RemoveButton({
  w,
  onRemove,
  compact = false,
}: { w: Found; onRemove: () => void; compact?: boolean }) {
  const { s } = useI18n();
  const t = s.picker;
  return (
    <Button
      type="button"
      variant="ghost"
      size={compact ? "icon-sm" : "sm"}
      className="shrink-0 text-muted-foreground hover:text-destructive"
      onClick={onRemove}
      aria-label={`${t.removeAction}: ${w.name} · ${w.path}`}
      title={t.removeHint}
    >
      <Trash2Icon aria-hidden />
      {compact ? null : t.removeAction}
    </Button>
  );
}

function WorkspaceCard({ w, onRemove }: { w: Found; onRemove: () => void }) {
  const { s } = useI18n();
  const t = s.picker;
  return (
    <Card className={cn("w-full min-w-0 gap-3", w.current && "border-success/60")}>
      <CardHeader className="gap-1">
        <CardTitle className="flex min-w-0 items-center gap-2">
          <FolderCheckIcon
            className="size-4 shrink-0 text-success-foreground"
            role="img"
            aria-label={t.workspaceKind}
          />
          <span className="truncate" title={w.name}>
            {w.name}
          </span>
        </CardTitle>
        <p className="truncate font-mono text-xs text-muted-foreground" title={w.path}>
          {w.path}
        </p>
        <div className="pt-1 empty:hidden">
          <Marks w={w} />
        </div>
      </CardHeader>
      <CardContent>
        <CardSummary dir={w.path} />
      </CardContent>
      <CardFooter className="mt-auto flex-wrap justify-between gap-2">
        <OpenButton w={w} />
        <RemoveButton w={w} onRemove={onRemove} />
      </CardFooter>
    </Card>
  );
}

/**
 * One line per workspace: identity on the left, run figures in fixed-width columns in
 * the middle so they line up down the list, the action on the right. Below md the
 * figures wrap under the name instead of squeezing it.
 */
function WorkspaceRow({ w, onRemove }: { w: Found; onRemove: () => void }) {
  const { s } = useI18n();
  const t = s.picker;
  return (
    <div
      className={cn(
        "flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:gap-4",
        w.current && "bg-success/5",
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <FolderCheckIcon
          className="mt-0.5 size-4 shrink-0 text-success-foreground"
          role="img"
          aria-label={t.workspaceKind}
        />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate font-semibold" title={w.name}>
              {w.name}
            </span>
            <Marks w={w} />
          </div>
          <p className="truncate font-mono text-xs text-muted-foreground" title={w.path}>
            {w.path}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 pl-6 md:pl-0">
        <div className="min-w-0 flex-1 md:w-72 md:flex-none">
          <CardSummary dir={w.path} row />
        </div>
        {/* Outline in the list: twenty yellow buttons would break the one-yellow-per-view
            rule (DESIGN.md) and turn every row into the loudest thing on the page. Below
            sm the label goes (the link keeps its aria-label): at 375px it took half the
            row and squeezed the stage name to "Feedback & Optimiz…". */}
        <OpenButton w={w} variant="outline" compact className="shrink-0" />
        <RemoveButton w={w} onRemove={onRemove} compact />
      </div>
    </div>
  );
}

function CardSummary({ dir, row = false }: { dir: string; row?: boolean }) {
  const { s } = useI18n();
  const t = s.picker;
  const q = useQuery({
    queryKey: ["summary", dir],
    queryFn: () => inLane(() => api.summary(dir)),
    retry: false,
    staleTime: 60_000,
  });

  if (q.isPending) {
    return row ? (
      <div className="space-y-1.5" aria-busy="true">
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-1.5 w-full" />
      </div>
    ) : (
      <div className="space-y-2" aria-busy="true">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    );
  }

  const data: WorkspaceSummary | { kind: "failed" } = q.data ?? { kind: "failed" };
  if (data.kind !== "ok") {
    const [Icon, text] =
      data.kind === "no-run"
        ? [
            CircleDashedIcon,
            data.reason === "ambiguous" ? t.summaryNoRunAmbiguous : t.summaryNoRunNone,
          ]
        : data.kind === "unreadable"
          ? [FileWarningIcon, t.summaryUnreadable]
          : [TriangleAlertIcon, t.summaryFailed];
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
        <Icon className="size-3.5 shrink-0" aria-hidden />
        {text}
      </p>
    );
  }

  // Progress and blockers come from different sources with different freshness, so each
  // carries its own tip rather than the card blending them into one figure.
  const p = data.progress;
  const b = data.blockers;
  const stage = p.currentStageDisplay || p.currentStage;
  const blockersTip = t.summaryBlockersTip(String(b.asked));
  const blockers =
    b.count > 0 ? (
      <Badge variant="warning" title={blockersTip}>
        <CircleAlertIcon aria-hidden />
        <span className="tabular">{b.count}</span> {t.summaryBlockersLabel}
      </Badge>
    ) : (
      <span className="text-xs text-muted-foreground" title={blockersTip}>
        <span className="tabular">{b.count}</span> {t.summaryBlockersLabel}
      </span>
    );
  const progressTip = t.summaryProgressTip(String(p.done), String(p.total), p.asOf || "—");

  if (row) {
    // `@container`: the row's figure column is ~18rem on md+ but the full row width below
    // it, minus the Open button — at 375px that left the stage name a few pixels ("F…").
    // Under 16rem the stage takes its own line instead of being squeezed to nothing.
    return (
      <div className="@container space-y-1" aria-live="polite">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs" title={progressTip}>
          <span className="w-9 shrink-0 font-semibold text-sm tabular">{p.pct}%</span>
          <span
            className="order-last w-full truncate text-muted-foreground @[16rem]:order-none @[16rem]:w-auto @[16rem]:min-w-0 @[16rem]:flex-1"
            title={stage}
          >
            {stage || "—"}
          </span>
          <span className="ml-auto @[16rem]:ml-0">{blockers}</span>
        </div>
        <Progress value={p.pct} aria-label={t.summaryPctLabel} className="h-1.5" />
      </div>
    );
  }

  return (
    <div className="space-y-2" aria-live="polite">
      <div title={progressTip}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm">
            <span className="font-semibold tabular">{p.pct}%</span>{" "}
            <span className="text-xs text-muted-foreground">{t.summaryPctLabel}</span>
          </span>
          {blockers}
        </div>
        <Progress value={p.pct} aria-label={t.summaryPctLabel} className="mt-1.5" />
      </div>
      {stage ? (
        <p className="truncate text-xs text-muted-foreground" title={stage}>
          {stage}
        </p>
      ) : null}
    </div>
  );
}
