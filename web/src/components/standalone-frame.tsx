// The frame for the one page that lives OUTSIDE the sidebar layout (/pick): it must
// render before any workspace is selected, so there is no run to put in a sidebar.
// Brand mark, app name, language and theme; a way back once a workspace is active.

import { LanguageMenu, ThemeMenu } from "@/components/header-controls";
import { Button } from "@/components/ui/button";
import { useMeta } from "@/hooks/use-run";
import { useI18n } from "@/i18n";
import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import type { ReactNode } from "react";

export function StandaloneFrame({
  children,
}: {
  children: ReactNode;
}) {
  const { c } = useI18n();
  const meta = useMeta();
  const active = meta.data?.activeRoot;
  return (
    <div className="flex min-h-svh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-sm focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        {c.skipToContent}
      </a>
      <header className="sticky top-0 z-30 border-b bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/75">
        <div className={"mx-auto flex h-16 w-full max-w-6xl items-center gap-2 px-4 sm:px-6"}>
          <Link
            to="/"
            className="flex min-w-0 items-center gap-2 rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <img src="/logo.png" alt="" className="size-8 shrink-0 object-contain" />
            <span className="truncate text-base font-semibold">{c.appName}</span>
          </Link>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {active ? (
              <Button variant="ghost" size="sm" asChild>
                <Link to="/" aria-label={c.backToDashboard}>
                  <ArrowLeftIcon aria-hidden />
                  <span className="hidden sm:inline">{c.backToDashboard}</span>
                </Link>
              </Button>
            ) : null}
            <LanguageMenu />
            <ThemeMenu />
          </div>
        </div>
      </header>
      <main
        id="main"
        className={"mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6 sm:px-6 lg:py-8"}
      >
        {children}
      </main>
    </div>
  );
}
