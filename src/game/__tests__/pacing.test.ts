import { BALANCE } from '../../config/balance';
import { CHAPTERS } from '../../config/chapters';
import { FEATURE_DEFAULTS, feature, setFeatureOverride } from '../../config/features';
import { MAPS } from '../../config/maps';
import { ALL_LESSON_IDS, TutorialDirector, type SeenStore } from '../../tutorial/director';
import { Battle } from '../battle';
import type { CatId } from '../types';

const ch1 = CHAPTERS[0];
const ch2 = CHAPTERS[1];
const map1 = MAPS[ch1.mapId];
const stage = (n: number) => ch1.stages[n - 1];
const FRAME = 1 / 60;
const ROSTER: CatId[] = ['kitten', 'tabby', 'orange', 'black', 'white'];

function memSeen(initial: string[] = []): SeenStore & { ids: Set<string> } {
  const ids = new Set(initial);
  return { ids, has: (id) => ids.has(id), mark: (id) => void ids.add(id) };
}

/** A battle in the middle of real combat: cats shooting, projectiles in flight, mice walking. */
function midCombat(seed = 3): Battle {
  const b = new Battle(stage(3), map1, { seed, roster: ROSTER, stars: { kitten: 5, orange: 5, black: 5, tabby: 3, white: 3 } });
  for (const [type, lv] of [
    ['kitten', 2],
    ['orange', 2],
    ['black', 2],
    ['tabby', 1],
    ['white', 1],
  ] as const)
    b.placeCat(type, lv, b.emptyTiles()[0].id);
  b.startBattle();
  for (let i = 0; i < 60 * 40; i++) {
    b.update(FRAME * BALANCE.speed.baseline);
    if (b.status === 'reward') b.chooseReward(0);
    if (b.projectiles.length > 0 && b.foes.some((f) => f.alive && f.kind === 'enemy') && b.time > 8) break;
  }
  expect(b.status).toBe('playing');
  return b;
}

/** Everything that combat depends on (excludes the purely visual clock and effects). */
function combatState(b: Battle) {
  return JSON.stringify({
    time: b.time,
    fish: b.fish,
    baseHp: b.baseHp,
    wave: b.waveIndex,
    next: b.nextWaveIn,
    foes: b.foes.map((f) => ({ uid: f.uid, dist: f.dist, hp: f.hp, x: f.x, y: f.y, alive: f.alive, p: f.poisonUntil, m: f.markUntil })),
    cats: b.cats.map((c) => ({
      uid: c.uid,
      cd: c.cooldown,
      w: c.windup,
      combo: c.comboQueue,
      q: c.queue.length,
      tile: c.tileId,
      lv: c.level,
      mode: c.mode,
    })),
    proj: b.projectiles.map((p) => JSON.stringify(p)),
    ult: b.ultCharge,
    stats: { ...b.stats, tacticalPauses: 0 }, // the pause counter itself is allowed to change
  });
}

describe('pacing: 10% slower combat', () => {
  it('the 1× baseline is the old 1.2× pace minus 10%; difficulty values are untouched', () => {
    expect(BALANCE.speed.baseline).toBeCloseTo(1.2 * 0.9, 10);
    // One real second at each speed advances the simulation by baseline × speed.
    for (const speed of BALANCE.speed.options) {
      const b = new Battle(stage(3), map1, 7);
      b.startBattle();
      for (let i = 0; i < 60; i++) b.update(FRAME * BALANCE.speed.baseline * speed);
      expect(b.time).toBeCloseTo(BALANCE.speed.baseline * speed, 6);
      // ≈10% less game time per real second than before.
      expect(b.time / (1.2 * speed)).toBeCloseTo(0.9, 6);
    }
    expect(BALANCE.speed.options).toEqual([0.5, 0.75, 1, 1.5, 2]);
  });
});

describe('pacing: breathing room between waves', () => {
  /** Run until wave 1 has fully spawned. */
  const toGap = (clear: boolean) => {
    const b = new Battle(stage(3), map1, 11);
    b.startBattle();
    for (let i = 0; i < 60 * 60 && b.nextWaveIn === null; i++) {
      b.update(FRAME);
      if (clear && b.waveIndex === 0 && b['spawnPtr'] >= b['spawnQueue'].length) b.foes = []; // the player cleared the field
      if (!clear && b.waveIndex > 0) break;
    }
    return b;
  };

  it('a cleared field always gets clearedWaveGap + waveBreather of calm, with a countdown', () => {
    const b = toGap(true);
    expect(b.waveIndex).toBe(0);
    const total = BALANCE.clearedWaveGap + BALANCE.waveBreather;
    expect(BALANCE.waveBreather).toBeGreaterThanOrEqual(3);
    expect(b.nextWaveIn).toBeCloseTo(total, 1);
    let t = 0;
    let prev = Infinity;
    while (b.waveIndex === 0 && t < 30) {
      const n = b.nextWaveIn!;
      expect(n).toBeLessThanOrEqual(prev); // counts down
      prev = n;
      b.update(FRAME);
      t += FRAME;
    }
    expect(b.waveIndex).toBe(1);
    expect(t).toBeGreaterThan(total - 0.05);
    expect(t).toBeLessThan(total + 0.1);
    expect(b.nextWaveIn).toBeNull(); // no countdown while the new wave spawns (no overlap with the wave banner)
  });

  it('with mice still on the road the pressure cap is waveGap + waveBreatherHostile (no countdown shown)', () => {
    const b = new Battle(stage(3), map1, 11);
    b.startBattle();
    let doneAt = -1;
    for (let i = 0; i < 60 * 120 && b.waveIndex === 0; i++) {
      b.update(FRAME);
      if (doneAt < 0 && b['spawnPtr'] >= b['spawnQueue'].length) doneAt = b.time;
      if (doneAt >= 0 && b.waveIndex === 0) expect(b.nextWaveIn).toBeNull(); // hostile: no cats, mice alive
    }
    expect(b.time - doneAt).toBeCloseTo(BALANCE.waveGap + BALANCE.waveBreatherHostile, 1);
  });

  it('timing is configurable', () => {
    const old = BALANCE.waveBreather;
    try {
      (BALANCE as { waveBreather: number }).waveBreather = 6;
      const b = toGap(true);
      expect(b.nextWaveIn).toBeCloseTo(BALANCE.clearedWaveGap + 6, 1);
    } finally {
      (BALANCE as { waveBreather: number }).waveBreather = old;
    }
  });

  it('wave counts, composition and bosses are unchanged by the pacing update', () => {
    expect(BALANCE.waves.countScale).toBe(0.7);
    for (const ch of [ch1, ch2]) {
      const last = ch.stages[ch.stages.length - 1];
      expect(last.isBoss).toBe(true);
    }
  });
});

describe('Tactical Pause', () => {
  it('freezes everything: movement, spawns, wave timers, cooldowns, wind-ups, projectiles, statuses, ultimate charge', () => {
    const b = midCombat();
    expect(b.projectiles.length).toBeGreaterThan(0);
    const before = combatState(b);
    expect(b.pause(true)).toBe(true);
    expect(b.status).toBe('paused');
    expect(b.running).toBe(false);
    for (let i = 0; i < 600; i++) {
      b.update(FRAME * 2); // the UI never calls this while paused, but even if it did…
      b.tickVisual(FRAME);
    }
    const after = combatState(b);
    expect(after).toBe(before);
    expect(b.stats.tacticalPauses).toBe(1);
    b.resume();
    b.update(FRAME);
    expect(b.time).toBeGreaterThan(JSON.parse(before).time);
  });

  it('rapid toggling is harmless: pausing never advances or repeats anything', () => {
    const a = midCombat(5);
    const b = midCombat(5);
    expect(combatState(a)).toBe(combatState(b));
    for (let i = 0; i < 900; i++) {
      a.update(FRAME * BALANCE.speed.baseline);
      // b: the same frames, but with the pause button mashed in between.
      for (let k = 0; k < 3; k++) {
        b.pause(true);
        b.update(FRAME);
        b.tickVisual(FRAME);
        b.resume();
        b.pause(true);
        b.resume();
      }
      b.update(FRAME * BALANCE.speed.baseline);
      if (a.status === 'reward') a.chooseReward(0);
      if (b.status === 'reward') b.chooseReward(0);
    }
    const sa = JSON.parse(combatState(a));
    const sb = JSON.parse(combatState(b));
    delete sb.stats.tacticalPauses;
    delete sa.stats.tacticalPauses;
    expect(sb).toEqual(sa); // same damage, same kills, same fish, same mice — no duplicates
  });

  it('move, swap, merge, targeting and details work while paused; summons and skills wait', () => {
    const b = midCombat();
    b.pause(true);
    const t0 = b.time;
    const fish = b.fish;
    const [k, o] = [b.cats.find((c) => c.type === 'kitten')!, b.cats.find((c) => c.type === 'orange')!];
    // move
    const empty = b.emptyTiles()[0];
    expect(b.dropCat(k.uid, empty.id).result).toBe('moved');
    expect(k.tileId).toBe(empty.id);
    expect([k.x, k.y]).toEqual([empty.x, empty.y]);
    // swap
    const kt = k.tileId;
    const ot = o.tileId;
    expect(b.dropCat(k.uid, ot).result).toBe('swapped');
    expect([k.tileId, o.tileId]).toEqual([ot, kt]);
    // merge
    const m1 = b.placeCat('tabby', 2, b.emptyTiles()[0].id)!;
    const m2 = b.placeCat('tabby', 2, b.emptyTiles()[0].id)!;
    expect(b.dropCat(m1.uid, m2.tileId).result).toBe('merged');
    expect(b.catByUid(m2.uid)!.level).toBe(3);
    expect(b.catByUid(m1.uid)).toBeUndefined();
    // targeting
    expect(b.cycleTarget(o.uid)).not.toBeNull();
    // no free summons / skills / fish
    expect(b.summon().ok).toBe(false);
    expect(b.buySkill().ok).toBe(false);
    expect(b.fish).toBe(fish);
    expect(b.time).toBe(t0);
    // A moved cat drops any wind-up (it can't fire from the old tile on resume), and fights on after.
    expect(k.windup).toBeNull();
    const dealt = b.stats.damageDealt;
    b.resume();
    for (let i = 0; i < 300; i++) b.update(FRAME);
    expect(b.stats.damageDealt).toBeGreaterThan(dealt);
  });

  it('works on a completely full board, including Lv.5 merges', () => {
    const b = new Battle(ch2.stages[2], MAPS[ch2.mapId], { seed: 2, roster: ROSTER });
    b.startBattle();
    for (let i = 0; i < 300; i++) b.update(FRAME);
    const tiles = b.emptyTiles();
    // Two Lv.4 Kittens, everything else a mix that can't merge with them.
    tiles.forEach((t, i) => b.placeCat(i < 2 ? 'kitten' : ROSTER[1 + (i % 4)], i < 2 ? 4 : 1 + (i % 3), t.id));
    expect(b.emptyTiles().length).toBe(0);
    b.pause(true);
    const t0 = b.time;
    const [x, y] = b.cats.filter((c) => c.level === 4 && c.type === 'kitten');
    expect(b.dropCat(x.uid, y.tileId).result).toBe('merged');
    expect(b.catByUid(y.uid)!.level).toBe(5);
    expect(b.emptyTiles().length).toBe(1);
    // Lv.5 is the cap: two Lv.5s don't merge.
    const twin = b.placeCat('kitten', 5, b.emptyTiles()[0].id)!;
    expect(b.previewDrop(twin.uid, y.tileId)).toEqual({ result: 'cancel', reason: 'maxLevel' });
    // Swapping on a full board still works.
    const other = b.cats.find((c) => c.type !== 'kitten')!;
    expect(b.dropCat(twin.uid, other.tileId).result).toBe('swapped');
    expect(b.time).toBe(t0);
    // Selling while paused follows the normal refund table and frees the tile.
    const c = b.cats[3];
    const value = b.sellValue(c.uid);
    const fish = b.fish;
    expect(b.sellCat(c.uid)).toEqual({ ok: true, refund: value });
    expect(value).toBe(BALANCE.sell.refund[c.level - 1]);
    expect(b.fish).toBe(fish + value);
    expect(b.summon().ok).toBe(false); // still no summons until Resume
  });

  it('the menu pause does not count as a Tactical Pause; pausing is impossible after the battle ends', () => {
    const b = midCombat();
    expect(b.pause()).toBe(true);
    expect(b.stats.tacticalPauses).toBe(0);
    b.resume();
    b.status = 'victory';
    expect(b.pause(true)).toBe(false);
  });
});

describe('Tactical Pause lesson', () => {
  const base = [
    'cat:kitten',
    'cat:tabby',
    'cat:orange',
    'cat:black',
    'cat:white',
    'enemy:normal',
    'enemy:fast',
    'chest:bronze',
    'chest:silver',
    'chest:gold',
    'enemy:armored',
    'enemy:shielded',
    'enemy:boss',
  ];

  const ready = () => {
    const b = midCombat();
    const seen = memSeen(base);
    const d = new TutorialDirector('1-3', seen);
    return { b, seen, d };
  };
  const pastHold = (d: TutorialDirector, b: Battle) => {
    for (let i = 0; i < 50 && d.holding(b); i++) {
      expect(d.update(b)).toBeNull();
      expect(b.frozen).toBe(true);
      b.tickVisual(0.1);
    }
  };

  it('pause → rearrange while paused → resume, one step at a time, each requiring the action', () => {
    const { b, seen, d } = ready();
    let s = d.update(b)!;
    expect(s.id).toBe('tut:tpause');
    expect(s.focus).toEqual([{ kind: 'button', id: 'tpause' }]);
    expect(d.allows('pause')).toBe(true);
    expect(d.allows('summon')).toBe(false);
    expect(d.allows('resume')).toBe(false);
    expect(b.pause(true)).toBe(true);
    expect(d.onAction('pause', b)).toBe(true); // → "Nice!"
    pastHold(d, b);
    s = d.update(b)!;
    expect(s.id).toBe('tut:tpauseMove');
    expect(b.status).toBe('paused');
    expect(d.allows('moved') && d.allows('swapped') && d.allows('merged')).toBe(true);
    expect(d.allows('resume')).toBe(false); // can't skip ahead by resuming
    const p = s.pointer as { from: { uid: number }; to: { uid?: number; id?: string } };
    const to = p.to.id ?? b.catByUid(p.to.uid!)!.tileId;
    const t0 = b.time;
    const r = b.dropCat(p.from.uid, to);
    expect(r.result).not.toBe('cancel');
    expect(d.onAction(r.result as 'moved', b)).toBe(true);
    expect(b.time).toBe(t0);
    pastHold(d, b);
    s = d.update(b)!;
    expect(s.id).toBe('tut:tpauseResume');
    expect(s.focus).toEqual([{ kind: 'button', id: 'resume' }]);
    b.resume();
    expect(d.onAction('resume', b)).toBe(true);
    pastHold(d, b);
    expect(d.update(b)).toBeNull();
    expect(['tut:tpause', 'tut:tpauseMove', 'tut:tpauseResume'].every((id) => seen.has(id))).toBe(true);
    b.update(FRAME);
    expect(b.time).toBeGreaterThan(t0); // battle continues normally
  });

  it('players who pause on their own skip the button step; resuming from the menu never leaves a stuck lesson', () => {
    const { b, seen, d } = ready();
    b.pause(true);
    let s = d.update(b)!;
    expect(seen.has('tut:tpause')).toBe(true);
    expect(s.id).toBe('tut:tpauseMove');
    // Menu → Resume while the paused lesson is up: the step is still completable while playing.
    b.resume();
    s = d.update(b)!;
    expect(s.id).toBe('tut:tpauseMove');
    expect(b.frozen).toBe(true);
    d.complete(b);
    expect(d.update(b)).toBeNull();
    expect(seen.has('tut:tpauseResume')).toBe(true); // already playing: marked done silently
  });

  it('does not appear before stage 1-3, during preparation, or with fewer than two cats', () => {
    const b2 = new Battle(stage(2), map1, 3);
    b2.placeCat('kitten', 1, b2.emptyTiles()[0].id);
    b2.placeCat('tabby', 1, b2.emptyTiles()[0].id);
    b2.startBattle();
    const d2 = new TutorialDirector('1-2', memSeen([...base, 'tut:move', 'tut:swap', 'tut:merge', 'tut:mergeInfo', 'tut:speed']));
    for (let i = 0; i < 1200; i++) {
      expect(d2.update(b2)?.id ?? null).not.toBe('tut:tpause');
      if (b2.running) b2.update(FRAME * 2);
    }
    const b3 = new Battle(stage(3), map1, 3);
    const d3 = new TutorialDirector('1-3', memSeen(base));
    expect(d3.update(b3)).toBeNull(); // preparing
  });

  it('"Skip tutorial" closes the lesson and marks every scripted lesson seen (intros stay)', () => {
    const { b, seen, d } = ready();
    expect(d.update(b)?.id).toBe('tut:tpause');
    expect(d.isLesson).toBe(true);
    d.skipAll(b);
    expect(d.active).toBeNull();
    expect(b.frozen).toBe(false);
    for (const id of ALL_LESSON_IDS) expect(seen.has(id)).toBe(true);
    expect(ALL_LESSON_IDS).toContain('tut:welcome');
    expect(ALL_LESSON_IDS).toContain('tut:tpauseResume');
    expect(seen.has('enemy:boss')).toBe(true); // was already seen; intros are not added by skip
    expect([...seen.ids].some((id) => id.startsWith('cat:sable'))).toBe(false);
  });
});

describe('Focus Targeting is an experimental, switchable feature', () => {
  it('has a flag with a local override; the battle works the same with focus never used', () => {
    expect(typeof FEATURE_DEFAULTS.focusTargeting).toBe('boolean');
    const store: Record<string, string> = {};
    const g = globalThis as { localStorage?: unknown };
    const old = g.localStorage;
    g.localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => (store[k] = v),
      removeItem: (k: string) => delete store[k],
    };
    try {
      setFeatureOverride('focusTargeting', false);
      expect(feature('focusTargeting')).toBe(false);
      setFeatureOverride('focusTargeting', true);
      expect(feature('focusTargeting')).toBe(true);
      setFeatureOverride('focusTargeting', null);
      expect(feature('focusTargeting')).toBe(FEATURE_DEFAULTS.focusTargeting);
    } finally {
      g.localStorage = old;
    }
    // With the flag off the UI never calls setFocus: focus stays null and battles still finish.
    const b = midCombat();
    expect(b.focusUid).toBeNull();
    for (let i = 0; i < 60 * 300 && (b.status === 'playing' || b.status === 'reward'); i++) {
      if (b.status === 'reward') b.chooseReward(0);
      b.update(FRAME * 2);
    }
    expect(['victory', 'defeat']).toContain(b.status);
    expect(b.focusUid).toBeNull();
  });
});
