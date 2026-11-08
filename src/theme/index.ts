import { useSyncExternalStore } from 'react';
import { BOARD_PALETTES, ENV_OVERRIDES, type BoardPalette, type Environment } from './palettes';

// Visual theme store. Purely cosmetic: it never touches combat, maps or the save.
// UI colors are CSS tokens (styles.css, `:root` and `[data-theme='moonlit']`);
// the battlefield canvas reads BOARD_PALETTES.

export type ThemeId = 'light' | 'moonlit';
export const THEMES: { id: ThemeId; icon: string }[] = [
  { id: 'light', icon: '☀️' },
  { id: 'moonlit', icon: '🌙' },
];

const KEY = 'catdefense.theme';

function load(): ThemeId {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'moonlit') return v;
  } catch {
    /* ignore */
  }
  return 'light';
}

let current: ThemeId = load();
const listeners = new Set<() => void>();

function apply(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = current;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', current === 'moonlit' ? '#252439' : '#cfe8b8');
}
apply();

export function getTheme(): ThemeId {
  return current;
}

export function setTheme(id: ThemeId): void {
  current = id;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* ignore */
  }
  apply();
  listeners.forEach((l) => l());
}

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
