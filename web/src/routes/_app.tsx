// The dashboard frame: sidebar + sticky header + content. Every run page renders inside.
// No workspace selected (409) → the picker; a run that cannot be read → an error card.

import { AppSidebar } from "@/components/app-sidebar";
import { LanguageMenu, ReloadButton, ThemeMenu } from "@/components/header-controls";
import { NotificationBell } from "@/components/notification-bell";
import { ErrorState, PageSkeleton } from "@/components/page";
import { RunPill } from "@/components/run-pill";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { useRun } from "@/hooks/use-run";
import { useI18n } from "@/i18n";
import { ApiFailure } from "@/lib/api";
import { NotifyProvider } from "@/lib/notify/provider";
import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/_app")({ component: AppLayout });

function AppLayout() {
  const { c, s } = useI18n();
  const run = useRun();
  const navigate = useNavigate();
  const noWorkspace = run.error instanceof ApiFailure && run.error.error?.code === "no-workspace";

  useEffect(() => {
    if (noWorkspace) void navigate({ to: "/pick", replace: true });
  }, [noWorkspace, navigate]);

  const id = run.data?.identity;
  return (
    <NotifyProvider>
      <SidebarProvider>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-sm focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
        >
          {c.skipToContent}
        </a>
        <AppSidebar />
        <SidebarInset className="min-w-0">
          <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b bg-card/90 px-3 backdrop-blur supports-[backdrop-filter]:bg-card/75 sm:px-4">
            <SidebarTrigger aria-label={c.toggleSidebar} />
            <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-6" />
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <WorkspaceSwitcher name={id ? (id.slug ?? id.record) : c.appName} root={id?.root} />
              {/* lg, not md: from md the sidebar is open beside it and a long workspace
                  name plus the pill no longer fit in front of the header buttons. */}
              {run.data ? <RunPill m={run.data} className="hidden lg:inline-flex" /> : null}
            </div>
            <ReloadButton />
            {run.data ? <NotificationBell /> : null}
            <LanguageMenu />
            <ThemeMenu />
          </header>
          <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:py-8">
            {run.data ? (
              <Outlet />
            ) : run.isError && !noWorkspace ? (
              <ErrorState
                error={run.error}
                action={
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" asChild>
                      <a href="/pick">{s.errorPage.pickAnother}</a>
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => run.refetch()}>
                      {c.retry}
                    </Button>
                  </div>
                }
              />
            ) : (
              <PageSkeleton />
            )}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </NotifyProvider>
  );
}
