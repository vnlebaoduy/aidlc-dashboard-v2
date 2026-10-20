// The UI catalogue: `catalog.ts` (typed per panel, ported from v1) plus `chrome.ts`
// (navigation and page titles that only v2 has). Both are typed per locale, so a missing
// message is a typecheck failure, never a blank.

import type { Locale } from "@server/model/types";
import { createContext, useContext } from "react";
import { type Strings, strings } from "./catalog";
import { CHROME, type ChromeStrings } from "./chrome";

export type { Strings, ChromeStrings };
export const LOCALES: readonly Locale[] = ["en", "vi"];
export const LOCALE_COOKIE = "aidlc_lang";

export interface I18n {
  locale: Locale;
  s: Strings;
  c: ChromeStrings;
}

export function i18nFor(locale: Locale): I18n {
  return { locale, s: strings(locale), c: CHROME[locale] };
}

export const I18nContext = createContext<I18n>(i18nFor("en"));

export function useI18n(): I18n {
  return useContext(I18nContext);
}

/** Persist a language choice like the server's `?lang=` cookie (same name and shape). */
export function persistLocale(locale: Locale): void {
  document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
