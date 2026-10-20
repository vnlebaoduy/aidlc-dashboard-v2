// The notification loop: every new model snapshot → notices → diff against what this
// browser already saw for this workspace → toast / OS notification / bell / tab title.
//
// Runs once, in the `_app` layout, so it fires on any page and never twice. Detection
// is pure (detect.ts); this file is only delivery and state.

import { useRun } from "@/hooks/use-run";
import { useI18n } from "@/i18n";
import { useNavigate } from "@tanstack/react-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { type Notice, diffNotices, noticesOf } from "./detect";
import { type FeedItem, type NotifyPrefs, readPrefs, store, useNotifyPrefs } from "./store";
import { type SystemSupport, requestSystem, showSystem, systemSupport } from "./system";
import { type Flash, createTitleFlash } from "./title-flash";

interface NotifyState {
  feed: FeedItem[];
  unread: number;
  /** Unread action-tier notices: what the tab title counts. */
  unreadActions: number;
  prefs: NotifyPrefs;
  setPrefs: (p: NotifyPrefs) => void;
  support: SystemSupport;
  enableSystem: () => Promise<void>;
  markAllRead: () => void;
  clear: () => void;
  openNotice: (n: Notice) => void;
  /** The bell popover's open state. While open, new notices land in the list only. */
  bellOpen: boolean;
  setBellOpen: (open: boolean) => void;
}

const NotifyContext = createContext<NotifyState | null>(null);

export function useNotify(): NotifyState {
  const ctx = useContext(NotifyContext);
  if (!ctx) throw new Error("useNotify outside NotifyProvider");
  return ctx;
}

export function NotifyProvider({ children }: { children: React.ReactNode }) {
  const { c } = useI18n();
  const run = useRun();
  const navigate = useNavigate();
  const record = run.data?.identity.record;
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const prefs = useNotifyPrefs();
  const [support, setSupport] = useState<SystemSupport>(systemSupport);
  const [bellOpen, setBellOpenState] = useState(false);
  // Read inside the poll effect without making it re-run on every open/close.
  const bellOpenRef = useRef(false);
  const setBellOpen = useCallback((open: boolean) => {
    bellOpenRef.current = open;
    setBellOpenState(open);
    // The list now shows every notice; a toast left on screen would only cover it.
    if (open) toast.dismiss();
  }, []);

  // The title flasher lives for the provider's lifetime; it owns `document.title`.
  const flash = useRef<Flash | null>(null);
  useEffect(() => {
    flash.current = createTitleFlash(document);
    return () => {
      flash.current?.dispose();
      flash.current = null;
    };
  }, []);

  // Permission granted or revoked from the address bar (site settings) must show up
  // without a reload: re-read on focus, and on the Permissions API change event.
  useEffect(() => {
    const sync = () => setSupport(systemSupport());
    window.addEventListener("focus", sync);
    let status: PermissionStatus | undefined;
    void navigator.permissions
      ?.query({ name: "notifications" })
      .then((s) => {
        status = s;
        s.addEventListener("change", sync);
      })
      .catch(() => undefined);
    return () => {
      window.removeEventListener("focus", sync);
      status?.removeEventListener("change", sync);
    };
  }, []);

  // Switching workspace switches the feed.
  useEffect(() => {
    if (record) setFeed(store.feed(record));
  }, [record]);

  const go = useCallback(
    (n: Notice) => {
      if (n.rel)
        void navigate({
          to: "/view",
          search: { rel: n.rel, from: location.pathname + location.search },
        });
      else if (n.kind === "gate" || n.kind === "stuck" || n.kind === "check-failed")
        void navigate({ to: "/" });
      else void navigate({ to: "/stages", search: (p) => p });
    },
    [navigate],
  );

  // Opening a notice — from the bell, a toast or an OS notification — is reading it.
  const openNotice = useCallback(
    (n: Notice) => {
      if (record) {
        const next = store.feed(record).map((f) => (f.key === n.key ? { ...f, read: true } : f));
        store.setFeed(record, next);
        setFeed(next);
      }
      go(n);
    },
    [record, go],
  );

  // The loop. `dataUpdatedAt` changes on every successful read, so a poll that brings
  // nothing new still runs the (cheap) diff and finds nothing.
  const m = run.data;
  const updatedAt = run.dataUpdatedAt;
  useEffect(() => {
    if (!m || !updatedAt) return;
    const rec = m.identity.record;
    const { fresh, seen } = diffNotices(noticesOf(m), store.seen(rec), m.generatedAt);
    store.setSeen(rec, seen);
    if (fresh.length === 0) return;

    const now = Date.now();
    const items: FeedItem[] = fresh.map((n) => ({ ...n, seenAt: now, read: false }));
    const next = [...items, ...store.feed(rec)].slice(0, 50);
    store.setFeed(rec, next);
    setFeed(next);

    // Background tab: flash the newest notice in the title. Action notices win over
    // milestones; with milestone pop-ups off, only action notices flash.
    const flashWith =
      fresh.find((n) => n.tier === "action") ?? (readPrefs().milestones ? fresh[0] : undefined);
    if (flashWith && readPrefs().flashTitle) {
      const more = fresh.length > 1 ? ` +${fresh.length - 1}` : "";
      flash.current?.start(`● ${c.notify.titles[flashWith.kind]}${more}`);
    }

    // A burst (first poll after a long sleep) collapses into one toast per tier, so the
    // screen is never buried; every item is still in the bell.
    const actions = fresh.filter((n) => n.tier === "action");
    const milestones = fresh.filter((n) => n.tier === "milestone");
    const announce = (list: Notice[], important: boolean) => {
      if (list.length === 0) return;
      const first = list[0]!;
      const title =
        list.length === 1
          ? c.notify.titles[first.kind]
          : `${c.notify.titles[first.kind]} +${list.length - 1}`;
      const body = c.notify.body(first.kind, first.subject, first.detail);
      const opts = {
        description: body,
        action: { label: c.notify.open, onClick: () => openNotice(first) },
      };
      if (important) toast.warning(title, { ...opts, duration: 10_000 });
      else toast.success(title, { ...opts, duration: 5_000 });
      // OS notifications only for what needs the reader, and only when they are away.
      if (important && readPrefs().system && document.visibilityState !== "visible") {
        showSystem(title, body, first.key, () => openNotice(first));
      }
    };
    // While the bell is open the reader is looking at the list itself; a toast would
    // only sit on top of it. The OS notification still goes out for a hidden tab.
    if (bellOpenRef.current) {
      if (readPrefs().system && document.visibilityState !== "visible" && actions[0]) {
        const a = actions[0];
        showSystem(c.notify.titles[a.kind], c.notify.body(a.kind, a.subject, a.detail), a.key, () =>
          openNotice(a),
        );
      }
      return;
    }
    announce(actions, true);
    if (readPrefs().milestones) announce(milestones, false);
  }, [m, updatedAt, c, openNotice]);

  const unread = feed.filter((f) => !f.read).length;
  const unreadActions = feed.filter((f) => !f.read && f.tier === "action").length;

  // The tab title is owned here (not by the layout): it carries the unread action count,
  // so a background tab still says "(2) demo-migration · AI-DLC".
  const name = m ? (m.identity.slug ?? m.identity.record) : undefined;
  useEffect(() => {
    if (!name) return;
    flash.current?.setBase(`${unreadActions > 0 ? `(${unreadActions}) ` : ""}${name} · AI-DLC`);
  }, [unreadActions, name]);

  const setPrefs = useCallback((p: NotifyPrefs) => store.setPrefs(p), []);

  const value = useMemo<NotifyState>(
    () => ({
      feed,
      unread,
      unreadActions,
      prefs,
      setPrefs,
      support,
      enableSystem: async () => {
        const x = c.notify;
        const s = await requestSystem();
        if (s === "dismissed") {
          toast.info(x.systemDismissedTitle, {
            description: x.systemDismissed,
            duration: 12_000,
          });
          return;
        }
        setSupport(s);
        if (s === "granted") {
          setPrefs({ ...prefs, system: true });
          // Proof it works, at the moment the reader expects it.
          showSystem(x.systemTestTitle, x.systemTestBody, "aidlc-test", () => {});
        }
      },
      markAllRead: () => {
        if (!record) return;
        const next = feed.map((f) => ({ ...f, read: true }));
        store.setFeed(record, next);
        setFeed(next);
      },
      clear: () => {
        if (!record) return;
        store.setFeed(record, []);
        setFeed([]);
      },
      openNotice,
      bellOpen,
      setBellOpen,
    }),
    [
      feed,
      unread,
      unreadActions,
      prefs,
      setPrefs,
      support,
      record,
      openNotice,
      bellOpen,
      setBellOpen,
      c.notify,
    ],
  );

  return <NotifyContext.Provider value={value}>{children}</NotifyContext.Provider>;
}
