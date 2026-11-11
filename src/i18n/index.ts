import { useSyncExternalStore } from 'react';
import { en } from './en';
import { zh } from './zh';

import { LANG_KEY, onOtherTabChange, readPref, resolveLang, writePref, type Lang } from '../settings/preferences';

/** Chinese is written for Hong Kong players (zh-HK): Traditional characters, HK terms. */
export type { Lang };
export const LANGS: { id: Lang; label: string }[] = [
  { id: 'zh-HK', label: '中文（香港）' },
  { id: 'en', label: 'English' },
];

const DICTS: Record<Lang, Record<string, string>> = { en, 'zh-HK': zh };
// The one in-memory language for the whole game (see settings/preferences.ts).
function detect(): Lang {
  const saved = readPref(LANG_KEY);
  const lang = resolveLang(saved, typeof navigator !== 'undefined' ? navigator.language || '' : '');
  if (saved === 'zh-TW') writePref(LANG_KEY, lang); // migrate the old value, keep the choice
  return lang;
}

let current: Lang = detect();
const listeners = new Set<() => void>();

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang, persist = true): void {
  const changed = lang !== current;
  current = lang;
  if (persist) writePref(LANG_KEY, lang);
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
  if (changed) listeners.forEach((l) => l());
}

// Another tab changed the language: follow it here too.
onOtherTabChange(LANG_KEY, (v) => setLang(resolveLang(v, current), false));

/** Translate a key, filling {placeholders}. Falls back to English, then to the key. */
export function t(key: string, params?: Record<string, string | number>): string {
  const raw = DICTS[current][key] ?? en[key] ?? key;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}

/** True if the key exists (in the current language or English). */
export function has(key: string): boolean {
  return key in DICTS[current] || key in en;
}

/** Re-render on language change and return the current language. */
const ZH_NUMERALS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
/** A chapter number as written in running text: 第一章 in Chinese, "Chapter 1" in English. */
export function chapterNumeral(n: number): string {
  return current === 'zh-HK' ? (ZH_NUMERALS[n] ?? String(n)) : String(n);
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getLang,
    getLang,
  );
}

if (typeof document !== 'undefined') document.documentElement.lang = current;

/** Font stack with Traditional Chinese fallbacks (used by canvas text too). */
export const FONT_STACK = `"Baloo 2", "Noto Sans HK", "PingFang HK", "Microsoft JhengHei", ui-rounded, system-ui, sans-serif`;

export { en, zh };
