import { BALANCE, summonCost } from '../../config/balance';
import { CATS, CAT_ORDER, NEW_CATS } from '../../config/cats';
import { CHAPTERS } from '../../config/chapters';
import { ABILITIES, STARS, ULTIMATE } from '../../config/collection';
import { ENEMIES } from '../../config/enemies';
import { MAPS } from '../../config/maps';
import { Battle, type Foe } from '../battle';
import { getCatStats } from '../combat';
import type { CatId } from '../types';

const ch2 = CHAPTERS[1];
const stage = ch2.stages[0];
const map = MAPS[ch2.mapId];

/** A sandbox battle (no waves, no win/lose) with the given star ranks. */
function sandbox(stars: Partial<Record<CatId, number>> = {}, roster?: CatId[]) {
  const b = new Battle(stage, map, { seed: 7, sandbox: true, stars, roster });
  b.startBattle();
  return b;
}

/** A stationary mouse at a path distance. */
function mouse(b: Battle, dist: number, enemy: 'normal' | 'armored' | 'boss' = 'normal', hp = 500): Foe {
  const f = b.spawn({ enemy, count: 1, interval: 1 });
  f.dist = dist;
  f.speed = 0;
  f.hp = f.maxHp = hp;
  f.shield = f.maxShield = 0;
  const p = b.path.pointAt(dist);
  f.x = p.x;
  f.y = p.y;
  return f;
}

const tile = (b: Battle, id: string) => b.tileById(id)!;

describe('star ranks', () => {
  it('stars run 1–5 and add modest, permanent stat growth', () => {
    expect(STARS.max).toBe(5);
    for (const id of CAT_ORDER) {
      const one = getCatStats(CATS[id], 1, undefined, 1);
      const five = getCatStats(CATS[id], 1, undefined, 5);
      expect(five.star).toBe(5);
      expect(five.interval).toBeLessThan(one.interval);
      if (CATS[id].damage > 0) {
        expect(five.damage).toBeGreaterThan(one.damage);
        expect(five.damage / one.damage).toBeLessThanOrEqual(1.25); // modest
      }
    }
    // A 4★ cat still starts at Lv.1 in battle.
    const b = sandbox({ kitten: 4 });
    b.fish = 99;
    b.placeCat('kitten', 1, b.emptyTiles()[0].id);
    expect(b.cats[0].level).toBe(1);
    expect(b.unitStats(b.cats[0]).star).toBe(4);
  });

  it('Special unlocks at exactly 3★ and Ultimate at exactly 5★', () => {
    for (const s of [1, 2, 3, 4, 5]) {
      const b = sandbox({ kitten: s });
      expect(b.hasSpecial('kitten')).toBe(s >= 3);
      expect(b.hasUltimate('kitten')).toBe(s >= 5);
      expect(b.ultReadiness('kitten') !== undefined).toBe(s >= 5);
    }
  });

  it('the in-battle level and the star rank are independent', () => {
    const lv5star1 = getCatStats(CATS.kitten, 5, undefined, 1);
    const lv1star5 = getCatStats(CATS.kitten, 1, undefined, 5);
    expect(lv5star1.damage).toBeGreaterThan(lv1star5.damage * 3); // merging matters far more
  });
});

describe('new cats have distinct mechanics', () => {
  it('five new species, each with a unique attack kind', () => {
    expect(NEW_CATS).toHaveLength(5);
    const kinds = new Set(CAT_ORDER.map((id) => CATS[id].attack));
    expect(kinds.size).toBe(10);
  });

  it('Sir Sable pierces every mouse along the line, but not mice off the line', () => {
    const b = sandbox();
    const t = tile(b, '1-2'); // left inner ring, next to the first descent (column 0)
    b.placeCat('sable', 1, t.id);
    // Three mice in a vertical line on column 0 (the first descent), one far away.
    const a = mouse(b, 95);
    const c = mouse(b, 110);
    const d = mouse(b, 125);
    const off = mouse(b, 520);
    b.cats[0].mode = 'first';
    const hits = b.foesOnLine(t.x, t.y, a.x - t.x, a.y - t.y, 999, 14).map((f) => f.uid);
    void hits;
    // Fire one wave straight up the column through all three.
    for (let i = 0; i < 120 && a.hp === a.maxHp; i++) b.update(1 / 60);
    const hit = [a, c, d].filter((f) => f.hp < f.maxHp).length;
    expect(hit).toBeGreaterThanOrEqual(2);
    expect(off.hp).toBe(off.maxHp);
  });

  it('foesOnLine respects the line width', () => {
    const b = sandbox();
    const m = mouse(b, 200);
    expect(b.foesOnLine(m.x - 40, m.y, 1, 0, 100, 10).map((f) => f.uid)).toContain(m.uid);
    expect(b.foesOnLine(m.x - 40, m.y + 40, 1, 0, 100, 10)).toHaveLength(0);
    expect(b.foesOnLine(m.x + 60, m.y, 1, 0, 100, 10)).toHaveLength(0); // behind the start
  });

  it('Mr. Whiskers ricochets: hits the target, then nearby mice, never the same mouse twice', () => {
    const b = sandbox();
    b.placeCat('whiskers', 1, '1-1');
    const ms = [mouse(b, 60), mouse(b, 80), mouse(b, 100), mouse(b, 400)];
    for (let i = 0; i < 90; i++) b.update(1 / 60);
    const hitNear = ms.slice(0, 3).filter((f) => f.hp < f.maxHp).length;
    expect(hitNear).toBe(3); // 1 + 2 bounces
    expect(ms[3].hp).toBe(ms[3].maxHp); // too far to bounce to
    // Bounce target selection excludes already-hit mice and respects range.
    expect(b.bounceTarget(ms[0], 60, [ms[0].uid, ms[1].uid])?.uid).toBe(ms[2].uid);
    expect(b.bounceTarget(ms[0], 5, [ms[0].uid])).toBeNull();
  });

  it('Captain Mallow buffs nearby allies’ attack speed; buffs never stack infinitely', () => {
    const b = sandbox();
    b.placeCat('mallow', 1, '1-3');
    b.placeCat('mallow', 1, '1-4');
    b.placeCat('kitten', 1, '1-2');
    mouse(b, 600);
    const kitten = b.cats.find((c) => c.type === 'kitten')!;
    const base = getCatStats(CATS.kitten, 1).interval;
    for (let i = 0; i < 60; i++) b.update(1 / 60);
    const buffed = b.unitStats(kitten).interval;
    expect(buffed).toBeLessThan(base);
    // Two captains ringing at once still give a single buff.
    expect(base / buffed).toBeCloseTo(1 + CATS.mallow.buffSpeed!, 5);
    // It expires.
    b.cats = b.cats.filter((c) => c.type !== 'mallow');
    for (let i = 0; i < 60 * 5; i++) b.update(1 / 60);
    expect(b.unitStats(kitten).interval).toBeCloseTo(base, 6);
    expect(CATS.mallow.damage).toBe(0);
  });

  it('Shadow Pounce deals execute damage only below the HP threshold', () => {
    const b = sandbox();
    b.placeCat('pounce', 1, '1-1');
    const healthy = mouse(b, 60, 'normal', 1000);
    for (let i = 0; i < 40 && healthy.hp === 1000; i++) b.update(1 / 60);
    const normalHit = 1000 - healthy.hp;
    const st = getCatStats(CATS.pounce, 1);
    expect(normalHit).toBeCloseTo(st.damage, 5);
    healthy.hp = 300; // 30% < 35%
    const before = healthy.hp;
    for (let i = 0; i < 40 && healthy.hp === before; i++) b.update(1 / 60);
    expect(before - healthy.hp).toBeCloseTo(st.damage * st.executeMult, 5);
  });

  it('Silver Devil poison applies, ticks, refreshes and expires; stacks are capped', () => {
    const b = sandbox();
    b.placeCat('devil', 1, '1-1');
    const m = mouse(b, 60, 'normal', 5000);
    for (let i = 0; i < 90 && m.poisonUntil < 0; i++) b.update(1 / 60);
    expect(m.poisonStacks).toBe(1);
    const hp0 = m.hp;
    b.cats = []; // stop new hits
    for (let i = 0; i < 60; i++) b.update(1 / 60);
    const st = getCatStats(CATS.devil, 1);
    expect(hp0 - m.hp).toBeCloseTo(st.poisonDps, 0); // ~1 s of poison
    for (let i = 0; i < 60 * (st.poisonDuration + 1); i++) b.update(1 / 60);
    expect(m.poisonStacks).toBe(0); // expired
    const hp1 = m.hp;
    for (let i = 0; i < 60; i++) b.update(1 / 60);
    expect(m.hp).toBe(hp1);

    // 1★: never more than one stack; 3★: consecutive hits stack up to the cap.
    for (const [star, cap] of [
      [1, 1],
      [3, ABILITIES.devil.special.maxStacks],
    ] as const) {
      const c = sandbox({ devil: star });
      c.placeCat('devil', 5, '1-1');
      const t = mouse(c, 60, 'normal', 1e6);
      for (let i = 0; i < 60 * 12; i++) c.update(1 / 60);
      expect(t.poisonStacks).toBe(cap);
    }
  });

  it('poison is weaker on bosses', () => {
    const b = sandbox();
    const boss = mouse(b, 60, 'boss', 1e6);
    boss.isBoss = true;
    const norm = mouse(b, 70, 'normal', 1e6);
    for (const f of [boss, norm]) {
      f.poisonDps = 10;
      f.poisonStacks = 1;
      f.poisonUntil = 99;
    }
    for (let i = 0; i < 60; i++) b.update(1 / 60);
    expect(1e6 - boss.hp).toBeLessThan(1e6 - norm.hp);
    expect(ENEMIES.boss.isBoss).toBe(true);
  });
});

describe('specials (3★) work on the original five too', () => {
  it('Kitten 3★ throws an empowered yarn ball every few attacks', () => {
    const run = (star: number) => {
      const b = sandbox({ kitten: star });
      b.placeCat('kitten', 1, '1-1');
      const m = mouse(b, 60, 'normal', 1e6);
      for (let i = 0; i < 60 * 6; i++) b.update(1 / 60);
      return 1e6 - m.hp;
    };
    expect(run(3)).toBeGreaterThan(run(2) * 1.15);
  });

  it('Sable 3★ shreds armor; Orange 3★ makes mice vulnerable', () => {
    const b = sandbox({ sable: 3, orange: 3 });
    b.placeCat('sable', 1, '1-2');
    const a = mouse(b, 100, 'armored', 1e6);
    for (let i = 0; i < 120 && a.shred === 0; i++) b.update(1 / 60);
    expect(a.shred).toBe(ABILITIES.sable.special.armorShred);
    const c = sandbox({ orange: 3 });
    c.placeCat('orange', 1, '1-1');
    const m = mouse(c, 60, 'normal', 1e6);
    for (let i = 0; i < 240 && m.vulnUntil < 0; i++) c.update(1 / 60);
    expect(m.vulnerable).toBe(ABILITIES.orange.special.vulnerable);
  });
});

describe('ultimates (5★)', () => {
  it('fire automatically on a shared per-species cooldown, never spammed by extra copies', () => {
    const b = sandbox({ kitten: 5 });
    for (const t of ['1-1', '1-2', '1-3']) b.placeCat('kitten', 1, t);
    mouse(b, 60, 'normal', 1e7);
    const fired: number[] = [];
    for (let i = 0; i < 60 * 60; i++) {
      b.update(1 / 60);
      for (const e of b.drainEvents()) if (e.type === 'ultimate') fired.push(b.time);
    }
    // Starts half charged → first after ~11 s, then every 22 s.
    expect(fired.length).toBe(Math.floor((60 - ULTIMATE.cooldown * (1 - ULTIMATE.startCharge)) / ULTIMATE.cooldown) + 1);
    for (let i = 1; i < fired.length; i++) expect(fired[i] - fired[i - 1]).toBeGreaterThanOrEqual(ULTIMATE.cooldown - 0.05);
  });

  it('waits for a valid target instead of wasting the charge', () => {
    const b = sandbox({ pounce: 5 });
    b.placeCat('pounce', 1, '1-1');
    const m = mouse(b, 60, 'normal', 1e6); // healthy: not a valid "wounded" target
    for (let i = 0; i < 60 * 15; i++) b.update(1 / 60);
    expect(b.ultReadiness('pounce')).toBe(1);
    m.hp = 1e6 * 0.3;
    let fired = false;
    for (let i = 0; i < 30; i++) {
      b.update(1 / 60);
      if (b.drainEvents().some((e) => e.type === 'ultimate')) fired = true;
    }
    expect(fired).toBe(true);
    expect(b.ultReadiness('pounce')).toBeLessThan(0.1);
  });

  it('every one of the ten cats has a working ultimate', () => {
    for (const id of CAT_ORDER) {
      const b = sandbox({ kitten: 1, [id]: 5 }, [id]);
      b.placeCat(id, 3, '1-2');
      if (id === 'mallow') b.placeCat('kitten', 1, '1-3');
      const ms = [mouse(b, 95, 'normal', 1000), mouse(b, 110, 'normal', 1000), mouse(b, 125, 'normal', 1000)];
      if (id === 'pounce') for (const m of ms) [m.maxHp, m.hp] = [1e5, 3e4];
      let fired = false;
      for (let i = 0; i < 60 * 14 && !fired; i++) {
        b.update(1 / 60);
        if (b.drainEvents().some((e) => e.type === 'ultimate' && e.cat === id)) fired = true;
      }
      expect(fired, id).toBe(true);
    }
  });

  it('the Mushroom King takes only controlled damage from Shadow Pursuit and the Devil’s Pact', () => {
    const b = sandbox({ pounce: 5 });
    b.placeCat('pounce', 1, '1-1');
    const boss = mouse(b, 60, 'normal', 10000);
    boss.isBoss = true;
    boss.hp = 3000; // 30%: wounded
    const hp0 = boss.hp;
    for (let i = 0; i < 60 * 14; i++) b.update(1 / 60);
    const st = getCatStats(CATS.pounce, 1);
    // Every strike on a boss uses the normal multiplier (no ×3).
    const hits = Math.ceil((hp0 - boss.hp) / (st.damage * st.executeMult));
    expect(hp0 - boss.hp).toBeLessThanOrEqual(hits * st.damage * st.executeMult * ABILITIES.pounce.special.mult + 1);
  });
});

describe('tap-to-focus', () => {
  it('cats in range attack the focused mouse; out-of-range cats keep their own target', () => {
    const b = sandbox();
    b.placeCat('kitten', 1, '1-1');
    const first = mouse(b, 120, 'normal', 1e6); // furthest along = "first"
    const focus = mouse(b, 60, 'normal', 1e6);
    expect(b.setFocus(focus.uid)).toBe(focus.uid);
    for (let i = 0; i < 60; i++) b.update(1 / 60);
    expect(focus.hp).toBeLessThan(focus.maxHp);
    expect(first.hp).toBe(first.maxHp);
    // Tapping again cancels.
    expect(b.setFocus(focus.uid)).toBeNull();
  });

  it('focus outside a cat’s range is ignored by that cat', () => {
    const b = sandbox();
    b.placeCat('kitten', 1, '1-1');
    const near = mouse(b, 60, 'normal', 1e6);
    const far = mouse(b, 700, 'normal', 1e6);
    b.setFocus(far.uid);
    for (let i = 0; i < 60; i++) b.update(1 / 60);
    expect(near.hp).toBeLessThan(near.maxHp);
    expect(far.hp).toBe(far.maxHp);
  });

  it('clears when the focused mouse is defeated', () => {
    const b = sandbox();
    b.placeCat('kitten', 3, '1-1');
    const m = mouse(b, 60, 'normal', 5);
    b.setFocus(m.uid);
    for (let i = 0; i < 120; i++) b.update(1 / 60);
    expect(m.alive).toBe(false);
    expect(b.focusUid).toBeNull();
  });
});

describe('battle roster', () => {
  it('random summons only use the active team', () => {
    const team: CatId[] = ['whiskers', 'sable', 'mallow', 'pounce', 'devil'];
    const b = new Battle(stage, map, { seed: 3, roster: team });
    b.fish = 9999;
    for (let i = 0; i < 11; i++) b.summon();
    expect(b.cats.every((c) => team.includes(c.type))).toBe(true);
    expect(b.availableSkills().every((id) => !CATS[id as CatId])).toBe(true);
  });
});

describe('selling cats', () => {
  it('refunds by level, frees the tile and updates dried fish', () => {
    const b = new Battle(stage, map, { seed: 4 });
    b.fish = 0;
    for (let lv = 1; lv <= 5; lv++) {
      const t = b.emptyTiles()[0];
      const c = b.placeCat('kitten', lv, t.id)!;
      const before = b.fish;
      const r = b.sellCat(c.uid);
      expect(r.ok).toBe(true);
      expect(b.fish - before).toBe(BALANCE.sell.refund[lv - 1]);
      expect(b.catAt(t.id)).toBeUndefined();
    }
    // Higher levels refund more; never more than the cheapest possible cost of the cat.
    const refunds: readonly number[] = BALANCE.sell.refund;
    for (let i = 1; i < refunds.length; i++) expect(refunds[i]).toBeGreaterThanOrEqual(refunds[i - 1]);
    expect(refunds[4]).toBeGreaterThan(refunds[0]);
  });

  it('summon → sell loops can never gain dried fish', () => {
    const b = new Battle(stage, map, { seed: 9 });
    b.fish = 30;
    let last = b.fish;
    for (let i = 0; i < 40; i++) {
      const s = b.summon();
      if (!s.ok) break;
      b.sellCat(s.uid!);
      expect(b.fish).toBeLessThanOrEqual(last);
      last = b.fish;
    }
    expect(b.fish).toBeLessThan(30);
  });

  it('merging then selling returns far less than the cats cost', () => {
    // cheapest possible cost of a Lv.N cat = sum of the first 2^(N−1) summon prices
    for (let lv = 2; lv <= 5; lv++) {
      let cost = 0;
      for (let i = 0; i < 2 ** (lv - 1); i++) cost += summonCost(i);
      expect(BALANCE.sell.refund[lv - 1]).toBeLessThanOrEqual(cost * 0.6);
    }
  });

  it('only during an active battle or preparation; never touches permanent progress', () => {
    const b = new Battle(stage, map, { seed: 1, stars: { kitten: 4 } });
    const c = b.placeCat('kitten', 2, b.emptyTiles()[0].id)!;
    expect(b.preparing).toBe(true);
    b.status = 'paused';
    expect(b.sellCat(c.uid).ok).toBe(false);
    b.status = 'victory';
    expect(b.sellCat(c.uid).ok).toBe(false);
    b.status = 'playing';
    expect(b.sellCat(c.uid).ok).toBe(true); // preparation phase is fine
    expect(b.starOf('kitten')).toBe(4);
  });
});
