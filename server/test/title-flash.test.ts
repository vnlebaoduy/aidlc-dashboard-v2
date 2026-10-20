// Tab-title flasher (web/src/lib/notify/title-flash.ts). A tiny fake document, so the
// state machine is tested without a browser: visible = no flash; hidden = alternates;
// coming back restores the base; the base can change mid-flash without sticking.

import { afterEach, beforeEach, describe, expect, jest, test } from "bun:test";
import { FLASH_MS, createTitleFlash } from "../../web/src/lib/notify/title-flash";

function fakeDoc(visible: boolean) {
  const listeners = new Set<() => void>();
  const doc = {
    title: "base",
    visibilityState: (visible ? "visible" : "hidden") as string,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    show() {
      doc.visibilityState = "visible";
      for (const fn of listeners) fn();
    },
  };
  return doc;
}

describe("title flash", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test("a visible tab never flashes", () => {
    const doc = fakeDoc(true);
    const f = createTitleFlash(doc);
    f.start("● Approval needed");
    expect(doc.title).toBe("base");
    jest.advanceTimersByTime(FLASH_MS * 3);
    expect(doc.title).toBe("base");
  });

  test("a hidden tab alternates between the notice and the base title", () => {
    const doc = fakeDoc(false);
    const f = createTitleFlash(doc);
    f.start("● Approval needed");
    const seen = [doc.title];
    for (let i = 0; i < 3; i++) {
      jest.advanceTimersByTime(FLASH_MS);
      seen.push(doc.title);
    }
    expect(seen).toEqual(["● Approval needed", "base", "● Approval needed", "base"]);
  });

  test("coming back to the tab stops the flash on the base title", () => {
    const doc = fakeDoc(false);
    const f = createTitleFlash(doc);
    f.start("● Approval needed");
    doc.show();
    expect(doc.title).toBe("base");
    jest.advanceTimersByTime(FLASH_MS * 3);
    expect(doc.title).toBe("base");
  });

  test("a base change mid-flash is what the title returns to", () => {
    const doc = fakeDoc(false);
    const f = createTitleFlash(doc);
    f.start("● Approval needed");
    f.setBase("(1) run · AI-DLC");
    jest.advanceTimersByTime(FLASH_MS);
    expect(doc.title).toBe("(1) run · AI-DLC");
    doc.show();
    expect(doc.title).toBe("(1) run · AI-DLC");
  });
});
