import { BALANCE, summonCost } from '../../config/balance';
import { CATS, TARGET_MODES } from '../../config/cats';
import { CHAPTERS } from '../../config/chapters';
import { MAPS } from '../../config/maps';
import { SKILLS } from '../../config/skills';
import { Battle, canMerge, type Foe } from '../battle';
import { applyDamageToPools, computeDamage, computeSkillMods, getCatStats } from '../combat';
import { computeStars } from '../progression';
import { selectTarget, type TargetCandidate } from '../targeting';
import type { StageDef } from '../types';
import { parseSave } from '../../save/store';

const map = MAPS[CHAPTERS[0].mapId];
const stage = (n: number): StageDef => CHAPTERS[0].stages[n - 1];
/** A battle past its preparation phase (combat tests). Prep behaviour is covered in v13.test.ts. */
const newBattle = (n = 1, seed = 42) => {
  const b = new Battle(stage(n), map, seed);
  b.startBattle();
  return b;
};

/** Run until the first wave spawns something. */
function untilFoes(b: Battle) {
  let i = 0;
  while (!b.foes.length && i++ < 2000) b.update(0.05);
}

describe('damage formula', () => {
  it('subtracts armor flat', () => {
    expect(computeDamage(20, 5)).toBe(15);
  });
  it('always lets the minimum ratio through', () => {
    expect(computeDamage(5, 6)).toBeCloseTo(5 * BALANCE.minDamageRatio);
  });
  it('armor reduction lowers effective armor but not below zero', () => {
    expect(computeDamage(10, 6, 4)).toBe(8);
    expect(computeDamage(10, 2, 9)).toBe(10);
  });
  it('shield absorbs before HP', () => {
    expect(applyDamageToPools(50, 20, 15)).toMatchObject({ hp: 50, shield: 5 });
    expect(applyDamageToPools(50, 20, 30)).toMatchObject({ hp: 40, shield: 0 });
  });
  it('combo cat suffers more vs armor than sniper', () => {
    const tabby = getCatStats(CATS.tabby, 1);
    const black = getCatStats(CATS.black, 1);
    const tabbyRatio = computeDamage(tabby.damage, 6) / tabby.damage;
    const blackRatio = computeDamage(black.damage, 6) / black.damage;
    expect(tabbyRatio).toBeLessThan(blackRatio);
  });
});

describe('cat stats & skills', () => {
  it('merging never loses damage, but is not wildly better than two cats', () => {
    const l1 = getCatStats(CATS.kitten, 1);
    const l2 = getCatStats(CATS.kitten, 2);
    const dps1 = l1.damage / l1.interval;
    const dps2 = l2.damage / l2.interval;
    expect(dps2).toBeGreaterThanOrEqual(dps1 * 2);
    expect(dps2).toBeLessThan(dps1 * 2.4);
  });
  it('skill mods apply', () => {
    const mods = computeSkillMods({ sharpClaws: 2, flurryPaws: 1 });
    expect(getCatStats(CATS.kitten, 1, mods).damage).toBeCloseTo(CATS.kitten.damage * 1.2);
    expect(getCatStats(CATS.tabby, 1, mods).comboHits).toBe(4);
    expect(getCatStats(CATS.kitten, 1, mods).comboHits).toBe(1);
  });
  it('white cat slow is capped', () => {
    const mods = computeSkillMods({ dazzlingGrace: 3 });
    expect(getCatStats(CATS.white, 5, mods).slowStrength).toBeLessThanOrEqual(BALANCE.slowCap);
  });
});

describe('targeting', () => {
  const mk = (uid: number, kind: 'enemy' | 'chest', x: number, hp: number, dist: number, alive = true): TargetCandidate => ({
    uid, kind, x, y: 0, hp, shield: 0, dist, alive,
  });
  const foes = [mk(1, 'enemy', 10, 50, 100), mk(2, 'enemy', 30, 20, 300), mk(3, 'enemy', 50, 90, 200), mk(4, 'chest', 20, 100, 400)];

  it('first = furthest along path (enemies only while enemies are in range)', () => {
    expect(selectTarget(0, 0, 100, 'first', foes)?.uid).toBe(2);
  });
  it('nearest', () => {
    expect(selectTarget(0, 0, 100, 'nearest', foes)?.uid).toBe(1);
  });
  it('strongest / weakest', () => {
    expect(selectTarget(0, 0, 100, 'strongest', foes)?.uid).toBe(3);
    expect(selectTarget(0, 0, 100, 'weakest', foes)?.uid).toBe(2);
  });
  it('treasure prioritises chests', () => {
    expect(selectTarget(0, 0, 100, 'treasure', foes)?.uid).toBe(4);
  });
  it('treasure falls back to first when no chest in range', () => {
    expect(selectTarget(0, 0, 15, 'treasure', foes)?.uid).toBe(1);
    expect(selectTarget(0, 0, 100, 'treasure', foes.filter((f) => f.kind !== 'chest'))?.uid).toBe(2);
  });
  it('respects range and ignores dead targets', () => {
    expect(selectTarget(0, 0, 5, 'first', foes)).toBeNull();
    expect(selectTarget(0, 0, 100, 'first', [mk(9, 'enemy', 5, 10, 999, false)])).toBeNull();
  });
  it('other modes hit chests when no enemy is in range', () => {
    expect(selectTarget(0, 0, 100, 'first', [foes[3]])?.uid).toBe(4);
  });
});

describe('summoning', () => {
  it('spends the right amount and places on an empty unlocked tile', () => {
    const b = newBattle();
    const start = b.fish;
    const cost = b.summonCost;
    expect(b.summon().ok).toBe(true);
    expect(b.fish).toBe(start - cost);
    expect(b.cats).toHaveLength(1);
    const tile = b.tileById(b.cats[0].tileId)!;
    expect(tile.unlocked).toBe(true);
    expect(stage(1).roster).toContain(b.cats[0].type);
    expect(b.summonCost).toBe(summonCost(1));
  });
  it('never doubles up on a tile and refuses without charging when full', () => {
    const b = newBattle();
    b.fish = 100000;
    const n = stage(1).tiles.length;
    for (let i = 0; i < n; i++) expect(b.summon().ok).toBe(true);
    expect(new Set(b.cats.map((c) => c.tileId)).size).toBe(n);
    const fish = b.fish;
    const r = b.summon();
    expect(r.ok).toBe(false);
    expect(b.fish).toBe(fish);
  });
  it('refuses when broke without charging', () => {
    const b = newBattle();
    b.fish = 0;
    const r = b.summon();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('noFish');
    expect(b.fish).toBe(0);
    expect(b.cats).toHaveLength(0);
  });
});

describe('moving & merging', () => {
  function setup() {
    const b = newBattle();
    b.fish = 100000;
    for (let i = 0; i < 6; i++) b.summon();
    return b;
  }
  it('moves freely to empty tiles, repeatedly, at no cost', () => {
    const b = setup();
    const cat = b.cats[0];
    const fish = b.fish;
    for (let i = 0; i < 3; i++) {
      const dest = b.emptyTiles()[0];
      expect(b.dropCat(cat.uid, dest.id).result).toBe('moved');
      expect(cat.tileId).toBe(dest.id);
    }
    expect(b.fish).toBe(fish);
  });
  it('cannot move onto locked tiles', () => {
    const b = setup();
    const locked = b.tiles.find((t) => !t.unlocked)!;
    const cat = b.cats[0];
    const from = cat.tileId;
    expect(b.dropCat(cat.uid, locked.id).result).toBe('cancel');
    expect(cat.tileId).toBe(from);
  });
  it('merges same type + level into one higher-level cat', () => {
    const b = setup();
    const [a, c] = b.cats;
    a.type = 'kitten'; a.level = 1;
    c.type = 'kitten'; c.level = 1;
    const count = b.cats.length;
    expect(b.dropCat(a.uid, c.tileId).result).toBe('merged');
    expect(b.cats).toHaveLength(count - 1);
    expect(c.level).toBe(2);
    expect(c.type).toBe('kitten');
    expect(b.catByUid(a.uid)).toBeUndefined();
  });
  it('swaps with a different type instead of merging', () => {
    const b = setup();
    const [a, c] = b.cats;
    a.type = 'kitten'; c.type = 'tabby'; a.level = c.level = 1;
    const ta = a.tileId, tc = c.tileId;
    const n = b.cats.length;
    expect(b.dropCat(a.uid, tc).result).toBe('swapped');
    expect(a.tileId).toBe(tc);
    expect(c.tileId).toBe(ta);
    expect(b.catByUid(a.uid)!.x).toBe(b.tileById(tc)!.x);
    expect(b.cats).toHaveLength(n);
    expect(a.level).toBe(1);
    expect(c.level).toBe(1);
    expect(b.stats.swaps).toBe(1);
  });
  it('swaps with the same type at a different level', () => {
    const b = setup();
    const [a, d] = b.cats;
    a.type = 'kitten'; a.level = 1;
    d.type = 'kitten'; d.level = 2;
    const ta = a.tileId, td = d.tileId;
    expect(b.dropCat(a.uid, td).result).toBe('swapped');
    expect([a.tileId, d.tileId]).toEqual([td, ta]);
    expect(a.level).toBe(1);
    expect(d.level).toBe(2);
  });
  it('two max-level identical cats neither merge nor swap', () => {
    const b = setup();
    const [a, d] = b.cats;
    a.type = d.type = 'kitten';
    a.level = d.level = BALANCE.levels.maxLevel;
    const ta = a.tileId;
    const r = b.dropCat(a.uid, d.tileId);
    expect(r).toEqual({ result: 'cancel', reason: 'maxLevel' });
    expect(a.tileId).toBe(ta);
  });
  it('invalid drops cancel safely', () => {
    const b = setup();
    const a = b.cats[0];
    const ta = a.tileId;
    expect(b.dropCat(a.uid, null).result).toBe('cancel');
    expect(b.dropCat(a.uid, ta).result).toBe('cancel');
    expect(b.dropCat(a.uid, 'nope').result).toBe('cancel');
    expect(b.dropCat(9999, b.emptyTiles()[0].id).result).toBe('cancel');
    expect(a.tileId).toBe(ta);
  });
  it('previewDrop matches dropCat without side effects', () => {
    const b = setup();
    const [a, c] = b.cats;
    a.type = 'kitten'; c.type = 'kitten'; a.level = c.level = 1;
    const before = JSON.stringify(b.cats);
    expect(b.previewDrop(a.uid, c.tileId).result).toBe('merged');
    expect(b.previewDrop(a.uid, b.emptyTiles()[0].id).result).toBe('moved');
    expect(JSON.stringify(b.cats)).toBe(before);
  });
  it('rejects merging at max level', () => {
    const max = BALANCE.levels.maxLevel;
    expect(canMerge({ uid: 1, type: 'kitten', level: max }, { uid: 2, type: 'kitten', level: max })).toBe(false);
    expect(canMerge({ uid: 1, type: 'kitten', level: 1 }, { uid: 1, type: 'kitten', level: 1 })).toBe(false);
  });
});

describe('target mode cycling', () => {
  it('cycles through all five modes and wraps', () => {
    const b = newBattle();
    b.summon();
    const cat = b.cats[0];
    expect(cat.mode).toBe('first');
    const seen = [cat.mode];
    for (let i = 0; i < 5; i++) seen.push(b.cycleTarget(cat.uid)!);
    expect(seen).toEqual([...TARGET_MODES, 'first']);
  });
});

describe('skills', () => {
  it('buying grants exactly one random skill and duplicates level up', () => {
    const b = newBattle(7);
    b.fish = 100000;
    let total = 0;
    for (let i = 0; i < 6; i++) {
      expect(b.buySkill().ok).toBe(true);
      total++;
      const sum = Object.values(b.skills).reduce((a, v) => a + (v ?? 0), 0);
      expect(sum).toBe(total);
    }
    // Every owned skill respects max level and roster relevance
    for (const [id, lv] of Object.entries(b.skills)) {
      const def = SKILLS[id as keyof typeof SKILLS];
      expect(lv).toBeLessThanOrEqual(def.maxLevel);
      if (def.cat) expect(stage(7).roster).toContain(def.cat);
    }
  });
  it('does not offer skills for cats outside the roster', () => {
    const b = newBattle(1);
    expect(b.availableSkills()).not.toContain('bellySlam');
    expect(b.availableSkills()).not.toContain('dazzlingGrace');
    expect(b.availableSkills()).toContain('flurryPaws');
  });
  it('skills reset for a new battle', () => {
    const b = newBattle(7);
    b.fish = 100000;
    b.buySkill();
    const b2 = newBattle(7);
    expect(b2.skills).toEqual({});
    expect(b2.cats).toHaveLength(0);
    expect(b2.fish).toBe(stage(7).startFish);
  });
});

describe('treasure chests', () => {
  function chestBattle() {
    const b = newBattle(3);
    untilFoes(b);
    const enemy = b.foes[0] as Foe;
    // Turn the first spawn into a bronze chest for a deterministic test
    Object.assign(enemy, { kind: 'chest', defId: 'bronze', hp: 1, maxHp: 1, rewarded: false });
    return { b, chest: enemy };
  }
  it('destroying a chest pauses combat with three choices and gives coins once', () => {
    const { b, chest } = chestBattle();
    b.fish = 1000;
    b.summon();
    const cat = b.cats[0];
    // Park the cat right on the chest
    cat.x = chest.x; cat.y = chest.y; cat.cooldown = 0; cat.type = 'orange';
    let guard = 0;
    while (b.status === 'playing' && guard++ < 500) b.update(1 / 60);
    expect(b.status).toBe('reward');
    expect(b.currentReward?.choices).toHaveLength(3);
    const coinEvents = b.drainEvents().filter((e) => e.type === 'coins');
    expect(coinEvents).toHaveLength(1);
    expect(b.chestCoins).toBeGreaterThanOrEqual(5);

    // Paused: enemies don't move
    const snapshot = b.foes.map((f) => f.dist);
    b.update(1);
    expect(b.foes.map((f) => f.dist)).toEqual(snapshot);
    expect(b.summon().ok).toBe(false);

    // Choose → skill granted, combat resumes
    const pick = b.currentReward!.choices[1];
    expect(b.chooseReward(1).ok).toBe(true);
    expect(b.skills[pick.skillId]).toBe(pick.levels);
    expect(b.status).toBe('playing');
    // No duplicate reward
    expect(b.chooseReward(0).ok).toBe(false);
    b.update(1);
    expect(b.drainEvents().filter((e) => e.type === 'coins')).toHaveLength(0);
  });
  it('gold chest choices grant two levels', () => {
    const b = newBattle(10);
    const choices = b.rollChestChoices('gold');
    expect(choices).toHaveLength(3);
    expect(new Set(choices.map((c) => c.skillId)).size).toBe(3);
    expect(choices.every((c) => c.levels === 2)).toBe(true);
  });
});

describe('win / lose', () => {
  it('loses when base HP hits zero', () => {
    const b = newBattle(1);
    let guard = 0;
    while (b.status === 'playing' && guard++ < 100000) b.update(0.1);
    expect(b.status).toBe('defeat');
    expect(b.baseHp).toBe(0);
    // Frozen after defeat
    const t = b.time;
    b.update(1);
    expect(b.time).toBe(t);
  });
  it('wins after all waves when defended', () => {
    const b = newBattle(1);
    b.fish = 100000;
    for (let i = 0; i < stage(1).tiles.length; i++) b.summon();
    let guard = 0;
    while (b.status === 'playing' && guard++ < 100000) b.update(0.1);
    expect(b.status).toBe('victory');
    expect(b.baseHp).toBeGreaterThan(0);
    expect(b.waveIndex).toBe(stage(1).waves.length - 1);
  });
  it('pause freezes simulation', () => {
    const b = newBattle(1);
    untilFoes(b);
    b.pause();
    const d = b.foes[0].dist;
    b.update(2);
    expect(b.foes[0].dist).toBe(d);
    b.resume();
    b.update(0.5);
    expect(b.foes[0].dist).toBeGreaterThan(d);
  });
  it('stars reflect remaining HP', () => {
    expect(computeStars(10, 10)).toBe(3);
    expect(computeStars(6, 10)).toBe(2);
    expect(computeStars(1, 10)).toBe(1);
  });
});

describe('save parsing', () => {
  it('migrates a v1 save: keeps progress, adds empty seen list', () => {
    const v1 = { version: 1, fishCoins: 120, unlocked: ['1-1', '1-2', '1-3'], cleared: { '1-1': 3, '1-2': 2 }, owned: ['hat_bow'], equipped: { hat: 'hat_bow', skins: {} } };
    const s = parseSave(JSON.stringify(v1));
    expect(s.version).toBe(4); // v1 → current; collection fields are covered in collection.test.ts
    expect(s.fishCoins).toBe(120);
    expect(s.unlocked).toEqual(['1-1', '1-2', '1-3']);
    expect(s.cleared).toEqual({ '1-1': 3, '1-2': 2 });
    expect(s.equipped.hat).toBe('hat_bow');
    expect(s.seen).toEqual([]);
  });
  it('keeps seen intro ids (deduplicated)', () => {
    const s = parseSave(JSON.stringify({ version: 2, seen: ['cat:kitten', 'cat:kitten', 'tut:summon', 5] }));
    expect(s.seen).toEqual(['cat:kitten', 'tut:summon']);
  });
  it('falls back to defaults on garbage', () => {
    expect(parseSave('not json').fishCoins).toBe(0);
    expect(parseSave(null).unlocked).toEqual(['1-1']);
  });
  it('keeps valid data and drops invalid entries', () => {
    const s = parseSave(
      JSON.stringify({ fishCoins: 55, unlocked: ['1-1', '1-2', 'bogus'], cleared: { '1-1': 3 }, owned: ['hat_bow', 'nope'], equipped: { hat: 'hat_bow', skins: { kitten: 'skin_calico' } } }),
    );
    expect(s.fishCoins).toBe(55);
    expect(s.unlocked).toEqual(['1-1', '1-2']);
    expect(s.owned).toEqual(['hat_bow']);
    expect(s.equipped.hat).toBe('hat_bow');
    expect(s.equipped.skins.kitten).toBeUndefined(); // not owned
  });
});

describe('economy', () => {
  it('summons cost 1,1,1 then 2,2,2 then 3,3,3 … (tiered, never jumping)', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => summonCost(n))).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3, 4]);
    for (let i = 1; i < 120; i++) {
      expect(summonCost(i)).toBeGreaterThanOrEqual(summonCost(i - 1));
      expect(summonCost(i) - summonCost(i - 1)).toBeLessThanOrEqual(1);
    }
  });
  it('summon costs reset for every new stage', () => {
    const b = newBattle(1);
    b.fish = 999;
    for (let i = 0; i < 5; i++) b.summon();
    expect(b.summonCost).toBeGreaterThan(1);
    const next = new Battle(stage(2), map, 1);
    expect(next.summonCost).toBe(1);
  });
  it('starting fish is small but buys the first few summons', () => {
    for (const s of CHAPTERS[0].stages) {
      expect(s.startFish).toBeGreaterThanOrEqual(10);
      expect(s.startFish).toBeLessThanOrEqual(15);
      expect(summonCost(0) + summonCost(1) + summonCost(2)).toBeLessThanOrEqual(s.startFish);
    }
  });
  it('tracks fish earned and spent', () => {
    const b = newBattle(1);
    b.summon();
    expect(b.stats.fishSpent).toBe(1);
    let guard = 0;
    while (b.stats.kills === 0 && guard++ < 5000) b.update(0.05);
    expect(b.stats.fishEarned).toBeGreaterThan(0);
  });
});

describe('feature unlocks', () => {
  it('Random Skill is locked before its unlock stage', () => {
    const b = newBattle(1);
    b.fish = 999;
    const r = b.buySkill();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('skillLocked');
    expect(b.fish).toBe(999);
    const s = stage(BALANCE.unlocks.skillShopFromStage);
    const b5 = new Battle(s, map, 1);
    b5.fish = 999;
    expect(b5.buySkill().ok).toBe(true);
  });
});

describe('tutorial freeze', () => {
  it('frozen battles do not move, spawn or count down', () => {
    const b = newBattle(1);
    untilFoes(b);
    b.frozen = true;
    const snap = JSON.stringify({ d: b.foes.map((f) => f.dist), t: b.time, n: b.foes.length, w: b.waveIndex });
    b.update(5);
    expect(JSON.stringify({ d: b.foes.map((f) => f.dist), t: b.time, n: b.foes.length, w: b.waveIndex })).toBe(snap);
    // visual clock still runs so animations play
    const v = b.vtime;
    b.tickVisual(0.05);
    expect(b.vtime).toBeGreaterThan(v);
    // player can still act while frozen (interactive lessons)
    b.fish = 50;
    expect(b.summon().ok).toBe(true);
    b.frozen = false;
    b.update(0.5);
    expect(b.time).toBeGreaterThan(0);
  });
  it('prep countdown is frozen too', () => {
    const b = new Battle(stage(1), map, 42);
    b.frozen = true;
    b.update(30);
    expect(b.waveIndex).toBe(-1);
    expect(b.prepRemaining).toBe(BALANCE.prepSeconds);
  });
});

describe('stage start cats', () => {
  it('stage 2 is plain practice: no free starting cats', () => {
    const b = newBattle(2);
    expect(b.cats).toHaveLength(0);
    expect(b.summonCost).toBe(1);
    expect(b.fish).toBe(stage(2).startFish);
  });
});

describe('battle length', () => {
  it('later stages have more waves', () => {
    const waves = CHAPTERS[0].stages.map((s) => s.waves.length);
    expect(waves[0]).toBeGreaterThanOrEqual(4);
    expect(waves[9]).toBeGreaterThan(waves[3]);
    expect(waves[3]).toBeGreaterThan(waves[1]);
  });
  it('stage 10 has a boss and a gold chest', () => {
    const groups = stage(10).waves.flatMap((w) => w.groups);
    expect(groups.some((g) => 'enemy' in g && g.enemy === 'boss')).toBe(true);
    expect(groups.some((g) => 'chest' in g && g.chest === 'gold')).toBe(true);
  });
});
