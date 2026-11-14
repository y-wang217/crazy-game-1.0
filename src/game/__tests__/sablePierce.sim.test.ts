import { CHAPTERS } from '../../config/chapters';
import { MAPS } from '../../config/maps';
import { Battle } from '../battle';
import type { MapDef, StageDef } from '../types';

// Sir Sable's REAL piercing attack measured on every placement tile of a map (opt-in tool for
// map design): a steady stream of Forest Mice walks the actual route while one Lv.3 Sir Sable
// stands on the tile. Reports how many mice each regular sword wave hits on average, how often a
// wave hits 2+ mice, and total mice hit per second (reach × pierce together).
//   SABLE=1 MAP=mushroom npx vitest run sablePierce        (MAP = any id in MAPS)
declare const process: { env: Record<string, string | undefined> };
const on = !!process.env.SABLE;

export function measureSable(map: MapDef, tileId: string, seconds = 60, interval = 0.8, cat: 'sable' | 'orange' = 'sable') {
  const base = CHAPTERS[1].stages[0];
  const stage: StageDef = { ...base, id: base.id, tiles: [tileId], startCats: [{ type: cat, level: 3, tile: tileId }], waves: base.waves };
  const b = new Battle(stage, map, { seed: 3, roster: [cat], sandbox: true });
  b.baseHp = 1e9;
  b.startBattle();
  b.clearFoes();
  let t = 0;
  let next = 0;
  while (t < seconds) {
    if (t >= next) {
      const f = b.spawn({ enemy: 'normal', count: 1, interval: 1 });
      f.hp = f.maxHp = 1e9;
      next += interval;
    }
    b.update(0.05);
    t += 0.05;
  }
  if (cat === 'orange') return { strikes: 0, perStrike: 0, multi: 0, perSecond: b.stats.slamHits / seconds };
  const hits = b.pierceHits;
  const total = hits.reduce((a, n) => a + n, 0);
  return {
    strikes: hits.length,
    perStrike: hits.length ? total / hits.length : 0,
    multi: hits.length ? hits.filter((n) => n >= 2).length / hits.length : 0,
    perSecond: total / seconds,
  };
}

// Same idea for area attacks: Chubby Orange's slams (mice hit per second, by tile).
//   SABLE=1 CAT=orange MAP=mushroom_deep npx vitest run sablePierce
describe.skipIf(!on || process.env.CAT !== 'orange')('area attack map audit', () => {
  it('per-tile table', () => {
    const map = MAPS[process.env.MAP ?? 'mushroom'];
    const rows = map.tiles
      .map((t) => ({ id: t.id, ...measureSable(map, t.id, 60, 0.8, 'orange') }))
      .sort((a, b) => b.perSecond - a.perSecond)
      .map((r) => `| ${r.id} | ${r.perSecond.toFixed(2)} |`);
    console.log(`SLAM_TABLE ${map.id}\n| Tile | Mice hit by slams / s |\n|---|---|\n` + rows.join('\n'));
  }, 600000);
});

describe.skipIf(!on || process.env.CAT === 'orange')('Sir Sable pierce map audit', () => {
  it('per-tile table', () => {
    const map = MAPS[process.env.MAP ?? 'mushroom'];
    const rows = map.tiles
      .map((t) => ({ id: t.id, ...measureSable(map, t.id) }))
      .sort((a, b) => b.perSecond - a.perSecond)
      .map((r) => `| ${r.id} | ${r.perStrike.toFixed(2)} | ${Math.round(r.multi * 100)}% | ${r.perSecond.toFixed(2)} |`);
    console.log(`SABLE_TABLE ${map.id}\n| Tile | Mice per strike | Strikes hitting 2+ | Mice hit / s |\n|---|---|---|---|\n` + rows.join('\n'));
  }, 600000);
});
