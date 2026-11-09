import { BALANCE } from '../../config/balance';
import { CHAPTERS } from '../../config/chapters';
import { MAPS } from '../../config/maps';
import { recovery, RECOVERY_VERSION, type RecoveryRecord } from '../../save/battleRecovery';
import { Battle, SNAPSHOT_VERSION, validateSnapshot } from '../battle';
import type { CatId } from '../types';

const [ch1, ch2] = CHAPTERS;
const FRAME = (1 / 60) * BALANCE.speed.baseline;
const TEAM: CatId[] = ['kitten', 'orange', 'black', 'mallow', 'devil'];
const STARS = { kitten: 5, orange: 5, black: 5, mallow: 5, devil: 5 };

/** A busy Chapter 2 battle: 5★ ultimates, Mallow buffs, Devil poison, chests, projectiles. */
function busy(seed = 4): Battle {
  const stage = ch2.stages[3];
  const b = new Battle(stage, MAPS[ch2.mapId], { seed, roster: TEAM, stars: STARS });
  const plan: [CatId, number][] = [
    ['kitten', 3],
    ['orange', 3],
    ['black', 3],
    ['mallow', 2],
    ['devil', 3],
    ['devil', 2],
    ['kitten', 2],
  ];
  for (const [t, lv] of plan) b.placeCat(t, lv, b.emptyTiles()[0].id);
  b.fish = 60;
  b.summon();
  b.buySkill();
  b.startBattle();
  for (let i = 0; i < 60 * 60; i++) {
    b.update(FRAME);
    if (b.status === 'reward') b.chooseReward(0);
    const poisoned = b.foes.some((f) => f.alive && f.poisonUntil > b.time);
    if (b.time > 25 && b.projectiles.length && poisoned && b.cats.some((c) => c.buffSpeedUntil > b.time || b.teamBuff.until > b.time)) break;
  }
  expect(b.status).toBe('playing');
  return b;
}

/** Combat-relevant state (no visual effects). */
const state = (b: Battle) =>
  JSON.stringify({
    t: b.time,
    fish: b.fish,
    hp: b.baseHp,
    wave: b.waveIndex,
    foes: b.foes,
    cats: b.cats,
    proj: b.projectiles,
    skills: b.skills,
    ult: b.ultCharge,
    buff: b.teamBuff,
    reward: b.rewardQueue,
    stats: b.stats,
    status: b.status,
    summonCost: b.summonCost,
    skillCost: b.skillCost,
  });

function mem() {
  const store: Record<string, string> = {};
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => void (store[k] = v),
    removeItem: (k: string) => void delete store[k],
  };
  return store;
}

describe('battle snapshot / restore', () => {
  it('restores a busy battle exactly: same future (enemies, HP, statuses, buffs, projectiles, ultimates, spawns, RNG)', () => {
    const a = busy();
    expect(a.projectiles.length).toBeGreaterThan(0);
    expect(a.foes.some((f) => f.alive && f.poisonUntil > a.time)).toBe(true); // statuses
    expect(a.cats.some((c) => c.buffSpeedUntil > a.time) || a.teamBuff.until > a.time).toBe(true); // buffs
    expect(Object.keys(a.ultCharge).length).toBe(5); // 5★ ultimates charging
    expect(a.waveIndex).toBeGreaterThanOrEqual(1);
    const snap = JSON.parse(JSON.stringify(a.snapshot())); // through real JSON, like localStorage
    const b = Battle.restore(a.stage, a.map, snap, false)!;
    expect(b).not.toBeNull();
    expect(state(b)).toBe(state(a));
    for (let i = 0; i < 60 * 40; i++) {
      a.update(FRAME);
      b.update(FRAME);
      for (const x of [a, b]) {
        if (x.status === 'reward') x.chooseReward(1);
        if (i % 97 === 0 && x.fish >= x.summonCost && x.emptyTiles().length) x.summon(); // RNG-driven actions too
      }
    }
    expect(state(b)).toBe(state(a));
  });

  it('comes back paused, keeps team, stars, fish, summon cost progression and skills; no visual leftovers', () => {
    const a = busy();
    const b = Battle.restore(a.stage, a.map, a.snapshot())!;
    expect(b.status).toBe('paused');
    expect(b.running).toBe(false);
    b.update(1);
    expect(b.time).toBe(a.time); // nothing moves until Resume
    expect(b.roster).toEqual(a.roster);
    expect(b.stars).toEqual(a.stars);
    expect(b.fish).toBe(a.fish);
    expect(b.summonCost).toBe(a.summonCost);
    expect(b.skillCost).toBe(a.skillCost);
    expect(b.skills).toEqual(a.skills);
    expect(b.mods).toEqual(a.mods);
    expect(b.effects).toEqual([]);
    expect(b.drainEvents()).toEqual([]);
    expect(b.cats.map((c) => [c.type, c.level, c.tileId])).toEqual(a.cats.map((c) => [c.type, c.level, c.tileId]));
    b.resume();
    b.update(FRAME);
    expect(b.time).toBeGreaterThan(a.time);
  });

  it('restores the preparation phase and a pending chest reward choice', () => {
    const st = ch1.stages[4];
    const p = new Battle(st, MAPS[ch1.mapId], 3);
    p.placeCat('kitten', 2, p.emptyTiles()[0].id);
    p.tickPrep(0.25);
    const rp = Battle.restore(st, p.map, p.snapshot())!;
    expect(rp.preparing).toBe(true);
    expect(rp.prepRemaining).toBeCloseTo(p.prepRemaining, 6);
    expect(rp.cats.length).toBe(1);
    // A chest reward waiting for a choice survives, and can only be chosen once.
    const a = busy(7);
    let guard = 0;
    while (a.status !== 'reward' && guard++ < 60 * 300) {
      a.update(FRAME);
      for (const f of a.foes) if (f.kind === 'chest') f.hp = Math.min(f.hp, 1);
    }
    if (a.status === 'reward') {
      const r = Battle.restore(a.stage, a.map, a.snapshot())!;
      expect(r.status).toBe('reward');
      expect(r.currentReward).toEqual(a.currentReward);
      expect(r.chooseReward(0).ok).toBe(true);
      expect(r.chooseReward(0).ok).toBe(r.rewardQueue.length > 0);
    }
  });

  it('never restores a finished battle and rejects corrupted or mismatched data', () => {
    const a = busy();
    const good = a.snapshot();
    expect(validateSnapshot(good, a.stage, a.map)).toBe(true);
    const bad = (f: (s: ReturnType<Battle['snapshot']>) => void) => {
      const s = JSON.parse(JSON.stringify(good));
      f(s);
      return Battle.restore(a.stage, a.map, s);
    };
    expect(bad((s) => (s.state.status = 'victory'))).toBeNull();
    expect(bad((s) => (s.state.status = 'defeat'))).toBeNull();
    expect(bad((s) => ((s as { v: number }).v = SNAPSHOT_VERSION + 1))).toBeNull();
    expect(bad((s) => (s.stageId = '1-1'))).toBeNull();
    expect(bad((s) => (s.waves = 99))).toBeNull();
    expect(bad((s) => (s.state.fish = null))).toBeNull();
    expect(bad((s) => (s.state.baseHp = 0))).toBeNull();
    expect(bad((s) => (s.state.waveIndex = 99))).toBeNull();
    expect(bad((s) => ((s.state.cats as { tileId: string }[])[1].tileId = (s.state.cats as { tileId: string }[])[0].tileId))).toBeNull(); // two cats on one tile
    expect(bad((s) => ((s.state.cats as { level: number }[])[0].level = 9))).toBeNull();
    expect(bad((s) => ((s.state.cats as { type: string }[])[0].type = 'dragon'))).toBeNull();
    expect(bad((s) => ((s.state.foes as { hp: unknown }[])[0].hp = null))).toBeNull();
    expect(bad((s) => (s.state.nextUid = 1))).toBeNull(); // would duplicate ids
    expect(bad((s) => delete s.state.spawnQueue)).toBeNull();
    expect(Battle.restore(a.stage, a.map, 'garbage')).toBeNull();
    expect(Battle.restore(a.stage, a.map, null)).toBeNull();
    // Another stage's snapshot doesn't fit this one.
    expect(Battle.restore(ch1.stages[0], MAPS[ch1.mapId], good)).toBeNull();
  });

  it('restoring never duplicates enemies or remaining spawns', () => {
    const a = busy();
    const b = Battle.restore(a.stage, a.map, a.snapshot(), false)!;
    const ids = (x: Battle) => x.foes.map((f) => f.uid);
    expect(ids(b)).toEqual(ids(a));
    expect(new Set(ids(b)).size).toBe(ids(b).length);
    // Run both to the end of the stage: identical totals.
    for (let i = 0; i < 60 * 600 && (a.status === 'playing' || a.status === 'reward'); i++) {
      for (const x of [a, b]) {
        x.update(FRAME * 2);
        if (x.status === 'reward') x.chooseReward(0);
      }
    }
    expect(b.status).toBe(a.status);
    expect(b.stats.kills + b.stats.escaped).toBe(a.stats.kills + a.stats.escaped);
    expect(b.stats.chestsOpened).toBe(a.stats.chestsOpened);
  });
});

describe('recovery store', () => {
  const record = (b: Battle, runId = 'run-1'): RecoveryRecord => ({
    version: RECOVERY_VERSION,
    runId,
    owner: 'tab-1',
    stageId: b.stage.id,
    savedAt: 1,
    speed: 1,
    wave: b.waveIndex + 1,
    totalWaves: b.totalWaves,
    baseHp: b.baseHp,
    maxHp: b.maxBaseHp,
    preparing: b.preparing,
    snapshot: b.snapshot(),
  });

  it('saves, loads, and clears only the matching run', () => {
    mem();
    const b = busy();
    expect(recovery.save(record(b))).toBe(true);
    const r = recovery.load()!;
    expect(r.runId).toBe('run-1');
    expect(Battle.restore(b.stage, b.map, r.snapshot)).not.toBeNull();
    recovery.clear('other-run');
    expect(recovery.load()).not.toBeNull();
    recovery.clear('run-1');
    expect(recovery.load()).toBeNull();
  });

  it('discards corrupted, outdated and finished records instead of offering them', () => {
    const store = mem();
    const b = busy();
    store['catdefense.battle.v1'] = '{not json';
    expect(recovery.load()).toBeNull();
    expect(store['catdefense.battle.v1']).toBeUndefined();
    recovery.save({ ...record(b), version: 0 as 1 });
    expect(recovery.load()).toBeNull();
    recovery.save({ ...record(b), stageId: '9-9' });
    expect(recovery.load()).toBeNull();
    recovery.save(record(b, 'won-already'));
    recovery.markFinished('won-already');
    expect(recovery.isFinished('won-already')).toBe(true);
    expect(recovery.load()).toBeNull(); // a finished run can never be resumed for a second reward
  });

  it('the finished-run ledger is bounded', () => {
    mem();
    for (let i = 0; i < 100; i++) recovery.markFinished(`r${i}`);
    expect(recovery.finished().length).toBe(40);
    expect(recovery.isFinished('r99')).toBe(true);
    expect(recovery.isFinished('r0')).toBe(false);
  });

  it('a snapshot is small enough for localStorage', () => {
    const b = busy();
    expect(JSON.stringify(b.snapshot()).length).toBeLessThan(200_000);
  });
});
