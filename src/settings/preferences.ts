// Player preferences: language and visual theme. ONE source of truth for the whole game.
//
// - Storage: localStorage `catdefense.lang` ('en' | 'zh-HK') and `catdefense.theme`
//   ('light' | 'moonlit'). The keys and values are the same ones every earlier version used,
//   so existing choices are kept (the old 'zh-TW' value is migrated to 'zh-HK').
// - Runtime: the language store (src/i18n) and the theme store (src/theme) are the only
//   in-memory copies. Every screen — the Early Access notice, menus, battle, tutorials,
//   encyclopedia, shop, popups — reads them through useLang() / useTheme(), so a change made
//   anywhere re-renders everything at once. No screen keeps its own language or theme state.
// - First paint: index.html runs a tiny inline script with the SAME rules (resolveLang /
//   resolveTheme below) before the CSS and app load, so the page never flashes the wrong theme.
//   Keep the two in sync (a test checks the inline script uses these keys and values).
// - Other tabs: a `storage` event from another tab updates this tab too.

export type Lang = 'en' | 'zh-HK';
export type ThemeId = 'light' | 'moonlit';

export const LANG_KEY = 'catdefense.lang';
export const THEME_KEY = 'catdefense.theme';
export const DEFAULT_THEME: ThemeId = 'light';

/** Browser-chrome colour (meta theme-color) per theme. */
export const THEME_COLOR: Record<ThemeId, string> = { light: '#cfe8b8', moonlit: '#252439' };

/** Saved language, else the device language (Chinese → zh-HK, anything else → English). */
export function resolveLang(saved: string | null | undefined, deviceLang: string): Lang {
  if (saved === 'en' || saved === 'zh-HK') return saved;
  if (saved === 'zh-TW') return 'zh-HK'; // older versions stored generic Traditional Chinese
  return deviceLang.toLowerCase().startsWith('zh') ? 'zh-HK' : 'en';
}

export function resolveTheme(saved: string | null | undefined): ThemeId {
  return saved === 'light' || saved === 'moonlit' ? saved : DEFAULT_THEME;
}

export function readPref(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null; // storage blocked (private mode): defaults, never a crash
  }
}

export function writePref(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    /* storage blocked: the choice still applies for this visit */
  }
}

/** Call `cb` with the new raw value when another tab changes this preference. */
export function onOtherTabChange(key: string, cb: (value: string | null) => void): void {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
  window.addEventListener('storage', (e) => {
    if (e.key === key) cb(e.newValue);
  });
}
