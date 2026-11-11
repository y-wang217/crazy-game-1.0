import { BALANCE, skillRollCost } from '../../config/balance';
import { ALL_STAGE_IDS, CHAPTERS } from '../../config/chapters';
import { MAPS } from '../../config/maps';
import { parseSave } from '../../save/store';
import { Battle } from '../battle';
import { chapterProgress, currentChapter } from '../progression';

const clearAll = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, 3]));
const ch1Ids = CHAPTERS[0].stages.map((s) => s.id);
const ch2Ids = CHAPTERS[1].stages.map((s) => s.id);

describe('Home chapter progress', () => {
  it('counts each chapter separately (never the combined total)', () => {
    // The reported bug: all of Chapter 1 + 10 of Chapter 2 showed "Chapter 1: 20/10".
    const cleared = clearAll([...ch1Ids, ...ch2Ids.slice(0, 10)]);
    const p = chapterProgress({ cleared, unlocked: [...ch1Ids, ...ch2Ids.slice(0, 11)] });
    expect(p.map((c) => [c.id, c.cleared, c.total, c.complete])).toEqual([
      ['ch1', 10, 10, true],
      ['ch2', 10, 20, false],
    ]);
    expect(currentChapter(p).id).toBe('ch2');
    for (const c of p) expect(c.cleared).toBeLessThanOrEqual(c.total);
  });

  it('totals come from the chapter data, not hardcoded numbers', () => {
    const p = chapterProgress({ cleared: {}, unlocked: [ALL_STAGE_IDS[0]] });
    expect(p.map((c) => c.total)).toEqual(CHAPTERS.map((c) => c.stages.length));
    expect(currentChapter(p)).toMatchObject({ id: 'ch1', cleared: 0, complete: false });
    expect(p[1].open).toBe(false);
  });

  it('works with real saved data (parseSave) and once every chapter is done', () => {
    const save = parseSave(JSON.stringify({ version: 3, cleared: { ...clearAll([...ch1Ids, ...ch2Ids]), 'x-9': 3 }, unlocked: ['1-1'] }));
    const p = chapterProgress(save);
    expect(p.every((c) => c.complete && c.cleared === c.total)).toBe(true);
    expect(currentChapter(p).id).toBe(CHAPTERS[CHAPTERS.length - 1].id);
    // Clearing 1-10 opens Chapter 2 even before any Chapter 2 stage is cleared.
    const mid = chapterProgress(parseSave(JSON.stringify({ version: 3, cleared: clearAll(ch1Ids), unlocked: ch1Ids })));
    expect(currentChapter(mid)).toMatchObject({ id: 'ch2', cleared: 0, total: 20 });
  });
});

describe('Random Skill price', () => {
  it('early purchases are unchanged, then the price keeps rising instead of stopping at 60', () => {
    const costs = Array.from({ length: 16 }, (_, i) => skillRollCost(i));
    expect(costs.slice(0, 8)).toEqual([20, 26, 32, 38, 44, 50, 56, 60]);
    for (let i = 1; i < costs.length; i++) expect(costs[i]).toBeGreaterThan(costs[i - 1]);
    expect(costs.slice(8, 12)).toEqual([70, 80, 90, 105]);
    expect(costs[15]).toBeGreaterThan(150);
    for (const c of costs) expect(c % BALANCE.skillRoll.roundTo === 0 || c < BALANCE.skillRoll.softCap).toBe(true);
  });

  it('is driven by the config', () => {
    const s = BALANCE.skillRoll as { growthAfterSoftCap: number };
    const before = s.growthAfterSoftCap;
    try {
      s.growthAfterSoftCap = 1;
      expect(skillRollCost(12)).toBe(BALANCE.skillRoll.softCap); // the old flat price, for comparison only
      s.growthAfterSoftCap = 1.3;
      expect(skillRollCost(9)).toBe(100); // 60 × 1.3² = 101.4 → 100
    } finally {
      s.growthAfterSoftCap = before;
    }
  });

  it('resets every stage; chest skills stay free', () => {
    const stage = CHAPTERS[0].stages[6];
    const map = MAPS[CHAPTERS[0].mapId];
    const b = new Battle(stage, map, { seed: 3, roster: ['kitten', 'tabby', 'orange', 'black', 'white'] });
    b.startBattle();
    b.fish = 5000;
    for (let i = 0; i < 10; i++) expect(b.buySkill().ok).toBe(true);
    expect(b.skillCost).toBe(skillRollCost(10));
    const fish = b.fish;
    // A chest reward never charges fish.
    const bb = b as unknown as { rewardQueue: { tier: string; choices: { skillId: string; levels: number }[] }[] };
    bb.rewardQueue.push({ tier: 'gold', choices: [{ skillId: 'sharpClaws', levels: 1 }] });
    b.status = 'reward';
    b.chooseReward(0);
    expect(b.fish).toBe(fish);
    expect(b.skillCost).toBe(skillRollCost(10)); // and doesn't raise the shop price
    // The next stage starts from the base price with no skills.
    const next = new Battle(CHAPTERS[0].stages[7], map, { seed: 3 });
    expect(next.skillCost).toBe(BALANCE.skillRoll.baseCost);
    expect(Object.values(next.skills).filter(Boolean)).toHaveLength(0);
  });
});
