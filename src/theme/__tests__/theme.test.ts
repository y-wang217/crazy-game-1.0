import css from '../../styles.css?raw';
import { BOARD_PALETTES } from '../palettes';
import { getTheme, setTheme, boardPalette } from '../index';

describe('visual themes', () => {
  it('both board palettes define every token', () => {
    expect(Object.keys(BOARD_PALETTES.moonlit).sort()).toEqual(Object.keys(BOARD_PALETTES.light).sort());
  });
  it('switching theme changes only the palette, never the save', () => {
    const store: Record<string, string> = {};
    const ls = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => void (store[k] = v),
      removeItem: (k: string) => void delete store[k],
    };
    (globalThis as unknown as { localStorage: typeof ls }).localStorage = ls;
    store['catdefense.save.v1'] = '{"fishCoins":77}';
    setTheme('moonlit');
    expect(getTheme()).toBe('moonlit');
    expect(boardPalette()).toBe(BOARD_PALETTES.moonlit);
    expect(store['catdefense.theme']).toBe('moonlit');
    setTheme('light');
    expect(boardPalette()).toBe(BOARD_PALETTES.light);
    expect(store['catdefense.save.v1']).toBe('{"fishCoins":77}');
  });
  it('moonlit keeps road and buildable tiles clearly distinct from the ground', () => {
    const lum = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contrast = (a: string, b: string) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };
    const P = BOARD_PALETTES.moonlit;
    expect(contrast(P.road, P.grass)).toBeGreaterThan(3);
    expect(contrast(P.tileGlow, P.grass)).toBeGreaterThan(2);
    expect(contrast(P.tileBorder, P.grass)).toBeGreaterThan(3);
  });
});

describe('theme CSS tokens', () => {
  it('no token is defined in terms of itself, and moonlit overrides only known tokens', () => {
    const defs = [...css.matchAll(/^\s*--([a-z0-9-]+):\s*([^;]+);/gm)];
    for (const [, name, value] of defs) expect([name, value.includes(`var(--${name})`)]).toEqual([name, false]);
    const block = (sel: string) => css.slice(css.indexOf(sel), css.indexOf('}', css.indexOf(sel)));
    const names = (b: string) => [...b.matchAll(/--([a-z0-9-]+):/g)].map((m) => m[1]);
    const light = new Set(names(block(':root {')));
    for (const n of names(block(":root[data-theme='moonlit'] {"))) expect([n, light.has(n)]).toEqual([n, true]);
  });
});
