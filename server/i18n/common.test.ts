import { describe, expect, test } from "bun:test";
import { shortTs } from "./common";

describe("shortTs", () => {
  test("renders the instant in the local zone, not the UTC digits", () => {
    const ts = "2026-10-06T06:04:33Z";
    const d = new Date(ts);
    const p = (n: number) => String(n).padStart(2, "0");
    const local = `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
    expect(shortTs(ts)).toBe(local);
  });

  // `bun test` runs in UTC, where local == UTC and a UTC-slicing formatter would pass
  // by accident. The zone is set for this file so the GMT+7 reading is really checked.
  test("GMT+7 reads seven hours ahead of UTC, across midnight", () => {
    const prev = process.env.TZ;
    process.env.TZ = "Asia/Ho_Chi_Minh";
    try {
      expect(shortTs("2026-10-06T06:04:33Z")).toBe("10-06 13:04");
      expect(shortTs("2026-10-06T20:30:00Z")).toBe("10-07 03:30");
    } finally {
      process.env.TZ = prev ?? "UTC";
    }
  });

  test("empty is an em dash; unparseable text is shown as is", () => {
    expect(shortTs(undefined)).toBe("—");
    expect(shortTs("not a date")).toBe("not a date");
  });
});
