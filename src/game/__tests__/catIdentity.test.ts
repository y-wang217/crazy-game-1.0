import { CATS, CAT_ORDER, STARTER_CATS } from '../../config/cats';
import { getCatStats } from '../combat';
import type { CatId } from '../types';
import { ARMOR, BIG, FAST, GROUP, SPARSE, SPREAD, run, type Run } from './catBenchmark';

const rows: string[] = [];
const results: Record<string, Record<string, Run>> = {};

describe('cat combat identity (Lv.1, no skills)', () => {
  beforeAll(() => {
    for (const c of CAT_ORDER) {
      results[c] = { group: run([c], GROUP), spread: run([c], SPREAD), fast: run([c], FAST), armor: run([c], ARMOR), big: run([c], BIG) };
      const st = getCatStats(CATS[c], 1);
      const r = results[c];
      rows.push(
        `${c.padEnd(7)} hit ${st.damage.toFixed(0).padStart(3)}×${st.comboHits}  ${(1 / st.interval).toFixed(2)}/s  range ${(st.range / 50).toFixed(2)}t` +
          ` | dmg: group ${r.group.damage.toFixed(0).padStart(4)}  spread ${r.spread.damage.toFixed(0).padStart(4)}  fast ${r.fast.damage.toFixed(0).padStart(4)}  armor ${r.armor.damage.toFixed(0).padStart(4)}  bigHP ${r.big.damage.toFixed(0).padStart(4)}`,
      );
    }
    console.log('\n' + rows.join('\n'));
  });

  it('Orange is far slower but hits far harder than the Kitten', () => {
    const k = getCatStats(CATS.kitten, 1);
    const o = getCatStats(CATS.orange, 1);
    expect(o.interval / k.interval).toBeGreaterThanOrEqual(2.5);
    expect(o.interval / k.interval).toBeLessThanOrEqual(3.2);
    expect(o.damage / k.damage).toBeGreaterThanOrEqual(2.5);
  });

  it('Orange hits several mice per slam and crushes groups (far more than the Kitten)', () => {
    const g = results.orange.group;
    expect(g.slamHits / Math.max(1, g.attacks)).toBeGreaterThanOrEqual(2);
    expect(results.orange.group.damage).toBeGreaterThan(results.kitten.group.damage * 2);
  });

  it('Orange loses that edge against scattered and fast mice', () => {
    const groupEdge = results.orange.group.damage / results.kitten.group.damage;
    const spreadEdge = results.orange.spread.damage / results.kitten.spread.damage;
    const fastEdge = results.orange.fast.damage / results.kitten.fast.damage;
    expect(spreadEdge).toBeLessThan(groupEdge / 2);
    expect(fastEdge).toBeLessThan(groupEdge / 2);
    expect(fastEdge).toBeLessThan(groupEdge / 3);
  });

  it('Tabby throws many more (weaker) hits and has the shortest reach', () => {
    const k = getCatStats(CATS.kitten, 1);
    const t = getCatStats(CATS.tabby, 1);
    expect((t.comboHits / t.interval) / (1 / k.interval)).toBeGreaterThanOrEqual(4);
    expect(t.damage).toBeLessThan(k.damage / 2);
    for (const c of CAT_ORDER) if (c !== 'tabby') expect(t.range).toBeLessThan(getCatStats(CATS[c], 1).range);
  });

  it('Tabby shines up close but struggles against armor', () => {
    expect(results.tabby.spread.damage).toBeGreaterThan(results.kitten.spread.damage * 0.8);
    expect(results.tabby.armor.damage).toBeLessThan(results.black.armor.damage / 2);
    expect(results.tabby.armor.damage).toBeLessThan(results.kitten.armor.damage);
  });

  it('Black Cat: longest range, biggest single hit, slow, best against one huge target', () => {
    const b = getCatStats(CATS.black, 1);
    for (const c of CAT_ORDER) {
      if (c === 'black') continue;
      const o = getCatStats(CATS[c], 1);
      // Support radii (Noble White's charm, Captain Mallow's bell) are not attack range.
      if (CATS[c].attack === 'support') continue;
      expect(b.range).toBeGreaterThan(o.range * (STARTER_CATS.includes(c) ? 1.8 : 1.5));
      if (CATS[c].damage > 0) expect(b.damage).toBeGreaterThan(o.damage * 1.5);
    }
    expect(b.interval).toBeGreaterThan(getCatStats(CATS.kitten, 1).interval * 3);
    for (const c of ['kitten', 'tabby', 'orange'] as CatId[]) expect(results.black.big.damage).toBeGreaterThan(results[c].big.damage);
    // …but it can't clear a pack quickly
    expect(results.black.group.damage).toBeLessThan(results.orange.group.damage);
  });

  it('Noble White deals no damage but makes a damage cat much more effective', () => {
    expect(results.white.group.damage).toBe(0);
    // She doesn't add damage: she holds mice inside other cats' zones so that damage turns into kills.
    let alone = 0;
    let paired = 0;
    for (const c of ['kitten', 'tabby', 'orange', 'black'] as CatId[]) {
      const a = run([c], SPARSE).kills;
      const w = run([c, 'white'], SPARSE).kills;
      console.log(`${c}: kills alone ${a}/8 → with White ${w}/8`);
      expect([c, w >= a]).toEqual([c, true]);
      alone += a;
      paired += w;
    }
    expect(paired).toBeGreaterThanOrEqual(alone + 4);
  });

  it('no cat is best at everything', () => {
    const best = (k: 'group' | 'spread' | 'fast' | 'armor' | 'big') => CAT_ORDER.reduce((a, c) => (results[c][k].damage > results[a][k].damage ? c : a));
    const winners = new Set((['group', 'spread', 'fast', 'armor', 'big'] as const).map(best));
    expect(winners.size).toBeGreaterThanOrEqual(2);
  });

  it('merged cats keep their identity (Lv.3 Orange is still a slow area hitter)', () => {
    const o3 = getCatStats(CATS.orange, 3);
    const k3 = getCatStats(CATS.kitten, 3);
    expect(o3.interval / k3.interval).toBeGreaterThanOrEqual(2.5);
    expect(o3.splashRadius).toBeGreaterThan(0);
    expect(getCatStats(CATS.tabby, 3).comboHits).toBe(3);
    expect(getCatStats(CATS.black, 3).range).toBeGreaterThan(getCatStats(CATS.kitten, 3).range * 1.8);
  });
});
