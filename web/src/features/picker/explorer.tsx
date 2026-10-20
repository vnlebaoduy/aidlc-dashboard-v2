// "Browse folders": a one-directory explorer. Root chips, breadcrumbs, a filter over the
// listed names, the hidden-folder toggle, and a way to open the folder or a child folder
// that is a workspace. Navigation stays in the URL (`?dir=&hidden=1`), so back/forward work.

import { Empty, Section } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Strings } from "@/i18n";
import { useI18n } from "@/i18n";
import { selectHref } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { BrowseResult } from "@server/scan/browse";
import type { ExplorerModel, ExplorerRootKind, ExplorerRootLabel } from "@server/scan/explorer";
import { Link } from "@tanstack/react-router";
import {
  ChevronRightIcon,
  CloudIcon,
  EyeIcon,
  EyeOffIcon,
  FolderCheckIcon,
  FolderIcon,
  FolderLockIcon,
  FolderOpenIcon,
  FolderRootIcon,
  FolderTreeIcon,
  HardDriveIcon,
  HouseIcon,
  type LucideIcon,
  MapPinIcon,
  SearchIcon,
  ServerIcon,
  XIcon,
} from "lucide-react";
import { Fragment, useId, useRef, useState } from "react";

const ROOT_ICON: Record<ExplorerRootKind, LucideIcon> = {
  home: HouseIcon,
  current: MapPinIcon,
  cloud: CloudIcon,
  drive: HardDriveIcon,
  volume: ServerIcon,
  filesystem: FolderRootIcon,
};

/** A root chip's words: the synthesised part from the catalogue, the read part verbatim. */
function rootLabel(label: ExplorerRootLabel, s: Strings): string {
  const t = s.explorer;
  switch (label.key) {
    case "home":
      return t.rootHome;
    case "current":
      return t.rootCurrent;
    case "volume":
      return t.volume(label.name);
    case "mount":
      return t.mount(label.name);
    case "media":
      return t.media(label.name);
    case "raw":
      return label.name;
    default: {
      const unhandled: never = label;
      return unhandled;
    }
  }
}

export function FolderExplorer({
  listing,
  explorer,
  hidden,
}: {
  listing: BrowseResult;
  explorer: ExplorerModel;
  hidden: boolean;
}) {
  const { s } = useI18n();
  const t = s.picker;
  const filterId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  // Keyed per directory, so a filter typed in one folder does not silently hide the next.
  const [filterDir, setFilterDir] = useState(listing.dir);
  if (filterDir !== listing.dir) {
    setFilterDir(listing.dir);
    setQuery("");
  }

  const needle = query.trim().toLocaleLowerCase();
  const rows = needle
    ? listing.entries.filter((e) => e.name.toLocaleLowerCase().includes(needle))
    : listing.entries;
  const hiddenSearch = hidden ? true : undefined;

  return (
    <Section
      id="browse"
      title={t.explorerHeading}
      icon={<FolderTreeIcon />}
      contentClassName="space-y-4"
    >
      <nav aria-label={t.explorerRootsLabel}>
        <ul className="flex flex-wrap gap-2">
          {explorer.roots.map((root) => {
            const Icon = ROOT_ICON[root.kind];
            return (
              <li key={`${root.kind}:${root.path}`}>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className={cn(
                    "rounded-full",
                    root.active && "border-foreground bg-accent font-semibold",
                  )}
                >
                  <Link
                    to="/pick"
                    resetScroll={false}
                    search={{ dir: root.path, hidden: hiddenSearch }}
                    aria-current={root.active ? "true" : undefined}
                    title={root.path}
                  >
                    <Icon aria-hidden />
                    {rootLabel(root.label, s)}
                  </Link>
                </Button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="space-y-1 rounded-lg border bg-muted/40 px-3 py-2">
        <Breadcrumb aria-label={t.breadcrumbLabel}>
          <BreadcrumbList className="gap-1 sm:gap-1.5">
            {explorer.breadcrumbs.map((crumb, i) => (
              <Fragment key={crumb.path}>
                {i > 0 ? (
                  <BreadcrumbSeparator>
                    <ChevronRightIcon />
                  </BreadcrumbSeparator>
                ) : null}
                <BreadcrumbItem className="min-w-0">
                  {crumb.current ? (
                    <BreadcrumbPage aria-current="location" className="break-all font-semibold">
                      {crumb.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild className="break-all">
                      <Link
                        to="/pick"
                        resetScroll={false}
                        search={{ dir: crumb.path, hidden: hiddenSearch }}
                      >
                        {crumb.label}
                      </Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
        <p className="break-all font-mono text-xs text-muted-foreground">{listing.dir}</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <label htmlFor={filterId} className="sr-only">
            {t.filterLabel}
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
            placeholder={t.filterPlaceholder}
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
        <div className="flex flex-wrap gap-2">
          {listing.isWorkspace ? (
            <Button size="sm" variant="action" asChild className="flex-1 sm:flex-none">
              <a href={selectHref(listing.dir)}>
                <FolderOpenIcon aria-hidden />
                {t.openThisFolder}
              </a>
            </Button>
          ) : null}
          <Button size="sm" variant="outline" asChild className="flex-1 sm:flex-none">
            <Link
              to="/pick"
              resetScroll={false}
              search={{ dir: listing.dir, hidden: hidden ? undefined : true }}
              aria-pressed={hidden}
            >
              {hidden ? <EyeOffIcon aria-hidden /> : <EyeIcon aria-hidden />}
              {hidden ? t.hideHidden : t.showHidden}
            </Link>
          </Button>
        </div>
      </div>

      {listing.entries.length === 0 ? (
        <Empty>{t.explorerEmpty}</Empty>
      ) : rows.length === 0 ? (
        <Empty>{t.filterNoMatch}</Empty>
      ) : (
        <ul className="max-h-96 divide-y overflow-y-auto rounded-lg border">
          {rows.map((e) => {
            const Icon = e.isWorkspace
              ? FolderCheckIcon
              : e.unreadable
                ? FolderLockIcon
                : FolderIcon;
            return (
              <li key={e.fullPath} className="flex min-w-0 items-center gap-2 hover:bg-accent/60">
                <Link
                  to="/pick"
                  resetScroll={false}
                  search={{ dir: e.fullPath, hidden: hiddenSearch }}
                  className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50"
                >
                  <Icon
                    className={cn(
                      "size-4 shrink-0",
                      e.isWorkspace ? "text-success-foreground" : "text-muted-foreground",
                    )}
                    aria-hidden
                  />
                  <span className="truncate">{e.name}</span>
                  {e.isWorkspace ? (
                    <Badge variant="success" className="hidden sm:inline-flex">
                      {t.tagWorkspace}
                    </Badge>
                  ) : e.isAidlcDir ? (
                    <Badge variant="info" className="hidden sm:inline-flex">
                      {t.tagAidlcTree}
                    </Badge>
                  ) : e.unreadable ? (
                    <Badge variant="muted" className="hidden sm:inline-flex">
                      {t.tagUnreadable}
                    </Badge>
                  ) : null}
                </Link>
                {e.isWorkspace || e.isAidlcDir ? (
                  <Button size="xs" variant="link" asChild className="mr-2 shrink-0">
                    <a href={selectHref(e.fullPath)} aria-label={`${t.open}: ${e.name}`}>
                      {t.open}
                    </a>
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
