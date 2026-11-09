import { useSyncExternalStore } from 'react';
import { en } from './en';
import { zh } from './zh';

/** Chinese is written for Hong Kong players (zh-HK): Traditional characters, HK terms. */
export type Lang = 'en' | 'zh-HK';
export const LANGS: { id: Lang; label: string }[] = [
  { id: 'zh-HK', label: '中文（香港）' },
  { id: 'en', label: 'English' },
];

const DICTS: Record<Lang, Record<string, string>> = { en, 'zh-HK': zh };
const KEY = 'catdefense.lang';

function detect(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'en' || saved === 'zh-HK') return saved;
    // Older versions stored generic Traditional Chinese as "zh-TW": keep that choice.
    if (saved === 'zh-TW') {
      localStorage.setItem(KEY, 'zh-HK');
      return 'zh-HK';
    }
  } catch {
    /* ignore */
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language || '' : '';
  return nav.toLowerCase().startsWith('zh') ? 'zh-HK' : 'en';
}

let current: Lang = detect();
const listeners = new Set<() => void>();

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  current = lang;
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* ignore */
  }
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
  listeners.forEach((l) => l());
}

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
