// The assembled run model, shared by every page. One query, polled every `pollMs`
// (paused while the tab is hidden, unless system notifications are on), so switching pages never re-reads the workspace
// twice and every page sees the same snapshot.
//
// Refresh model (same as v1): re-read on a timer, not a file watcher — synced copies
// are written by atomic rename, which watchers can miss.

import { type UsageWindow, api } from "@/lib/api";
import { useNotifyPrefs } from "@/lib/notify/store";
import { systemSupport } from "@/lib/notify/system";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";

export function useMeta() {
  return useQuery({ queryKey: ["meta"], queryFn: api.meta, staleTime: Number.POSITIVE_INFINITY });
}

export function useWindow(): UsageWindow {
  const search = useSearch({ strict: false }) as { cw?: string };
  return search.cw === "7d" || search.cw === "all" ? search.cw : "30d";
}

export function useRun() {
  const meta = useMeta();
  const cw = useWindow();
  const poll = meta.data?.pollMs ?? 60_000;
  // With an away-signal on (OS notifications, or the flashing tab title), a hidden tab
  // keeps polling: that is the only way it can learn the run needs the reader while they
  // are looking elsewhere. Otherwise a hidden tab rests and catches up when shown again.
  const prefs = useNotifyPrefs();
  const notifyAway = prefs.flashTitle || (prefs.system && systemSupport() === "granted");
  return useQuery({
    queryKey: ["model", cw],
    queryFn: () => api.model(cw),
    enabled: meta.isSuccess,
    refetchInterval: poll > 0 ? poll : false,
    refetchIntervalInBackground: notifyAway,
    placeholderData: (prev) => prev,
  });
}

/** Manual reload: re-collect credit (503 tolerated), then re-read the model. */
export function useReload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.refresh,
    onSettled: () => qc.invalidateQueries({ queryKey: ["model"] }),
  });
}
