import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { useMeta, useRun } from "@/hooks/use-run";
import { useI18n } from "@/i18n";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  ChartNoAxesGanttIcon,
  CoinsIcon,
  DatabaseIcon,
  FolderOpenIcon,
  LayersIcon,
  LayoutDashboardIcon,
  ListTodoIcon,
  type LucideIcon,
} from "lucide-react";

type NavKey = "overview" | "stages" | "timeline" | "decisions" | "usage" | "sources";

const NAV: { key: NavKey; to: string; icon: LucideIcon }[] = [
  { key: "overview", to: "/", icon: LayoutDashboardIcon },
  { key: "stages", to: "/stages", icon: LayersIcon },
  { key: "timeline", to: "/timeline", icon: ChartNoAxesGanttIcon },
  { key: "decisions", to: "/decisions", icon: ListTodoIcon },
  { key: "usage", to: "/usage", icon: CoinsIcon },
  { key: "sources", to: "/sources", icon: DatabaseIcon },
];

export function AppSidebar() {
  const { c } = useI18n();
  const meta = useMeta();
  const run = useRun();
  const loc = useRouterState({ select: (s) => s.location });
  // The viewer is not a nav item: while a file is open, keep the page it was opened from
  // highlighted (`from`), so the sidebar still says where the reader is in the run.
  const search: Record<string, unknown> = loc.search;
  const from = typeof search.from === "string" ? search.from : "/";
  const path = loc.pathname === "/view" ? (from.split("?")[0] ?? "/") : loc.pathname;
  const { setOpenMobile } = useSidebar();
  const m = run.data;

  // Small counts beside a nav item: only where they mean "something needs you".
  const badge: Partial<Record<NavKey, number>> = {};
  if (m) {
    if (m.blockers.length > 0) badge.overview = m.blockers.length;
    if (m.warnings.length > 0) badge.sources = m.warnings.length;
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip={c.appName}>
              <Link to="/" onClick={() => setOpenMobile(false)}>
                {/* Brand mark (web/public/logo.png). Decorative: the link is named by the
                    "AI-DLC Dashboard" text beside it and by the collapsed-state tooltip. */}
                <img src="/logo.png" alt="" className="size-8 shrink-0 object-contain" />
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate font-semibold">AI-DLC</span>
                  <span className="truncate text-xs text-muted-foreground">
                    Dashboard{meta.data?.version ? ` · v${meta.data.version}` : ""}
                  </span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{c.nav.group}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((n) => {
                const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
                return (
                  <SidebarMenuItem key={n.key}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={c.nav[n.key]}
                      className="data-[active=true]:bg-primary data-[active=true]:font-semibold data-[active=true]:text-primary-foreground"
                    >
                      <Link
                        to={n.to}
                        // Keep `cw`/`lang`, never the viewer's own rel/mode/from.
                        search={(prev) => {
                          const {
                            rel: _r,
                            mode: _m,
                            from: _f,
                            ...rest
                          }: Record<string, unknown> = prev;
                          return rest;
                        }}
                        onClick={() => setOpenMobile(false)}
                      >
                        <n.icon aria-hidden />
                        <span>{c.nav[n.key]}</span>
                      </Link>
                    </SidebarMenuButton>
                    {badge[n.key] ? (
                      <SidebarMenuBadge className="rounded-full bg-warning/15 text-warning-foreground peer-data-[active=true]/menu-button:text-primary-foreground">
                        {badge[n.key]}
                      </SidebarMenuBadge>
                    ) : null}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={path.startsWith("/pick")}
              tooltip={c.nav.workspaces}
            >
              <Link to="/pick" onClick={() => setOpenMobile(false)}>
                <FolderOpenIcon aria-hidden />
                <span>{c.nav.workspaces}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
