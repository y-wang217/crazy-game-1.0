import { CAT_ORDER } from '../../config/cats';
import { CAT_SCENES, drawCatScene } from '../catScenes';

/** A fake 2D context that counts paint operations (no DOM canvas in tests). */
function countingCtx() {
  let ops = 0;
  const target: Record<string, unknown> = {};
  const gradient = { addColorStop: () => {} };
  const ctx = new Proxy(target, {
    get: (t, key) => {
      if (key === 'ops') return ops;
      if (key in t) return t[key as string];
      if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => gradient;
      return () => {
        if (key === 'fill' || key === 'stroke' || key === 'fillRect' || key === 'fillText' || key === 'strokeRect') ops++;
      };
    },
    set: (t, key, v) => ((t[key as string] = v), true),
  });
  return ctx as unknown as CanvasRenderingContext2D & { ops: number };
}

const ops = (cat: string, star: number, theme: 'light' | 'moonlit') => {
  const c = countingCtx();
  drawCatScene(c, 300, 210, cat, star, theme);
  return c.ops;
};

describe('Cat Encyclopedia backgrounds', () => {
  it('every cat has its own location, with a day and a night palette', () => {
    for (const id of CAT_ORDER) expect(CAT_SCENES[id], id).toBeDefined();
    for (const theme of ['light', 'moonlit'] as const) {
      const looks = CAT_ORDER.map((id) => {
        const p = CAT_SCENES[id]![theme];
        return `${p.skyTop}/${p.ground}/${p.accent}`;
      });
      expect(new Set(looks).size).toBe(CAT_ORDER.length);
    }
  });

  it('each star rank adds to the scene (1★ simplest … 5★ richest), in both themes', () => {
    for (const id of CAT_ORDER)
      for (const theme of ['light', 'moonlit'] as const) {
        const counts = [1, 2, 3, 4, 5].map((s) => ops(id, s, theme));
        for (let i = 1; i < 5; i++) expect(counts[i], `${id} ${theme} ${i + 1}★`).toBeGreaterThan(counts[i - 1]);
        // 3★ (Special) and 5★ (Ultimate) are milestone upgrades: clearly more than the step before.
        expect(counts[2] - counts[1], `${id} 3★`).toBeGreaterThanOrEqual(3);
        expect(counts[4] - counts[3], `${id} 5★`).toBeGreaterThanOrEqual(5);
      }
  });

  it('a future cat without a scene still gets an evolving background', () => {
    expect(ops('newcat', 5, 'light')).toBeGreaterThan(ops('newcat', 1, 'light'));
    // Out-of-range ranks are clamped.
    expect(ops('kitten', 9, 'light')).toBe(ops('kitten', 5, 'light'));
    expect(ops('kitten', 0, 'light')).toBe(ops('kitten', 1, 'light'));
  });
});
