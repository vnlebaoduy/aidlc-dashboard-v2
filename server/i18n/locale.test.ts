// Locale resolution — the whole of the locale-wiring step that has behaviour.
//
// Pure functions over header/query strings: no request, no server, no I/O.

import { describe, expect, test } from "bun:test";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isLocale,
  localeCookie,
  localeFromAcceptLanguage,
  localeFromCookie,
  localeFromQuery,
  resolveLocale,
} from "./locale";

describe("isLocale / localeFromQuery", () => {
  test("only the two supported values pass", () => {
    expect(isLocale("vi")).toBe(true);
    expect(isLocale("en")).toBe(true);
    // Regional tags are NOT locales here: matching is on the primary subtag only.
    expect(isLocale("vi-VN")).toBe(false);
    expect(isLocale("ko")).toBe(false);
    expect(isLocale("ja")).toBe(false);
    expect(isLocale("")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale(7)).toBe(false);
  });

  test("an unsupported ?lang= is undefined, not the default — it must fall through", () => {
    expect(localeFromQuery("en")).toBe("en");
    expect(localeFromQuery("de")).toBeUndefined();
    expect(localeFromQuery(null)).toBeUndefined();
  });
});

describe("localeFromCookie", () => {
  test("reads its own cookie out of a crowded header", () => {
    expect(localeFromCookie(`a=1; ${LOCALE_COOKIE}=en; b=2`)).toBe("en");
    expect(localeFromCookie(`${LOCALE_COOKIE}=vi`)).toBe("vi");
  });

  test("a cookie whose value is not a locale falls through", () => {
    expect(localeFromCookie(`${LOCALE_COOKIE}=fr`)).toBeUndefined();
    expect(localeFromCookie("other=en")).toBeUndefined();
    expect(localeFromCookie("")).toBeUndefined();
    expect(localeFromCookie(null)).toBeUndefined();
  });

  test("a name that merely ends with the cookie name is not it", () => {
    expect(localeFromCookie(`x_${LOCALE_COOKIE}=en`)).toBeUndefined();
  });
});

describe("localeFromAcceptLanguage", () => {
  test("matches on the primary subtag, so en-GB and vi-VN both land", () => {
    expect(localeFromAcceptLanguage("vi-VN,vi;q=0.9")).toBe("vi");
    expect(localeFromAcceptLanguage("en-GB")).toBe("en");
    expect(localeFromAcceptLanguage("vi-VN")).toBe("vi");
  });

  test("q-value decides, not header order", () => {
    expect(localeFromAcceptLanguage("en;q=0.4,vi;q=0.9")).toBe("vi");
    expect(localeFromAcceptLanguage("vi;q=0.2,en;q=0.8")).toBe("en");
    // Equal weights keep header order — that IS the client's ranking.
    expect(localeFromAcceptLanguage("en,vi")).toBe("en");
  });

  test("unsupported languages and the wildcard yield undefined", () => {
    // `*` says "anything", which the --lang default already answers; treating it as a
    // match would let a browser that expressed no preference override the operator's.
    expect(localeFromAcceptLanguage("*")).toBeUndefined();
    expect(localeFromAcceptLanguage("ja,ko-KR;q=0.8")).toBeUndefined();
    expect(localeFromAcceptLanguage("")).toBeUndefined();
    expect(localeFromAcceptLanguage(null)).toBeUndefined();
  });

  test("skips unsupported entries to reach a supported one", () => {
    expect(localeFromAcceptLanguage("ja;q=1.0,de;q=0.9,en;q=0.5")).toBe("en");
  });
});

describe("resolveLocale precedence", () => {
  test("?lang= outranks cookie, which outranks Accept-Language, which outranks --lang", () => {
    const all = {
      query: "en",
      cookie: `${LOCALE_COOKIE}=vi`,
      acceptLanguage: "vi",
      fallback: "vi" as const,
    };
    expect(resolveLocale(all)).toBe("en");
    expect(resolveLocale({ ...all, query: null })).toBe("vi");
    expect(resolveLocale({ ...all, query: null, cookie: null })).toBe("vi");
    expect(resolveLocale({ query: null, cookie: null, acceptLanguage: "en", fallback: "vi" })).toBe(
      "en",
    );
    expect(resolveLocale({ query: null, cookie: null, acceptLanguage: "ja", fallback: "en" })).toBe(
      "en",
    );
  });

  test("a garbage ?lang= does not pin the reader — the cookie still answers", () => {
    // The reason unsupported values fall through instead of resolving to the default.
    expect(resolveLocale({ query: "kr", cookie: `${LOCALE_COOKIE}=en` })).toBe("en");
  });

  test("nothing at all → DEFAULT_LOCALE", () => {
    expect(resolveLocale({})).toBe(DEFAULT_LOCALE);
    expect(DEFAULT_LOCALE).toBe("en");
  });
});

describe("localeCookie", () => {
  test("scoped to the whole site, long-lived, and SameSite=Lax", () => {
    const c = localeCookie("en");
    expect(c).toContain(`${LOCALE_COOKIE}=en`);
    expect(c).toContain("Path=/");
    // Lax keeps it off cross-site POSTs — the same threat the Sec-Fetch-Site guard
    // in server.ts answers.
    expect(c).toContain("SameSite=Lax");
    // No Secure: this server is plain HTTP on loopback, so Secure would stop the
    // cookie being stored at all.
    expect(c).not.toContain("Secure");
  });
});
