import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useI18n } from "@/i18n";
import { api, selectHref } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  CheckIcon,
  ChevronsUpDownIcon,
  FolderIcon,
  FolderOpenIcon,
  LoaderCircleIcon,
} from "lucide-react";
import { useState } from "react";

/**
 * The header title is the switcher. The list is fetched on first open (discovery walks
 * the disk), retried on the next open after a failure. Switching goes through `/select`,
 * which the server validates.
 */
export function WorkspaceSwitcher({ name, root }: { name: string; root?: string }) {
  const { s, c } = useI18n();
  const [opened, setOpened] = useState(false);
  const list = useQuery({
    queryKey: ["workspaces"],
    queryFn: api.workspaces,
    enabled: opened,
    staleTime: 60_000,
  });

  // The header has room for the name and the END of the path — the folder that tells
  // two workspaces apart. Long paths keep their last two segments behind "…/"; the
  // tooltip (and the accessible name) carry the full path.
  const sep = root?.includes("\\") ? "\\" : "/";
  const parts = root?.split(/[\\/]/).filter(Boolean) ?? [];
  const shown = root && parts.length > 3 ? `…${sep}${parts.slice(-2).join(sep)}` : root;

  return (
    <DropdownMenu onOpenChange={(o) => o && setOpened(true)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              // `shrink` + a cap: the Button default is shrink-0, which let a long path
              // take the whole row and squeeze the run pill beside it to nothing. The
              // floor keeps the name readable when the sidebar leaves little room.
              className="h-auto min-w-[min(8rem,100%)] max-w-[min(26rem,100%)] shrink justify-start gap-2 px-2 py-1 text-left"
              aria-label={root ? `${name}, ${root}` : name}
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-base font-semibold leading-6">{name}</span>
                {shown ? (
                  <span className="truncate font-mono text-xs font-normal text-muted-foreground">
                    {shown}
                  </span>
                ) : null}
              </span>
              <ChevronsUpDownIcon className="shrink-0 text-muted-foreground" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent align="start" className="max-w-[min(40rem,calc(100vw-2rem))]">
          {root ? <p className="font-mono break-all">{root}</p> : null}
          <p className="opacity-80">{s.page.wsMenuTip}</p>
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="w-[min(32rem,calc(100vw-2rem))]">
        <DropdownMenuLabel>{s.page.wsHeading}</DropdownMenuLabel>
        {list.isLoading ? (
          <DropdownMenuItem disabled>
            <LoaderCircleIcon className="animate-spin" aria-hidden />
            {s.page.wsLoading}
          </DropdownMenuItem>
        ) : list.isError ? (
          <DropdownMenuItem disabled className="text-danger-foreground">
            {s.page.wsLoadFailed}
          </DropdownMenuItem>
        ) : list.data ? (
          <>
            {list.data.active ? (
              <DropdownMenuItem
                aria-current="true"
                className="items-start"
                onSelect={(e) => e.preventDefault()}
              >
                <CheckIcon className="mt-0.5" aria-hidden />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{list.data.active.name}</span>
                  <span
                    className="truncate font-mono text-xs text-muted-foreground"
                    title={list.data.active.path}
                  >
                    {list.data.active.path}
                  </span>
                </span>
                <span className="ml-auto rounded-full bg-primary px-2 text-xs font-medium text-primary-foreground">
                  {s.page.wsCurrent}
                </span>
              </DropdownMenuItem>
            ) : null}
            {list.data.workspaces.map((w) => (
              <DropdownMenuItem key={w.path} asChild className="items-start">
                <a href={selectHref(w.path)}>
                  <FolderIcon className="mt-0.5" aria-hidden />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{w.name}</span>
                    <span
                      className="truncate font-mono text-xs text-muted-foreground"
                      title={w.path}
                    >
                      {w.path}
                    </span>
                  </span>
                </a>
              </DropdownMenuItem>
            ))}
            {list.data.workspaces.length === 0 ? (
              <DropdownMenuItem disabled>{s.page.wsNoOthers}</DropdownMenuItem>
            ) : null}
            {list.data.truncated ? (
              <p className="px-2 py-1 text-xs text-muted-foreground">{s.page.wsTruncated}</p>
            ) : null}
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/pick">
            <FolderOpenIcon aria-hidden />
            {c.nav.workspaces}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
