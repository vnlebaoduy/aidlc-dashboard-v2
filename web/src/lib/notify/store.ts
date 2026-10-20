// Per-browser notification state. Keyed by workspace record so two runs never share a
// "seen" set. localStorage only: nothing leaves the browser.

import { useSyncExternalStore } from "react";
import type { Notice, Seen } from "./detect";

const PREFIX = "aidlc-notify";

export interface NotifyPrefs {
  /** OS notifications (Notification API) for action-tier notices. */
  system: boolean;
  /** In-app toasts for milestone-tier notices (action ones always toast). */
  milestones: boolean;
  /** Flash the tab title while the tab is in the background and something new arrived. */
  flashTitle: boolean;
}

export const DEFAULT_PREFS: NotifyPrefs = { system: false, milestones: true, flashTitle: true };

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`${PREFIX}:${key}`);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(`${PREFIX}:${key}`, JSON.stringify(value));
  } catch {
    // Quota or private mode: notifications still work for this tab, just not remembered.
  }
}

export const store = {
  /** A pre-watermark value (a bare key array) is treated as absent: re-baseline. */
  seen: (record: string): Seen | null => {
    const v = read<unknown>(`seen:${record}`, null);
    return v && typeof v === "object" && !Array.isArray(v) && typeof (v as Seen).since === "string"
      ? (v as Seen)
      : null;
  },
  setSeen: (record: string, seen: Seen) => write(`seen:${record}`, seen),
  /** The bell's list, newest first, capped. */
  feed: (record: string) => read<FeedItem[]>(`feed:${record}`, []),
  setFeed: (record: string, items: FeedItem[]) => write(`feed:${record}`, items.slice(0, 50)),
  setPrefs: (p: NotifyPrefs) => {
    write("prefs", p);
    cachedPrefs = undefined;
    for (const fn of listeners) fn();
  },
};

// Prefs are read by the poll (background refetch) and the bell, and must agree across
// tabs, so they are an external store: same-tab writes notify `listeners`, other tabs
// arrive as `storage` events.
const listeners = new Set<() => void>();
let cachedPrefs: NotifyPrefs | undefined;

function prefsSnapshot(): NotifyPrefs {
  cachedPrefs ??= { ...DEFAULT_PREFS, ...read<Partial<NotifyPrefs>>("prefs", {}) };
  return cachedPrefs;
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== `${PREFIX}:prefs`) return;
    cachedPrefs = undefined;
    fn();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

export function useNotifyPrefs(): NotifyPrefs {
  return useSyncExternalStore(subscribe, prefsSnapshot);
}

export { prefsSnapshot as readPrefs };

export interface FeedItem extends Notice {
  /** When THIS browser first saw it (ms), for ordering and the unread mark. */
  seenAt: number;
  read: boolean;
}
