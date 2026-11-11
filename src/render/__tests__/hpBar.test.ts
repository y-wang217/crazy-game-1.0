import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { CHAPTERS } from '../../config/chapters';
import { MAPS } from '../../config/maps';
import { Battle } from '../../game/battle';
import { frac, Renderer } from '../renderer';

// Regression: after Restart the screen keeps its Renderer but gets a new Battle whose foe uids
// and visual clock start over. The HP "damage trail" cache used to carry the old entries over;
// with the clock going back, the trail grew instead of shrinking and one enemy's bar stretched
// across the battlefield.

/** A fake canvas whose 2D context records the width of every HP-bar-shaped roundRect (h = 3). */
function fakeCanvas(bars: number[]) {
  const gradient = { addColorStop: () => {} };
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (t, key) => {
      if (key in t) return t[key as string];
      if (key === 'createLinearGradient' || key === 'createRadialGradient' || key === 'createPattern') return () => gradient;
      if (key === 'measureText') return () => ({ width: 10 });
      if (key === 'getTransform') return () => ({ a: 1, d: 1 });
      if (key === 'roundRect') return (_x: number, _y: number, w: number, h: number) => h === 3 && bars.push(w);
      return () => {};
    },
    set: (t, key, v) => ((t[key as string] = v), true),
  });
  return { width: 400, height: 600, style: {}, getContext: () => ctx } as unknown as HTMLCanvasElement;
}

const map = MAPS[CHAPTERS[0].mapId];
const stage = CHAPTERS[0].stages[3]; // 1-4
const loadout = { hat: null, skins: {} };

function battleWithHurtMice(vtime: number, hpLeft: number) {
  const b = new Battle(stage, map, 7);
  b.startBattle();
  b.clearFoes();
  for (const f of b.spawnLine('normal', 4, 200, 30)) f.hp = f.maxHp * hpLeft;
  b.vtime = vtime;
  return b;
}

describe('enemy HP bars', () => {
  const bars: number[] = [];
  beforeAll(() => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas([]) });
    vi.stubGlobal('window', { devicePixelRatio: 1 });
  });
  afterAll(() => vi.unstubAllGlobals());

  it('frac is always within 0–1', () => {
    expect(frac(50, 100)).toBe(0.5);
    expect(frac(150, 100)).toBe(1);
    expect(frac(-5, 100)).toBe(0);
    expect(frac(5, 0)).toBe(0);
    expect(frac(NaN, 100)).toBe(0);
  });

  it('keep their normal width after Restart (new battle, same uids, clock back to 0)', () => {
    const r = new Renderer(fakeCanvas(bars), map);
    r.resize(400, 600);
    // A long first attempt: mice at full HP are seen late in the battle…
    const first = battleWithHurtMice(300, 1);
    r.draw(first, null, loadout);
    // …then hurt (the white trail starts at 100%).
    for (const f of first.foes) f.hp = f.maxHp * 0.3;
    first.vtime = 300.1;
    r.draw(first, null, loadout);
    // Restart: same uids, early clock, lightly hurt mice.
    const second = battleWithHurtMice(5, 0.9);
    for (let i = 0; i < 30; i++) {
      bars.length = 0;
      second.vtime += 0.05;
      r.draw(second, null, loadout);
      expect(bars.length).toBeGreaterThan(0);
      for (const w of bars) expect(w).toBeLessThanOrEqual(20);
    }
  });

  it('never exceed the frame, even with HP above max or a clock that jumps back', () => {
    const r = new Renderer(fakeCanvas(bars), map);
    r.resize(400, 600);
    const b = battleWithHurtMice(50, 0.5);
    r.draw(b, null, loadout);
    b.foes[0].hp = b.foes[0].maxHp * 3; // e.g. a heal effect overshooting
    b.vtime = 10; // e.g. a restored checkpoint
    bars.length = 0;
    r.draw(b, null, loadout);
    for (const w of bars) expect(w).toBeLessThanOrEqual(20);
  });
});
