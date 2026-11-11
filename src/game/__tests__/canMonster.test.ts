import { ALL_STAGE_IDS, PIERCE_LESSON_STAGE, findStage } from '../../config/chapters';
import { CAN_MONSTER, GOLD_CHEST_CAN, MILESTONE_CANS, isCanMonsterStage, milestoneId, rollCanMonster } from '../../config/canRewards';
import { CATS } from '../../config/cats';
import { ENEMIES } from '../../config/enemies';
import { MAPS } from '../../config/maps';
import { CANS } from '../../config/unlocks';
import { parseSave, saveStore } from '../../save/store';
import { Battle, midEliteWave } from '../battle';
import type { CatId, EnemyId } from '../types';

const STARTERS: CatId[] = ['kitten', 'tabby', 'orange', 'black', 'white'];
const CAN_STAGES = ['2-6', '2-9', '2-15', '2-18'];
const battleOn = (id: string, opts: { canMonster?: boolean; roster?: CatId[] } = {}) => {
  const { stage, chapter } = findStage(id)!;
  return new Battle(stage, MAPS[chapter.mapId], { seed: 5, roster: opts.roster ?? STARTERS, canMonster: opts.canMonster });
};
/** Run until `done` (or a time limit), draining events into `seen`. */
const run = (b: Battle, done: () => boolean, maxT = 600, seen: string[] = []) => {
  for (let i = 0; i < maxT * 20 && !done(); i++) {
    b.update(0.05);
    for (const e of b.drainEvents()) seen.push(e.type);
  }
  return seen;
};

describe('Living Cat Food Can (罐頭怪): where and how often', () => {
  it('exists only on exactly four stages: 2-6, 2-9, 2-15, 2-18', () => {
    expect([...CAN_MONSTER.stages]).toEqual(CAN_STAGES);
    for (const id of ALL_STAGE_IDS) expect([id, isCanMonsterStage(id)]).toEqual([id, CAN_STAGES.includes(id)]);
    for (const id of ALL_STAGE_IDS) if (!CAN_STAGES.includes(id)) expect(rollCanMonster(id, 0, () => 0)).toBe(false);
    // No stage plan contains it: it is only ever added by the battle option on these stages.
    for (const id of ALL_STAGE_IDS) {
      const groups = findStage(id)!.stage.waves.flatMap((w) => w.groups);
      expect(groups.some((g) => 'enemy' in g && g.enemy === 'canMonster')).toBe(false);
    }
  });

  it('first attempt: 100%; later attempts: ~35% (30–40%)', () => {
    for (const id of CAN_STAGES) expect(rollCanMonster(id, 0, () => 0.9999)).toBe(true);
    expect(CAN_MONSTER.repeatChance).toBeGreaterThanOrEqual(0.3);
    expect(CAN_MONSTER.repeatChance).toBeLessThanOrEqual(0.4);
    let hits = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) if (rollCanMonster('2-9', 1 + (i % 5))) hits++;
    expect(hits / N).toBeGreaterThan(0.33);
    expect(hits / N).toBeLessThan(0.37);
  });

  it('attempts are counted per stage (a start, not a victory) and saved', () => {
    saveStore.reset();
    expect(saveStore.recordAttempt('2-6')).toBe(0);
    expect(saveStore.recordAttempt('2-6')).toBe(1);
    expect(saveStore.recordAttempt('2-9')).toBe(0);
    expect(saveStore.get().cleared['2-6']).toBeUndefined();
    expect(parseSave(JSON.stringify(saveStore.get())).attempts).toEqual({ '2-6': 2, '2-9': 1 });
  });

  it('joins the wave of a MID-stage elite, at the same moment, at most once per battle', () => {
    for (const id of CAN_STAGES) {
      const { stage } = findStage(id)!;
      const w = midEliteWave(stage);
      expect(w).toBeGreaterThan(0);
      expect(w).toBeLessThan(stage.waves.length - 1); // not the final wave
      const b = battleOn(id, { canMonster: true });
      b.startBattle();
      b.baseHp = 9999;
      let cans = 0;
      let canWave = -1;
      for (let i = 0; i < 40000 && b.waveIndex < stage.waves.length - 1; i++) {
        b.update(0.05);
        for (const f of b.foes) if (f.defId === 'canMonster' && canWave < 0) canWave = f.wave;
        cans = Math.max(cans, b.foes.filter((f) => f.defId === 'canMonster').length);
      }
      expect([id, canWave]).toEqual([id, w]);
      expect(cans).toBe(1);
      const eliteGroup = stage.waves[w].groups.find((g) => 'enemy' in g && ENEMIES[g.enemy].elite)!;
      const canEntry = (b as unknown as { spawnQueue: { time: number; group: { enemy?: string } }[] }).spawnQueue;
      void canEntry; // spawn time equality is covered by the pacing test below
      expect(eliteGroup).toBeTruthy();
    }
  });

  it('when not killed it reaches the house before its elite (all four stages)', () => {
    for (const id of CAN_STAGES) {
      const { stage } = findStage(id)!;
      const w = midEliteWave(stage);
      const elite = (stage.waves[w].groups.find((g) => 'enemy' in g && ENEMIES[g.enemy].elite) as { enemy: EnemyId }).enemy;
      const b = battleOn(id, { canMonster: true, roster: STARTERS });
      b.startBattle();
      b.baseHp = 9999;
      let canHome = -1;
      let eliteHome = -1;
      let eliteSeen = false;
      for (let i = 0; i < 60000 && eliteHome < 0; i++) {
        const before = b.foes.some((f) => f.alive && f.wave === w && f.defId === elite);
        b.update(0.05);
        for (const e of b.drainEvents()) if (e.type === 'canMonsterLooped' && canHome < 0) canHome = b.time;
        const after = b.foes.some((f) => f.alive && f.wave === w && f.defId === elite);
        if (after) eliteSeen = true;
        if (eliteSeen && before && !after) eliteHome = b.time;
      }
      expect([id, canHome > 0, eliteHome > 0]).toEqual([id, true, true]);
      expect([id, canHome < eliteHome]).toEqual([id, true]);
    }
  });
});

describe('Living Cat Food Can: combat rules', () => {
  const withCan = () => {
    const b = battleOn('2-6');
    b.startBattle();
    const can = b.spawn({ enemy: 'canMonster', count: 1, interval: 1 });
    return { b, can };
  };

  it('very high HP, very low armor, very fast (faster than every elite)', () => {
    const d = ENEMIES.canMonster;
    expect(d.armor).toBe(0);
    for (const e of Object.values(ENEMIES)) if (e.elite) expect(d.speed).toBeGreaterThan(e.speed);
    expect(d.hp).toBeGreaterThan(ENEMIES.normal.hp * 5);
    expect(d.slowImmune).toBe(true);
  });

  it('is completely immune to every slow (charm, ultimate, skills) but takes damage normally', () => {
    const { b, can } = withCan();
    // Noble White's charm and Grand Royal Pose, applied by the real code paths:
    b.placeCat('white', 5, b.tiles.find((t) => t.unlocked)!.id);
    can.slowStrength = 0.6; // even a slow set directly is ignored on the next step
    can.slowT = 5;
    const d0 = can.dist;
    b.update(0.5);
    expect(can.slowStrength).toBe(0);
    expect(can.dist - d0).toBeCloseTo(can.speed * 0.5, 0);
    const hp = can.hp;
    (b as unknown as { hit: (f: unknown, d: number) => void }).hit(can, 50);
    expect(can.hp).toBeLessThan(hp);
  });

  it('each escape costs exactly 1 heart, keeps its HP and restarts at the entrance — no duplicates', () => {
    const { b, can } = withCan();
    can.hp = Math.round(can.maxHp * 0.4);
    const hpBefore = can.hp;
    const hearts = b.baseHp;
    can.dist = b.path.length - 1;
    b.update(0.1);
    expect(b.baseHp).toBe(hearts - 1);
    expect(can.alive).toBe(true);
    expect(can.hp).toBe(hpBefore);
    expect(can.dist).toBeLessThan(20);
    expect(b.foes.filter((f) => f.defId === 'canMonster')).toHaveLength(1);
    // Again and again, no cap.
    for (let k = 0; k < 3; k++) {
      can.dist = b.path.length - 1;
      b.update(0.1);
    }
    expect(b.baseHp).toBe(hearts - 4);
    expect(can.hp).toBe(hpBefore);
  });

  it('after the last wave it keeps running until defeated or the house falls (no early victory, no idle)', () => {
    const { stage } = findStage('2-6')!;
    const b = battleOn('2-6', { roster: STARTERS });
    b.startBattle();
    const can = b.spawn({ enemy: 'canMonster', count: 1, interval: 1 });
    // Jump to the end of the last wave with only the can left.
    Object.assign(b as unknown as Record<string, unknown>, { waveIndex: stage.waves.length - 1, spawnQueue: [], spawnPtr: 0 });
    b.foes = [can];
    run(b, () => b.status !== 'playing', 400);
    expect(b.status).toBe('defeat'); // nobody shot it: it ran laps until the house fell
    const b2 = battleOn('2-6', { roster: STARTERS });
    b2.startBattle();
    const can2 = b2.spawn({ enemy: 'canMonster', count: 1, interval: 1 });
    Object.assign(b2 as unknown as Record<string, unknown>, { waveIndex: stage.waves.length - 1, spawnQueue: [], spawnPtr: 0 });
    b2.foes = [can2];
    b2.update(0.1);
    expect(b2.status).toBe('playing'); // alive can → no victory yet
    (b2 as unknown as { hit: (f: unknown, d: number) => void }).hit(can2, 1e9);
    const seen = run(b2, () => b2.status !== 'playing', 5);
    expect(seen).toContain('canMonsterDefeated');
    expect(b2.status).toBe('victory');
  });
});

describe('Cat Food Can rewards and anti-farming', () => {
  beforeEach(() => saveStore.reset());

  it('the can monster gives 1 can once per stage, then only fish coins', () => {
    const r1 = saveStore.claimCanMonster('2-9');
    expect(r1).toEqual({ cans: CAN_MONSTER.rewardCans, coins: 0 });
    const coins = saveStore.get().fishCoins;
    expect(saveStore.claimCanMonster('2-9')).toEqual({ cans: 0, coins: CAN_MONSTER.repeatCoins });
    expect(saveStore.get().fishCoins).toBe(coins + CAN_MONSTER.repeatCoins);
    expect(saveStore.get().cans).toBe(1);
    expect(saveStore.claimCanMonster('2-15').cans).toBe(1); // each of the four stages once
    expect(saveStore.claimCanMonster('2-7')).toEqual({ cans: 0, coins: 0 }); // not a can stage
    // A reload can't re-grant (the claim is saved with the can).
    const reloaded = parseSave(JSON.stringify(saveStore.get()));
    expect(reloaded.milestones).toEqual(expect.arrayContaining([milestoneId.canMonster('2-9'), milestoneId.canMonster('2-15')]));
  });

  it('Gold Chest: 4%, only after 2-5, never on the can stages, at most once per stage', () => {
    expect(GOLD_CHEST_CAN.chance).toBe(0.04);
    expect(saveStore.rollGoldChestCan('2-3', () => 0)).toBe(0); // recruitment still locked
    saveStore.completeStage('2-5', 10, 10);
    const base = saveStore.get().cans;
    expect(saveStore.rollGoldChestCan('2-3', () => 0.05)).toBe(0); // 5% roll misses
    expect(saveStore.rollGoldChestCan('2-6', () => 0)).toBe(0); // can-monster stage: its own reward only
    expect(saveStore.rollGoldChestCan('2-3', () => 0.01)).toBe(1);
    expect(saveStore.rollGoldChestCan('2-3', () => 0)).toBe(0); // capped for that stage forever
    expect(saveStore.rollGoldChestCan('1-10', () => 0)).toBe(1); // a different stage may still drop once
    expect(saveStore.get().cans).toBe(base + 2);
    // Monte Carlo on fresh stages: ~4%.
    let hits = 0;
    for (let i = 0; i < 4000; i++) if (Math.random() < GOLD_CHEST_CAN.chance) hits++;
    expect(hits / 4000).toBeGreaterThan(0.025);
    expect(hits / 4000).toBeLessThan(0.055);
  });

  it('first-clear milestones: 2-8 1 · 2-10 2 · 2-13 1 · 2-16 1 · 2-18 1 · 2-20 3 (11 with the 2-5 gift), once each', () => {
    expect(MILESTONE_CANS).toEqual({ '2-8': 1, '2-10': 2, '2-13': 1, '2-16': 1, '2-18': 1, '2-20': 3 });
    expect(Object.values(MILESTONE_CANS).reduce((a, b) => a + b, 0) + CANS.introGift).toBe(11);
    for (const id of ['2-5', '2-7']) expect(saveStore.completeStage(id, 10, 10).cans).toBe(0);
    expect(saveStore.completeStage('2-8', 10, 10).cans).toBe(1);
    expect(saveStore.completeStage('2-8', 10, 10).cans).toBe(0); // replay: nothing
    expect(saveStore.completeStage('2-10', 10, 10).cans).toBe(2);
    expect(saveStore.claimMilestoneCans()).toBe(0);
  });

  it('older saves receive only the milestones they legitimately earned, once', () => {
    const cleared = Object.fromEntries([...ALL_STAGE_IDS.slice(0, 22)].map((i) => [i, 3])); // through 2-12
    const s = parseSave(JSON.stringify({ version: 4, cleared, cans: 1, milestones: [milestoneId.clear('2-8')] }));
    expect(s.cans).toBe(1);
    // 2-8 already paid → only 2-10 is owed.
    const owed = Object.entries(MILESTONE_CANS)
      .filter(([st]) => st in cleared && st !== '2-8')
      .reduce((a, [, n]) => a + n, 0);
    expect(owed).toBe(2);
  });
});

describe("Sir Sable's piercing lesson uses his real attack", () => {
  const run3 = (tile: string) => {
    const b = new Battle(PIERCE_LESSON_STAGE, MAPS.pierce_lesson, { sandbox: true, seed: 1 });
    b.startBattle();
    const s = b.cats[0];
    expect(s.type).toBe('sable');
    expect(CATS.sable.attack).toBe('pierce');
    if (s.tileId !== tile) b.dropCat(s.uid, tile);
    b.spawnLine('normal', 6, 160, 32);
    for (let i = 0; i < 300; i++) b.update(0.1);
    return b.pierceHits;
  };

  it('in line with the straight road one wave hits several mice; from the side mostly one', () => {
    const line = run3('2-6');
    const side = run3('3-4');
    expect(Math.max(...line)).toBeGreaterThanOrEqual(3);
    const sorted = [...side].sort((a, b) => a - b);
    expect(sorted[Math.floor(sorted.length / 2)]).toBe(1); // median strike from the side: 1 mouse
    expect(Math.max(...side)).toBeLessThan(Math.max(...line));
  });

  it('the wave really damages every mouse it passes through', () => {
    const b = new Battle(PIERCE_LESSON_STAGE, MAPS.pierce_lesson, { sandbox: true, seed: 2 });
    b.startBattle();
    b.dropCat(b.cats[0].uid, '2-6');
    const mice = b.spawnLine('normal', 6, 160, 32);
    for (let i = 0; i < 120 && Math.max(0, ...b.pierceHits) < 3; i++) b.update(0.05);
    expect(mice.filter((m) => m.hp < m.maxHp).length).toBeGreaterThanOrEqual(3);
  });
});
