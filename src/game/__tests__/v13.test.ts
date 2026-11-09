import { BALANCE, summonCost } from '../../config/balance';
import { CHAPTERS } from '../../config/chapters';
import { CHESTS } from '../../config/enemies';
import { MAPS } from '../../config/maps';
import { en } from '../../i18n/en';
import { zh } from '../../i18n/zh';
import { Battle } from '../battle';
import { rewardSummary } from '../progression';

const map = MAPS[CHAPTERS[0].mapId];
const stage = (n: number) => CHAPTERS[0].stages[n - 1];

describe('V1.3 summoning economy', () => {
  it('tiered cost: three summons per price step, read from config', () => {
    const costs = Array.from({ length: 12 }, (_, i) => summonCost(i));
    expect(costs).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4]);
    const s = BALANCE.summon as { tierSize: number; perTier: number }; // config is readonly; tests tweak a copy-safe field
    const saved = { ...s };
    try {
      s.tierSize = 2;
      s.perTier = 2;
      expect([0, 1, 2, 3, 4].map((n) => summonCost(n))).toEqual([1, 1, 3, 3, 5]);
    } finally {
      Object.assign(s, saved);
    }
  });

  it('the battle charges the tiered price and resets each stage', () => {
    const b = new Battle(stage(3), map, 1);
    b.fish = 999;
    const paid: number[] = [];
    for (let i = 0; i < 7; i++) {
      const before = b.fish;
      expect(b.summon().ok).toBe(true);
      paid.push(before - b.fish);
    }
    expect(paid).toEqual([1, 1, 1, 2, 2, 2, 3]);
    expect(new Battle(stage(4), map, 1).summonCost).toBe(1);
  });
});

describe('V1.3 preparation phase', () => {
  it('every stage starts in a 20 s preparation with no enemies', () => {
    expect(BALANCE.prepSeconds).toBe(20);
    for (const s of CHAPTERS[0].stages) {
      const b = new Battle(s, map, 1);
      expect(b.preparing).toBe(true);
      expect(b.running).toBe(false);
      expect(b.prepRemaining).toBe(20);
      expect(b.waveIndex).toBe(-1);
      expect(b.foes.length).toBe(0);
    }
  });

  it('players can summon, move and merge during preparation', () => {
    const b = new Battle(stage(1), map, 2);
    b.fish = 50;
    expect(b.summon().ok).toBe(true);
    expect(b.summon().ok).toBe(true);
    const c = b.cats[0];
    const dest = b.emptyTiles()[0];
    expect(b.dropCat(c.uid, dest.id).result).toBe('moved');
  });

  it('counts down in real seconds and auto-starts at 0', () => {
    const b = new Battle(stage(2), map, 1);
    for (let i = 0; i < 19 * 4; i++) b.tickPrep(0.25);
    expect(b.preparing).toBe(true);
    expect(b.prepRemaining).toBeCloseTo(1, 5);
    for (let i = 0; i < 4; i++) b.tickPrep(0.25);
    expect(b.preparing).toBe(false);
    expect(b.waveIndex).toBe(0);
    expect(b.running).toBe(true);
  });

  it('a huge frame (tab switch) cannot skip the countdown', () => {
    const b = new Battle(stage(2), map, 1);
    b.tickPrep(60);
    expect(b.preparing).toBe(true);
    expect(b.prepRemaining).toBeGreaterThan(19);
  });

  it('game speed does not speed up preparation (sim updates never touch it)', () => {
    const b = new Battle(stage(2), map, 1);
    b.update(10 * BALANCE.speed.baseline * 2);
    expect(b.prepRemaining).toBe(20);
    expect(b.waveIndex).toBe(-1);
    expect(b.time).toBe(0);
  });

  it('pauses while a tutorial/modal freezes the battle', () => {
    const b = new Battle(stage(2), map, 1);
    b.frozen = true;
    for (let i = 0; i < 200; i++) b.tickPrep(0.25);
    expect(b.prepRemaining).toBe(20);
    b.frozen = false;
    b.tickPrep(0.25);
    expect(b.prepRemaining).toBeCloseTo(19.75, 5);
  });

  it('Start Battle begins combat exactly once', () => {
    const b = new Battle(stage(2), map, 1);
    expect(b.startBattle()).toBe(true);
    expect(b.waveIndex).toBe(0);
    expect(b.startBattle()).toBe(false);
    b.tickPrep(30); // a late countdown tick is ignored too
    expect(b.waveIndex).toBe(0);
    b.update(3);
    const wave = b.waveIndex;
    expect(b.startBattle()).toBe(false);
    expect(b.waveIndex).toBe(wave);
  });
});

describe('V1.3 speed system', () => {
  it('five options (0.5× added); 1× is the V1.3 1.2× pace slowed by 10% (pacing update)', () => {
    expect(BALANCE.speed.options).toEqual([0.5, 0.75, 1, 1.5, 2]);
    expect(BALANCE.speed.default).toBe(1);
    expect(BALANCE.speed.baseline).toBeCloseTo(1.2 * 0.9, 10);
  });

  it('the whole simulation scales with speed (2× reaches the same state in half the frames)', () => {
    const run = (speed: number, frames: number) => {
      const b = new Battle(stage(3), map, 5);
      b.startBattle();
      for (let i = 0; i < frames; i++) b.update((1 / 60) * BALANCE.speed.baseline * speed);
      return { t: b.time, d: b.foes.map((f) => f.dist), n: b.foes.length };
    };
    const slow = run(1, 600);
    const fast = run(2, 300);
    const half = run(0.5, 1200); // 0.5× needs twice the frames for the same battle state
    expect(half.t).toBeCloseTo(slow.t, 5);
    expect(half.n).toBe(slow.n);
    expect(fast.t).toBeCloseTo(slow.t, 5);
    expect(fast.n).toBe(slow.n);
    fast.d.forEach((d, i) => expect(Math.abs(d - slow.d[i])).toBeLessThan(1));
  });
});

describe('V1.3 board and chests', () => {
  it('stage 1-3 opens noticeably more tiles, and tiles never shrink', () => {
    const counts = CHAPTERS[0].stages.map((s) => s.tiles.length);
    expect(counts[2]).toBeGreaterThanOrEqual(counts[1] + 3);
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]);
  });

  it('heavier chests are slower; bronze is easy', () => {
    const { bronze, silver, gold } = CHESTS;
    expect(bronze.hp).toBeLessThan(silver.hp);
    expect(silver.hp).toBeLessThan(gold.hp);
    expect(bronze.speed).toBeGreaterThan(silver.speed);
    expect(silver.speed).toBeGreaterThan(gold.speed);
  });

  it('chest HP does not ride the per-wave enemy HP ramp', () => {
    const b = new Battle(stage(6), map, 1);
    b.startBattle();
    const early = b.spawn({ chest: 'silver' }).maxHp;
    b.waveIndex = 8;
    const late = b.spawn({ chest: 'silver' }).maxHp;
    expect(late).toBe(early);
    const mouseEarly = (() => {
      const x = new Battle(stage(6), map, 1);
      x.startBattle();
      return x.spawn({ enemy: 'normal', count: 1, interval: 1 }).maxHp;
    })();
    const mouseLate = (() => {
      const x = new Battle(stage(6), map, 1);
      x.startBattle();
      x.waveIndex = 8;
      return x.spawn({ enemy: 'normal', count: 1, interval: 1 }).maxHp;
    })();
    expect(mouseLate).toBeGreaterThan(mouseEarly);
  });

  it("Orange's slam no longer shakes the screen", () => {
    const b = new Battle(stage(3), map, 1);
    b.startBattle();
    b.placeCat('orange', 3, '2-2');
    for (let i = 0; i < 1500 && b.stats.slamHits === 0; i++) b.update(0.05);
    expect(b.stats.slamHits).toBeGreaterThan(0);
    expect(b.effects.some((e) => e.kind === 'shake')).toBe(false);
  });
});

describe('V1.3 victory rewards', () => {
  it('lists first clear + chests and sums them', () => {
    const r = rewardSummary({ victory: true, coins: 40, firstClear: true, chestCoins: 12 });
    expect(r.lines).toEqual([
      { key: 'firstClear', amount: 40 },
      { key: 'chests', amount: 12 },
    ]);
    expect(r.total).toBe(52);
  });
  it('replays show the replay reward; defeats keep chest coins only', () => {
    expect(rewardSummary({ victory: true, coins: 10, firstClear: false, chestCoins: 0 })).toEqual({ lines: [{ key: 'stageReward', amount: 10 }], total: 10 });
    expect(rewardSummary({ victory: false, coins: 0, firstClear: false, chestCoins: 7 })).toEqual({ lines: [{ key: 'chests', amount: 7 }], total: 7 });
  });
});

describe('V1.3 copy', () => {
  it('has Start Battle and Return Home in both languages', () => {
    expect(en['battle.start']).toBe('Start Battle');
    expect(zh['battle.start']).toBe('開始戰鬥');
    expect(zh['result.home']).toBe('返回主頁');
    expect(zh['result.next']).toBe('下一關');
    expect(zh['result.replay']).toBe('再玩一次');
    expect(zh['tut.speed.body']).toBe('覺得老鼠行得太慢？試吓調整遊戲速度！');
    expect(zh['tut.summon.body']).toBe('召喚貓咪好平㗎！快啲試吓！');
  });
  it('tutorial text is short and skips small details like cost increments', () => {
    for (const dict of [en, zh]) {
      for (const [k, v] of Object.entries(dict)) {
        if (!k.startsWith('tut.') || !k.endsWith('.body')) continue;
        expect(v.length, k).toBeLessThanOrEqual(dict === en ? 90 : 40);
        expect(v).not.toMatch(/1 more|多 1|cost/i);
      }
    }
  });
});
