import { BALANCE } from '../../config/balance';
import { CATS, CAT_ORDER } from '../../config/cats';
import { CHAPTERS } from '../../config/chapters';
import { ENEMIES } from '../../config/enemies';
import { MAPS } from '../../config/maps';
import { Battle, type Foe } from '../battle';
import { computeDamage, getCatStats } from '../combat';
import type { EnemyId } from '../types';

const dps = (id: (typeof CAT_ORDER)[number], L: number) => {
  const st = getCatStats(CATS[id], L);
  return (st.damage * st.comboHits) / st.interval + st.poisonDps;
};

describe('in-battle level curve (smoother merge payoff)', () => {
  it('every level-up is clearly stronger, and the Lv.4 → Lv.5 step is the smallest', () => {
    for (const id of CAT_ORDER) {
      if (CATS[id].damage === 0) continue; // supports scale their effect, not damage
      const steps = [1, 2, 3, 4].map((L) => dps(id, L + 1) / dps(id, L));
      for (const s of steps) expect(s, id).toBeGreaterThan(1.6); // each merge is a real upgrade
      expect(steps[3], id).toBeLessThan(steps[0]); // no runaway final breakpoint
      expect(steps[3], id).toBeLessThanOrEqual(Math.min(...steps) + 1e-9);
      const total = dps(id, 5) / dps(id, 1);
      expect(total, id).toBeGreaterThan(12); // Lv.5 still a big reward…
      expect(total, id).toBeLessThan(17); // …but not the old ≈ 20×
    }
  });

  it('early merges pay a little more than the cats they use; late merges trade some raw power for space', () => {
    const m = BALANCE.levels.damageMult;
    expect(m[1] / m[0]).toBeGreaterThanOrEqual(2);
    expect(m[2] / m[1]).toBeGreaterThanOrEqual(2);
    expect(m[3] / m[2]).toBeLessThan(2);
    expect(m[4] / m[3]).toBeLessThan(m[3] / m[2]);
  });

  it('armor is less of a wall for low-level cats (smaller Lv.5 multiplier)', () => {
    const armor = ENEMIES.armored.armor + 2; // Chapter 2 armorBonus
    const lv1 = computeDamage(getCatStats(CATS.kitten, 1).damage, armor);
    const lv5 = computeDamage(getCatStats(CATS.kitten, 5).damage, armor);
    expect(lv1 / getCatStats(CATS.kitten, 1).damage).toBeGreaterThanOrEqual(BALANCE.minDamageRatio);
    expect(lv5 / lv1).toBeLessThan(65); // was ≈ 75× with the old ×16 Lv.5 multiplier
  });
});

describe('elite enemies', () => {
  const elites = (Object.keys(ENEMIES) as EnemyId[]).filter((id) => ENEMIES[id].elite);
  const ch2 = CHAPTERS[1];
  const stageEnemies = (st: (typeof ch2.stages)[number]) =>
    st.waves.flatMap((w) => w.groups.flatMap((g) => ('enemy' in g ? Array(g.count).fill(g.enemy) : []))) as EnemyId[];

  it('four roles: high HP, high armor, fast, escort', () => {
    expect(elites.sort()).toEqual(['brute', 'captain', 'ironclad', 'thief']);
    expect(new Set(elites.map((id) => ENEMIES[id].elite))).toEqual(new Set(['hp', 'armor', 'fast', 'escort']));
    expect(ENEMIES.brute.hp).toBeGreaterThan(ENEMIES.normal.hp * 6);
    expect(ENEMIES.ironclad.armor).toBeGreaterThan(ENEMIES.armored.armor);
    expect(ENEMIES.thief.speed).toBeGreaterThan(ENEMIES.fast.speed);
    expect(ENEMIES.thief.baseDamage).toBeGreaterThan(ENEMIES.fast.baseDamage);
  });

  it('are rare: none in the first four stages, a handful per later stage, never more than 6% of a stage', () => {
    const all = CHAPTERS.flatMap((c) => c.stages);
    for (const st of all) {
      const list = stageEnemies(st);
      const n = list.filter((e) => ENEMIES[e].elite).length;
      if (st.order! <= 4) expect(n, st.id).toBe(0);
      else if (st.order! >= 6) expect(n, st.id).toBeGreaterThanOrEqual(2);
      expect(n / list.length, st.id).toBeLessThan(0.06);
    }
    // A Mouse Captain always arrives with an escort.
    for (const st of all)
      for (const w of st.waves)
        if (w.groups.some((g) => 'enemy' in g && g.enemy === 'captain')) expect(w.groups.filter((g) => 'enemy' in g).length).toBeGreaterThan(1);
  });

  it('Mouse Captain: nearby mice take less damage from hits; the Captain itself, far mice and poison are unaffected', () => {
    const b = new Battle(ch2.stages[4], MAPS[ch2.mapId], 1);
    b.startBattle();
    const spawn = (enemy: EnemyId, dist: number): Foe => {
      const f = b.spawn({ enemy, count: 1, interval: 1 });
      const p = b.path.pointAt(dist);
      Object.assign(f, { dist, x: p.x, y: p.y });
      return f;
    };
    b.foes = [];
    const cap = spawn('captain', 200);
    const near = spawn('normal', 220);
    const far = spawn('normal', 600);
    expect(b.isGuarded(near)).toBe(true);
    expect(b.isGuarded(far)).toBe(false);
    expect(b.isGuarded(cap)).toBe(false);
    const hit = (f: Foe) => {
      const before = f.hp;
      (b as unknown as { hit: (f: Foe, raw: number, s: boolean) => void }).hit(f, 10, false);
      return before - f.hp;
    };
    expect(hit(near)).toBeCloseTo(10 * (1 - BALANCE.elite.guardReduction), 6);
    expect(hit(far)).toBeCloseTo(10, 6);
    cap.alive = false;
    expect(b.isGuarded(near)).toBe(false);
    expect(hit(near)).toBeCloseTo(10, 6); // protection ends with the Captain
  });

  it('elites announce themselves and pay a little more', () => {
    const b = new Battle(ch2.stages[4], MAPS[ch2.mapId], 1);
    b.startBattle();
    b.drainEvents();
    const f = b.spawn({ enemy: 'brute', count: 1, interval: 1 });
    expect(b.drainEvents()).toContainEqual({ type: 'eliteAppeared', enemy: 'brute' });
    const n = b.spawn({ enemy: 'normal', count: 1, interval: 1 });
    expect(f.reward).toBeGreaterThan(n.reward * 3);
  });
});
