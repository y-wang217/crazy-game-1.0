import { useSyncExternalStore } from 'react';
import { BOARD_PALETTES, ENV_OVERRIDES, type BoardPalette, type Environment } from './palettes';

// Visual theme store. Purely cosmetic: it never touches combat, maps or the save.
// UI colors are CSS tokens (styles.css, `:root` and `[data-theme='moonlit']`);
// the battlefield canvas reads BOARD_PALETTES.

import { THEME_COLOR, THEME_KEY, onOtherTabChange, readPref, resolveTheme, writePref, type ThemeId } from '../settings/preferences';

export type { ThemeId };
export const THEMES: { id: ThemeId; icon: string }[] = [
  { id: 'light', icon: '☀️' },
  { id: 'moonlit', icon: '🌙' },
];

// The one in-memory theme for the whole game (see settings/preferences.ts).
let current: ThemeId = resolveTheme(readPref(THEME_KEY));
const listeners = new Set<() => void>();

function apply(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = current;
  // The first-paint colour set by index.html is only a placeholder until the stylesheet loads.
  document.documentElement.style.removeProperty('background');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLOR[current]);
}
apply();

export function getTheme(): ThemeId {
  return current;
}

export function setTheme(id: ThemeId, persist = true): void {
  const changed = id !== current;
  current = id;
  if (persist) writePref(THEME_KEY, id);
  apply();
  if (changed) listeners.forEach((l) => l());
}

// Another tab changed the theme: follow it here too.
onOtherTabChange(THEME_KEY, (v) => setTheme(resolveTheme(v), false));

const envCache = new Map<string, BoardPalette>();
/** Battlefield palette for the current theme, optionally adjusted for a map environment. */
export function boardPalette(env: Environment = 'forest'): BoardPalette {
  const over = ENV_OVERRIDES[env]?.[current];
  if (!over) return BOARD_PALETTES[current];
  const key = `${env}|${current}`;
  let p = envCache.get(key);
  if (!p) {
    p = { ...BOARD_PALETTES[current], ...over };
    envCache.set(key, p);
  }
  return p;
}

export function useTheme(): ThemeId {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getTheme,
    getTheme,
  );
}
