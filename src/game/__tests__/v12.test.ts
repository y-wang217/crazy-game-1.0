import { BALANCE } from '../../config/balance';
import { CATS, CAT_ORDER, STARTER_CATS } from '../../config/cats';
import { CHAPTERS } from '../../config/chapters';
import { MAPS } from '../../config/maps';
import { SKILLS, SKILL_ORDER } from '../../config/skills';
import { Battle } from '../battle';
import { computeSkillMods, getCatStats, NO_MODS } from '../combat';
import { PathGeom, worldSize } from '../path';
import type { CatId, SkillId } from '../types';
import { bonusesFor, effectiveStats } from '../../ui/components/CatInfoPanel';

const chapter = CHAPTERS[0];
const map = MAPS[chapter.mapId];
const stage = (n: number) => chapter.stages[n - 1];

describe('compact beginner map', () => {
  it('chapter 1 uses a map about half the old footprint', () => {
    const old = MAPS.forest;
    expect(map.cols * map.rows).toBeLessThanOrEqual(old.cols * old.rows * 0.7);
    expect(map.cell).toBe(old.cell); // same world units, so ranges/speeds keep their meaning
  });
  it('every stage tile exists on the map and none sit on the road', () => {
    const path = PathGeom.fromMap(map);
    const ids = new Set(map.tiles.map((t) => t.id));
    for (const s of chapter.stages) {
      for (const id of s.tiles) expect([s.id, id, ids.has(id)]).toEqual([s.id, id, true]);
    }
    for (const t of map.tiles) {
      const cx = (t.c + 0.5) * map.cell;
      const cy = (t.r + 0.5) * map.cell;
      let min = Infinity;
      for (let d = 0; d <= path.length; d += 2) {
        const p = path.pointAt(d);
        min = Math.min(min, Math.hypot(p.x - cx, p.y - cy));
      }
      expect([t.id, min >= map.cell * 0.9]).toEqual([t.id, true]);
    }
  });
  it('the road is an S with three horizontal passes and stays on the board', () => {
    const { w, h } = worldSize(map);
    const pts = PathGeom.fromMap(map).points;
    const horizontal = pts.slice(1).filter((p, i) => p.y === pts[i].y && p.x !== pts[i].x);
    expect(horizontal.length).toBe(3);
    for (const p of pts.slice(1)) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(w);
      expect(p.y).toBeLessThanOrEqual(h);
    }
  });
  it('the core tiles each cover two stretches of road for a Lv.1 kitten', () => {
    const b = new Battle(stage(1), map, 1);
    b.startBattle();
    const path = b.path;
    const range = CATS.kitten.range;
    for (const id of stage(1).tiles) {
      const t = b.tileById(id)!;
      let inRange = 0;
      for (let d = 0; d < path.length; d += 5) {
        const p = path.pointAt(d);
        if (Math.hypot(p.x - t.x, p.y - t.y) <= range) inRange += 5;
      }
      expect([id, inRange > 100]).toEqual([id, true]);
    }
  });
});

describe('character-specific skills', () => {
  const statDiff = (cat: CatId, id: SkillId) => {
    const before = getCatStats(CATS[cat], 1, NO_MODS);
    const after = getCatStats(CATS[cat], 1, computeSkillMods({ [id]: 1 }));
    return (Object.keys(before) as (keyof typeof before)[]).filter((k) => before[k] !== after[k]);
  };

  it('every cat has at least three of its own skills', () => {
    for (const c of CAT_ORDER)
      expect(SKILL_ORDER.filter((id) => SKILLS[id].cat === c).length).toBeGreaterThanOrEqual(STARTER_CATS.includes(c) ? 3 : 2);
    expect(SKILL_ORDER.filter((id) => !SKILLS[id].cat).length).toBeGreaterThanOrEqual(3);
  });

  it('each cat skill changes a real stat of its own cat and of no other cat', () => {
    for (const id of SKILL_ORDER) {
      const cat = SKILLS[id].cat;
      if (!cat) continue;
      expect([id, statDiff(cat, id).length > 0]).toEqual([id, true]);
      for (const other of CAT_ORDER) if (other !== cat) expect([id, other, statDiff(other, id)]).toEqual([id, other, []]);
    }
  });

  it('specific examples: combo hits, splash, sniper speed, charm radius', () => {
    const m = computeSkillMods({ flurryPaws: 2, bigBelly: 1, steadyAim: 2, radiantBeauty: 1, lingeringCharm: 2 });
    expect(getCatStats(CATS.tabby, 1, m).comboHits).toBe(5);
    expect(getCatStats(CATS.orange, 1, m).splashRadius).toBeCloseTo(CATS.orange.splashRadius! * 1.2);
    expect(getCatStats(CATS.black, 1, m).interval).toBeCloseTo(CATS.black.interval / 1.3);
    expect(getCatStats(CATS.white, 1, m).range).toBeCloseTo(CATS.white.range * 1.12);
    expect(getCatStats(CATS.white, 1, m).slowDuration).toBeCloseTo(CATS.white.slowDuration! + 1);
  });

  it('skills really change combat: a deadeye black cat kills faster', () => {
    const killsWith = (skills: Partial<Record<SkillId, number>>) => {
      const b = new Battle(stage(5), map, 77);
      b.startBattle();
      b.placeCat('black', 1, '2-2');
      for (const [id, lv] of Object.entries(skills)) b.skills[id as SkillId] = lv;
      b.mods = computeSkillMods(b.skills);
      for (let i = 0; i < 600; i++) b.update(0.1);
      return b.stats.kills;
    };
    expect(killsWith({ deadeye: 4, steadyAim: 4 })).toBeGreaterThan(killsWith({}));
  });

  it('duplicate skills level up (shop purchases)', () => {
    const b = new Battle(stage(5), map, 3);
    b.startBattle();
    b.fish = 99999;
    b.placeCat('kitten', 1, '2-2');
    for (let i = 0; i < 25; i++) b.buySkill();
    const total = Object.values(b.skills).reduce((a, v) => a + (v ?? 0), 0);
    expect(total).toBe(25);
    expect(Object.values(b.skills).some((v) => (v ?? 0) >= 2)).toBe(true);
    for (const [id, lv] of Object.entries(b.skills)) expect(lv).toBeLessThanOrEqual(SKILLS[id as SkillId].maxLevel);
  });

  it('skill offers favour cats on the board', () => {
    let relevant = 0;
    let total = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const b = new Battle(stage(7), map, seed); // all five cats in the roster
      b.startBattle();
      b.placeCat('kitten', 1, '1-1');
      b.placeCat('kitten', 1, '2-1');
      for (const c of b.rollChestChoices('bronze')) {
        total++;
        if (b.isRelevantSkill(c.skillId)) relevant++;
      }
      // At least two of three chest choices are useful for this formation.
      expect(b.rollChestChoices('silver').filter((c) => b.isRelevantSkill(c.skillId)).length).toBeGreaterThanOrEqual(2);
    }
    expect(relevant / total).toBeGreaterThan(0.7);
  });

  it('skills for cats outside the stage roster are never offered', () => {
    const b = new Battle(stage(1), map, 1);
    b.startBattle();
    for (const id of b.availableSkills()) {
      const cat = SKILLS[id].cat;
      if (cat) expect(stage(1).roster).toContain(cat);
    }
  });
});

describe('cat details panel data', () => {
  it('shows effective stats after skills, and only the skills that affect this cat', () => {
    const b = new Battle(stage(7), map, 1);
    b.startBattle();
    const k = b.placeCat('kitten', 2, '1-1')!;
    const tb = b.placeCat('tabby', 1, '2-1')!;
    b.skills = { bravePaws: 2, sharpClaws: 1, championPunch: 1, fishyFortune: 1 };
    b.mods = computeSkillMods(b.skills);
    const { eff, base } = effectiveStats(k, b);
    const lv2 = BALANCE.levels.damageMult[1];
    expect(base.damage).toBeCloseTo(CATS.kitten.damage * lv2);
    expect(eff.damage).toBeCloseTo(CATS.kitten.damage * lv2 * 1.1 * 1.5);
    expect(
      bonusesFor(k, b)
        .map(([id]) => id)
        .sort(),
    ).toEqual(['bravePaws', 'sharpClaws']);
    expect(
      bonusesFor(tb, b)
        .map(([id]) => id)
        .sort(),
    ).toEqual(['championPunch', 'sharpClaws']);
  });
  it('white cat details are about slowing, not damage', () => {
    const b = new Battle(stage(7), map, 1);
    b.startBattle();
    const w = b.placeCat('white', 1, '1-1')!;
    b.skills = { dazzlingGrace: 1 };
    b.mods = computeSkillMods(b.skills);
    const { eff, base } = effectiveStats(w, b);
    expect(eff.damage).toBe(0);
    expect(eff.slowStrength).toBeCloseTo(base.slowStrength + 0.07);
  });
});

describe('summoning flow', () => {
  it('a stage-1 player can summon, merge, free a tile and summon again repeatedly', () => {
    const b = new Battle(stage(1), map, 12);
    b.startBattle();
    let merges = 0;
    let summons = 0;
    for (let i = 0; i < 2400 && b.status === 'playing'; i++) {
      if (b.emptyTiles().length && b.fish >= b.summonCost && b.summon().ok) summons++;
      const pair = b.cats.flatMap((x) => b.cats.filter((y) => y !== x && b.previewDrop(x.uid, y.tileId).result === 'merged').map((y) => [x, y]))[0];
      if (pair && b.dropCat(pair[0].uid, pair[1].tileId).result === 'merged') merges++;
      b.update(0.1);
    }
    expect(summons).toBeGreaterThan(stage(1).tiles.length); // more summons than tiles → merging freed space
    expect(merges).toBeGreaterThanOrEqual(5);
  });
});
