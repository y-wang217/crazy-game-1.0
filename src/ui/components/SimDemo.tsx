import { useEffect, useRef } from 'react';
import { Battle } from '../../game/battle';
import type { CatId, CosmeticLoadout, MapDef, StageDef } from '../../game/types';
import { Renderer } from '../../render/renderer';
import { useTheme } from '../../theme';

// Encyclopedia demo: a tiny real battle (sandbox mode — no waves, no win/lose) on a straight
// lane, drawn by the real renderer. What you see is exactly how the cat fights, including
// its permanent star effects, Special and (sped-up) Ultimate.

const t = (c: number, r: number) => ({ id: `${c}-${r}`, c, r });
const DEMO_MAP: MapDef = {
  id: 'demo',
  name: 'Demo lane',
  cols: 6,
  rows: 3,
  cell: 50,
  path: [
    [-0.9, 1],
    [6.9, 1],
  ],
  base: [9, 1],
  tiles: [t(0, 2), t(1, 2), t(2, 2), t(3, 2), t(4, 2), t(2, 0), t(3, 0)],
  theme: { grass: '#c4e4a2', grassDark: '#acd68a', road: '#f0dcae', roadEdge: '#cfae74' },
};

/** How the demo spawns mice to show off each role. */
const PATTERN: Record<CatId, { every: number; group: number; gap: number; hpMult: number; startHp?: number }> = {
  kitten: { every: 1.6, group: 1, gap: 0, hpMult: 1 },
  tabby: { every: 1.6, group: 1, gap: 0, hpMult: 1 },
  orange: { every: 3.2, group: 3, gap: 0.22, hpMult: 1 },
  black: { every: 2.4, group: 1, gap: 0, hpMult: 2 },
  white: { every: 1.4, group: 1, gap: 0, hpMult: 1.5 },
  whiskers: { every: 3, group: 3, gap: 0.3, hpMult: 1 },
  sable: { every: 3, group: 3, gap: 0.3, hpMult: 1.2 },
  mallow: { every: 1.6, group: 1, gap: 0, hpMult: 1 },
  pounce: { every: 1.4, group: 1, gap: 0, hpMult: 1, startHp: 0.45 },
  devil: { every: 4, group: 1, gap: 0, hpMult: 4 },
};

export function SimDemo({ type, level, star, loadout }: { type: CatId; level: number; star: number; loadout: CosmeticLoadout }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const theme = useTheme();
  const key = JSON.stringify(loadout);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const stage: StageDef = {
      id: 'demo',
      number: 1,
      roster: [type],
      tiles: DEMO_MAP.tiles.map((x) => x.id),
      startFish: 0,
      baseHp: 9999,
      hpScale: 1,
      waves: [],
      rewards: { firstClear: 0, replay: 0 },
    };
    // Ultimates every few seconds so the profile can show them (real cooldown is longer).
    const b = new Battle(stage, DEMO_MAP, { seed: 1, sandbox: true, stars: { [type]: star, kitten: 1 }, ultCooldownMult: 0.3 });
    b.startBattle();
    b.placeCat(type, level, type === 'black' ? '0-2' : '2-2');
    if (type === 'mallow') {
      b.placeCat('kitten', 1, '1-2');
      b.placeCat('kitten', 1, '3-2');
    }
    const r = new Renderer(canvas, DEMO_MAP);
    r.resize(canvas.parentElement?.clientWidth ?? 300, 150);
    const pat = PATTERN[type];
    let nextSpawn = 0.4;
    const queue: number[] = [];
    let last = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (b.time >= nextSpawn) {
        for (let i = 0; i < pat.group; i++) queue.push(b.time + i * pat.gap);
        nextSpawn = b.time + pat.every;
      }
      while (queue.length && queue[0] <= b.time) {
        queue.shift();
        const f = b.spawn({ enemy: 'normal', count: 1, interval: 1 });
        f.maxHp = f.hp = Math.round(40 * pat.hpMult * Math.pow(2, level - 1));
        if (pat.startHp) f.hp = Math.round(f.maxHp * pat.startHp);
        f.speed = 32;
      }
      // Mice that walk off the end just leave (no hearts in the demo).
      b.foes = b.foes.filter((f) => f.dist < b.path.length - 4);
      b.update(dt);
      r.draw(b, null, loadout);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [type, level, star, key, theme]);

  return (
    <div className="sim-demo">
      <canvas ref={ref} className="field-canvas" />
    </div>
  );
}
