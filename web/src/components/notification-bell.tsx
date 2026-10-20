// Header bell: unread count, the feed (newest first), and its settings. The settings sit
// behind their own button in the header row (with Mark all read / Clear) and replace the
// list while open, so the panel never grows and the list keeps all the room it has.

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n";
import { dur } from "@/lib/format";
import { useNotify } from "@/lib/notify/provider";
import { cn } from "@/lib/utils";
import {
  BellIcon,
  BellRingIcon,
  CheckCheckIcon,
  ChevronLeftIcon,
  CircleAlertIcon,
  FlagIcon,
  SettingsIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";

export function NotificationBell() {
  const { c } = useI18n();
  const n = useNotify();
  const x = c.notify;
  const systemNote =
    n.support === "insecure"
      ? x.systemInsecure
      : n.support === "unsupported"
        ? x.systemUnsupported
        : n.support === "denied"
          ? x.systemDenied
          : x.systemHint;

  const [view, setView] = useState<"list" | "settings">("list");

  return (
    <Popover
      open={n.bellOpen}
      onOpenChange={(open) => {
        n.setBellOpen(open);
        // Always reopen on the list: that is what the bell is for.
        if (!open) setView("list");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={n.unread > 0 ? `${x.bell} (${n.unread})` : x.bell}
          className="relative"
        >
          {n.unreadActions > 0 ? <BellRingIcon aria-hidden /> : <BellIcon aria-hidden />}
          {n.unread > 0 ? (
            <span
              aria-hidden
              className={cn(
                "absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular",
                n.unreadActions > 0
                  ? "bg-destructive text-white"
                  : "bg-primary text-primary-foreground",
              )}
            >
              {n.unread > 9 ? "9+" : n.unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      {/* Column layout capped to the space Radix measured below the trigger: the header
          stays put, only the body scrolls. */}
      <PopoverContent
        align="end"
        collisionPadding={8}
        className="flex max-h-(--radix-popover-content-available-height) w-[min(24rem,calc(100vw-1rem))] flex-col overflow-hidden p-0"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-3">
          {view === "settings" ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView("list")}
              className="-ml-2 gap-1 px-2 font-semibold"
            >
              <ChevronLeftIcon aria-hidden />
              {x.settings}
            </Button>
          ) : (
            <p className="font-semibold">{x.heading}</p>
          )}
          <div className="flex gap-1">
            {view === "list" ? (
              <>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={n.markAllRead}
                  disabled={n.unread === 0}
                  aria-label={x.markAllRead}
                  title={x.markAllRead}
                >
                  <CheckCheckIcon aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={n.clear}
                  disabled={n.feed.length === 0}
                  aria-label={x.clear}
                  title={x.clear}
                >
                  <Trash2Icon aria-hidden />
                </Button>
              </>
            ) : null}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setView(view === "settings" ? "list" : "settings")}
              aria-label={x.settings}
              aria-pressed={view === "settings"}
              title={x.settings}
              className={cn(view === "settings" && "bg-accent text-accent-foreground")}
            >
              <SettingsIcon aria-hidden />
            </Button>
          </div>
        </div>
        <Separator className="shrink-0" />
        {view === "settings" ? (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <label htmlFor="notify-system" className="text-sm font-medium">
                  {x.systemLabel}
                </label>
                <p className="text-xs text-muted-foreground">{systemNote}</p>
              </div>
              {n.support === "default" ? (
                <Button size="sm" onClick={() => void n.enableSystem()}>
                  {x.systemEnable}
                </Button>
              ) : (
                <Switch
                  id="notify-system"
                  checked={n.support === "granted" && n.prefs.system}
                  disabled={n.support !== "granted"}
                  onCheckedChange={(v) => n.setPrefs({ ...n.prefs, system: v })}
                />
              )}
            </div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <label htmlFor="notify-flash" className="text-sm font-medium">
                  {x.flashLabel}
                </label>
                <p className="text-xs text-muted-foreground">{x.flashHint}</p>
              </div>
              <Switch
                id="notify-flash"
                checked={n.prefs.flashTitle}
                onCheckedChange={(v) => n.setPrefs({ ...n.prefs, flashTitle: v })}
              />
            </div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <label htmlFor="notify-milestones" className="text-sm font-medium">
                  {x.milestonesLabel}
                </label>
                <p className="text-xs text-muted-foreground">{x.milestonesHint}</p>
              </div>
              <Switch
                id="notify-milestones"
                checked={n.prefs.milestones}
                onCheckedChange={(v) => n.setPrefs({ ...n.prefs, milestones: v })}
              />
            </div>
          </div>
        ) : n.feed.length === 0 ? (
          <p className="shrink-0 px-4 py-6 text-center text-sm text-muted-foreground">{x.empty}</p>
        ) : (
          // Native overflow, not ScrollArea: its viewport is `size-full`, which only
          // scrolls under a FIXED-height root; with a max-height it grows to its content.
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <ul className="divide-y">
              {n.feed.map((f) => {
                const Icon = f.tier === "action" ? CircleAlertIcon : FlagIcon;
                return (
                  <li key={f.key}>
                    <button
                      type="button"
                      onClick={() => {
                        // Read, go there, and get out of the way.
                        n.setBellOpen(false);
                        setView("list");
                        n.openNotice(f);
                      }}
                      className="flex w-full gap-3 px-4 py-3 text-left outline-none hover:bg-accent focus-visible:bg-accent"
                    >
                      <Icon
                        aria-hidden
                        className={cn(
                          "mt-0.5 size-4 shrink-0",
                          f.tier === "action"
                            ? "text-warning-foreground"
                            : "text-success-foreground",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className={cn("truncate text-sm", !f.read && "font-semibold")}>
                            {x.titles[f.kind]}
                          </span>
                          {!f.read ? (
                            <span
                              aria-hidden
                              className="size-1.5 shrink-0 rounded-full bg-brand-blue"
                            />
                          ) : null}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {x.body(f.kind, f.subject, f.detail)}
                        </span>
                        <span className="block text-xs text-muted-foreground tabular">
                          {f.tier === "action" ? x.tierAction : x.tierMilestone} ·{" "}
                          {dur((Date.now() - f.seenAt) / 1000)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
