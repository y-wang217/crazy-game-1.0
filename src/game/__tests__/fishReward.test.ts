import { BALANCE } from '../../config/balance';
import { CHAPTERS } from '../../config/chapters';
import { MAPS } from '../../config/maps';
import { Battle, isRegularEnemy } from '../battle';
import { ENEMIES } from '../../config/enemies';

// V1.6 dried-fish pass: regular mice pay ×regularFishMult with exact (carried) fractions;
// elites, bosses and the Living Cat Food Can are unchanged.
const ch1 = CHAPTERS[0];
const map = MAPS[ch1.mapId];
const fresh = (n = 1) => {
  const b = new Battle(ch1.stages[n - 1], map, 7);
  b.startBattle();
  b.clearFoes();
  return b;
};
type Killable = { kill(f: unknown): void };

describe('dried fish rewards', () => {
  it('regular / special enemies are told apart', () => {
    for (const id of ['normal', 'fast', 'armored', 'shielded'] as const) expect(isRegularEnemy(ENEMIES[id]), id).toBe(true);
    for (const id of ['brute', 'ironclad', 'thief', 'captain', 'boss', 'mushroomKing', 'moonEmperor', 'canMonster'] as const)
      expect(isRegularEnemy(ENEMIES[id]), id).toBe(false);
  });

  it('a regular mouse pays its exact reduced value over many kills (no rounding drift)', () => {
    const b = fresh(1);
    const mice = b.spawnLine('normal', 50, 100, 1);
    const each = mice[0].reward;
    const expected = ENEMIES.normal.reward * Math.pow(b.toughness(), BALANCE.rewardScaleExponent) * BALANCE.waves.fishMult * BALANCE.waves.regularFishMult;
    expect(each).toBeCloseTo(expected, 6);
    const before = b.fish;
    for (const m of mice) (b as unknown as Killable).kill(m);
    const got = b.fish - before;
    expect(Math.abs(got - each * 50)).toBeLessThan(1); // whole fish paid, < 1 fish carried
    expect(b.fishCarry).toBeGreaterThanOrEqual(0);
    expect(b.fishCarry).toBeLessThan(1);
  });

  it('elites keep their old (rounded, unreduced) reward', () => {
    const b = fresh(1);
    const [brute] = b.spawnLine('brute', 1, 100, 1);
    const old = Math.max(1, Math.round(ENEMIES.brute.reward * Math.pow(b.toughness(), BALANCE.rewardScaleExponent) * BALANCE.waves.fishMult));
    expect(brute.reward).toBe(old);
    const before = b.fish;
    (b as unknown as Killable).kill(brute);
    expect(b.fish - before).toBe(old);
  });

  it('the carried fraction survives a snapshot / restore', () => {
    const b = fresh(1);
    for (const m of b.spawnLine('normal', 3, 100, 1)) (b as unknown as Killable).kill(m);
    const snap = b.snapshot();
    const r = Battle.restore(ch1.stages[0], map, snap, false)!;
    expect(r.fishCarry).toBeCloseTo(b.fishCarry, 9);
    // Older snapshots without the field still restore (carry 0).
    delete (snap.state as Record<string, unknown>).fishCarry;
    expect(Battle.restore(ch1.stages[0], map, snap, false)!.fishCarry).toBe(0);
  });
});
