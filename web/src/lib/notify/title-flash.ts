// Tab-title flashing: while the tab is in the background and something new arrived, the
// title alternates between the notice and the normal title, so a glance at the tab strip
// says "look here". It stops the moment the tab is shown again.
//
// The base title is passed in, never read back from `document.title`, so the flash can
// never get stuck as the title (the classic bug of capturing the flashed text as "base").

export const FLASH_MS = 1000;

export interface Flash {
  /** Begin (or retarget) flashing `message`. No-op while the tab is visible. */
  start: (message: string) => void;
  /** Stop and restore the base title. */
  stop: () => void;
  /** The non-flashing title changed (unread count, workspace). */
  setBase: (title: string) => void;
  dispose: () => void;
}

/** The slice of `document` the flasher touches — keeps it testable without a DOM. */
export interface TitleDoc {
  title: string;
  readonly visibilityState: string;
  addEventListener(type: "visibilitychange", fn: () => void): void;
  removeEventListener(type: "visibilitychange", fn: () => void): void;
}

export function createTitleFlash(doc: TitleDoc): Flash {
  let base = doc.title;
  let message: string | null = null;
  let on = false;
  let timer: ReturnType<typeof setInterval> | undefined;

  const render = () => {
    doc.title = message !== null && on ? message : base;
  };
  const stop = () => {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
    message = null;
    on = false;
    render();
  };
  const onVisible = () => {
    if (doc.visibilityState === "visible") stop();
  };
  doc.addEventListener("visibilitychange", onVisible);

  return {
    start: (msg) => {
      if (doc.visibilityState === "visible") return;
      message = msg;
      on = true;
      render();
      if (timer === undefined) {
        timer = setInterval(() => {
          on = !on;
          render();
        }, FLASH_MS);
      }
    },
    stop,
    setBase: (title) => {
      base = title;
      render();
    },
    dispose: () => {
      stop();
      doc.removeEventListener("visibilitychange", onVisible);
    },
  };
}
