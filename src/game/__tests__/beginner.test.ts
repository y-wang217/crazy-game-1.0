import { CHAPTERS } from '../../config/chapters';
import { MAPS } from '../../config/maps';
import { runBeginnerBot } from '../bot';
import type { CatId, EnemyId } from '../types';

// Beginner-stage guard rails (V1.4 balance fix). A first-time player: fresh save, only the
// original five cats at 1★, no skins, normal speed, slow reactions, random summons, merges
// only sometimes and never repositions. See runBeginnerBot in bot.ts.
const ch1 = CHAPTERS[0];
const map = MAPS[ch1.mapId];
const STARTERS: CatId[] = ['kitten', 'tabby', 'orange', 'black', 'white'];
const stage = (id: string) => ch1.stages.find((s) => s.id === id)!;
const wins = (id: string, n: number, struggling = false) => {
  const st = stage(id);
  let w = 0;
  for (let s = 1; s <= n; s++)
    if (runBeginnerBot(st, map, (struggling ? 1000 : 0) + s, { roster: st.fixedRoster ? undefined : STARTERS, struggling }).win) w++;
  return w;
};
const enemiesIn = (id: string) => new Set(stage(id).waves.flatMap((w) => w.groups.flatMap((g) => ('enemy' in g ? [g.enemy] : []))) as EnemyId[]);

describe('beginner stages', () => {
  it('Stage 1-1 (tutorial) is cleared by every beginner, even a struggling one', () => {
    expect(wins('1-1', 20)).toBe(20);
    expect(wins('1-1', 20, true)).toBe(20);
  });

  it('Stage 1-2 (practice) forgives imperfect play', () => {
    expect(wins('1-2', 20)).toBe(20);
    expect(wins('1-2', 20, true)).toBeGreaterThanOrEqual(18); // slow, rarely merges, still wins
  });

  it('Stage 1-3 is a manageable first challenge; 1-4 and 1-5 stay winnable for beginners', () => {
    expect(wins('1-3', 20)).toBeGreaterThanOrEqual(18);
    const s3 = wins('1-3', 20, true);
    expect(s3).toBeGreaterThan(0); // a challenge for weak play…
    expect(s3).toBeLessThan(20); // …but not a free win
    expect(wins('1-4', 20)).toBeGreaterThanOrEqual(17);
    expect(wins('1-5', 20)).toBeGreaterThanOrEqual(17);
  });

  it('no beginner difficulty cliff anywhere in Chapter 1', () => {
    for (const st of ch1.stages) expect(wins(st.id, 12), st.id).toBeGreaterThanOrEqual(9);
  });

  it('the first stages only use regular mice; fast and armored mice arrive gradually', () => {
    for (const id of ['1-1', '1-2', '1-3']) expect([...enemiesIn(id)]).toEqual(['normal']);
    // 1-4 introduces Zippy Mice mixed in (never an all-fast wave).
    for (const w of stage('1-4').waves) {
      const normal = w.groups.reduce((a, g) => a + ('enemy' in g && g.enemy === 'normal' ? g.count : 0), 0);
      const fast = w.groups.reduce((a, g) => a + ('enemy' in g && g.enemy === 'fast' ? g.count : 0), 0);
      expect(fast).toBeLessThanOrEqual(normal);
    }
    expect(enemiesIn('1-4').has('armored')).toBe(false);
    expect(enemiesIn('1-5').has('armored')).toBe(false);
  });

  it('the practice stage has room to recover: more tiles and fish than the tutorial', () => {
    expect(stage('1-2').tiles.length).toBeGreaterThan(stage('1-1').tiles.length);
    expect(stage('1-2').startFish).toBeGreaterThanOrEqual(stage('1-1').startFish);
    // Enemy toughness grows gently from the tutorial and doesn't jump.
    const hp = ch1.stages.slice(0, 6).map((s) => s.hpScale);
    expect(hp[1] / hp[0]).toBeLessThan(1.5);
    for (let i = 2; i < hp.length; i++) expect(hp[i] / hp[i - 1]).toBeLessThan(2.2);
  });
});
