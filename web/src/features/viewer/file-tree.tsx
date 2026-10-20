// The viewer's left rail: phase → stage → files, so the reader can jump from one record
// file to the next without leaving the viewer. The stage holding the open file is
// expanded and the file is marked; a filter narrows by file name, unit or stage.

import { StageIcon } from "@/components/status";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { kindIcon, stageRows } from "@/features/stages/stage-files";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import type { DashboardModel } from "@server/model/types";
import { Link } from "@tanstack/react-router";
import { ChevronRightIcon, SearchIcon, XIcon } from "lucide-react";
import { useMemo, useState } from "react";

export function FileTree({
  m,
  current,
  from,
  onPick,
}: {
  m: DashboardModel;
  current: string;
  /** Where the viewer was opened from; every file link keeps it so Back still returns there. */
  from?: string;
  /** Called after a file is chosen (the mobile sheet closes itself). */
  onPick?: () => void;
}) {
  const { c } = useI18n();
  const [query, setQuery] = useState("");
  const needle = query.trim().toLocaleLowerCase();

  const phases = useMemo(
    () =>
      m.state.phases
        .map((p) => ({
          p,
          rows: stageRows(p, m.artifacts)
            .map((r) => ({
              ...r,
              files: needle
                ? r.files.filter((f) =>
                    `${f.name} ${f.unit ?? ""} ${r.display}`.toLocaleLowerCase().includes(needle),
                  )
                : r.files,
            }))
            .filter((r) => r.files.length > 0),
        }))
        .filter((x) => x.rows.length > 0),
    [m, needle],
  );

  // Bring the open file into view in the rail when the viewer opens on it (and again
  // after each pick). A ref callback runs exactly when the active row mounts.
  const scrollActive = (el: HTMLAnchorElement | null) => el?.scrollIntoView({ block: "nearest" });

  const total = phases.reduce((n, x) => n + x.rows.reduce((k, r) => k + r.files.length, 0), 0);

  return (
    <nav aria-label={c.viewerPage.files} className="flex min-h-0 flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <p className="text-sm font-semibold">{c.viewerPage.files}</p>
        <span className="text-xs text-muted-foreground tabular">{total}</span>
      </div>
      <div className="relative">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setQuery("")}
          placeholder={c.viewerPage.filter}
          aria-label={c.viewerPage.filter}
          className="h-8 pr-8 pl-8 text-sm"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label={c.viewerPage.filter}
            className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent"
          >
            <XIcon className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>

      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1">
        {phases.length === 0 ? (
          <p className="px-1 py-4 text-sm text-muted-foreground">
            {needle ? c.viewerPage.noMatch : c.viewerPage.noFiles}
          </p>
        ) : (
          <div className="space-y-4">
            {phases.map(({ p, rows }) => (
              <div key={p.key}>
                <p className="px-1 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {p.display}
                </p>
                <ul className="space-y-0.5">
                  {rows.map((r) => {
                    const holdsCurrent = r.files.some((f) => f.rel === current);
                    return (
                      <li key={r.slug}>
                        {/* Keyed by filter so a search opens every match; otherwise only the
                            stage holding the open file starts expanded. */}
                        <Collapsible
                          key={needle ? "q" : "n"}
                          defaultOpen={holdsCurrent || !!needle}
                        >
                          <CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-sm px-1.5 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50">
                            <ChevronRightIcon
                              className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-90 motion-reduce:transition-none"
                              aria-hidden
                            />
                            <StageIcon status={r.status} className="size-3.5" />
                            <span
                              className={cn(
                                "min-w-0 flex-1 truncate",
                                holdsCurrent && "font-semibold",
                              )}
                            >
                              {r.display}
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground tabular">
                              {r.files.length}
                            </span>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <ul className="mt-0.5 mb-1 ml-3.5 space-y-0.5 border-l pl-2">
                              {r.files.map((f) => {
                                const Icon = kindIcon(f);
                                const active = f.rel === current;
                                return (
                                  <li key={f.rel}>
                                    <Link
                                      ref={active ? scrollActive : undefined}
                                      to="/view"
                                      search={(prev) => ({ ...prev, rel: f.rel, from })}
                                      // Hopping between files replaces the entry, so Back
                                      // leaves the viewer in one step instead of ten.
                                      replace
                                      onClick={onPick}
                                      title={f.rel}
                                      aria-current={active ? "page" : undefined}
                                      className={cn(
                                        "flex min-w-0 items-center gap-2 rounded-sm px-1.5 py-1 text-sm outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50",
                                        active &&
                                          "bg-primary font-medium text-primary-foreground hover:bg-primary",
                                      )}
                                    >
                                      <Icon
                                        className={cn(
                                          "size-3.5 shrink-0",
                                          active ? "" : "text-muted-foreground",
                                        )}
                                        aria-hidden
                                      />
                                      <span className="min-w-0 flex-1 truncate">{f.name}</span>
                                      {f.unit ? (
                                        <Badge
                                          variant={active ? "secondary" : "outline"}
                                          // Start-aligned: Badge centres its content, so overflow was cut at BOTH ends.
                                          className="block max-w-24 shrink-0 justify-start truncate px-1.5 text-[10px]"
                                        >
                                          {f.unit}
                                        </Badge>
                                      ) : null}
                                    </Link>
                                  </li>
                                );
                              })}
                            </ul>
                          </CollapsibleContent>
                        </Collapsible>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
