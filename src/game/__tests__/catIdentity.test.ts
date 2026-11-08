import { CATS, CAT_ORDER } from '../../config/cats';
import { CHAPTERS } from '../../config/chapters';
import { MAPS } from '../../config/maps';
import { Battle } from '../battle';
import { getCatStats } from '../combat';
import type { CatId, EnemyId, StageDef } from '../types';

// Lv.1 cats, no skills, alone (or paired) on the same tile against identical scripted waves.
const map = MAPS[CHAPTERS[0].mapId];
const TILE = '2-2'; // covers the first two road passes

function scenario(enemy: EnemyId, count: number, interval: number, hpScale = 1): StageDef {
  return {
    ...CHAPTERS[0].stages[0],
    id: 'test',
    tiles: map.tiles.map((t) => t.id),
    roster: ['kitten'],
    hpScale,
    waveHpGrowth: 0,
    waves: [{ groups: [{ enemy, count, interval }] }],
  };
}

interface Run {
  kills: number;
  escaped: number;
  damage: number;
  attacks: number;
  slamHits: number;
}

function run(cats: CatId[], s: StageDef): Run {
  const b = new Battle(s, map, 1);
  b.startBattle();
  const tiles = [TILE, '2-1', '1-2'];
  cats.forEach((c, i) => b.placeCat(c, 1, tiles[i]));
  let attacks = 0;
  for (let i = 0; i < 4000 && b.status === 'playing'; i++) {
    const before = b.cats.map((c) => c.attackAt);
    b.update(0.05);
    b.cats.forEach((c, k) => {
      if (c.attackAt !== before[k]) attacks++;
    });
  }
  return { kills: b.stats.kills, escaped: b.stats.escaped, damage: b.stats.damageDealt, attacks, slamHits: b.stats.slamHits };
}

const GROUP = scenario('normal', 12, 0.25, 2.5); // a tight pack of tough mice
const SPREAD = scenario('normal', 10, 2.5, 1.5); // ordinary mice arriving one by one
const FAST = scenario('fast', 12, 1.2, 2); // spread-out runners
const ARMOR = scenario('armored', 8, 1.5, 1); // armored knights
const BIG = scenario('normal', 1, 1, 15); // one very high-HP mouse
const SPARSE = scenario('normal', 8, 10, 2.2); // mice far apart: each must die inside the cat's zone

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
      expect(b.range).toBeGreaterThan(o.range * 1.8);
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
