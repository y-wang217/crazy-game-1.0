import html from '../../../index.html?raw';
import { DEFAULT_THEME, LANG_KEY, THEME_COLOR, THEME_KEY, resolveLang, resolveTheme } from '../preferences';

describe('shared language + theme preferences', () => {
  it('keeps an existing saved choice; migrates the old zh-TW value; falls back to the device', () => {
    expect(resolveLang('en', 'zh-HK')).toBe('en'); // saved beats device
    expect(resolveLang('zh-HK', 'en-US')).toBe('zh-HK');
    expect(resolveLang('zh-TW', 'en-US')).toBe('zh-HK');
    expect(resolveLang(null, 'zh-Hant-HK')).toBe('zh-HK');
    expect(resolveLang(null, 'en-GB')).toBe('en');
    expect(resolveLang('garbage', 'fr')).toBe('en');
    expect(resolveTheme('moonlit')).toBe('moonlit');
    expect(resolveTheme('light')).toBe('light');
    expect(resolveTheme(null)).toBe(DEFAULT_THEME);
    expect(resolveTheme('neon')).toBe(DEFAULT_THEME);
  });

  it('uses the same storage keys every earlier version used (no reset of existing choices)', () => {
    expect(LANG_KEY).toBe('catdefense.lang');
    expect(THEME_KEY).toBe('catdefense.theme');
  });

  it('index.html applies the same keys and rules before first paint', () => {
    for (const s of [LANG_KEY, THEME_KEY, "'zh-TW'", "'zh-HK'", "'moonlit'", "'light'", THEME_COLOR.light, THEME_COLOR.moonlit, 'data-theme']) expect(html).toContain(s);
    // The inline script runs before the app module.
    expect(html.indexOf(THEME_KEY)).toBeLessThan(html.indexOf('/src/main.tsx'));
  });

  it('no screen keeps its own copy: only the i18n and theme stores read the storage keys', () => {
    const sources = import.meta.glob('/src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const hits = Object.entries(sources)
      .filter(([f, src]) => !f.includes('__tests__') && (src.includes("'catdefense.lang'") || src.includes("'catdefense.theme'")))
      .map(([f]) => f);
    expect(hits).toEqual(['/src/settings/preferences.ts']);
  });
});
