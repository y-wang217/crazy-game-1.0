import { CHAPTERS, stageMap } from '../../config/chapters';
import { CATS } from '../../config/cats';
import { ENEMIES } from '../../config/enemies';
import { Battle } from '../battle';
import type { StageDef } from '../types';

// V1.6.2 Chapter 2 challenge: tougher enemies without touching rewards, Chapter 1, chests or the
// Living Cat Food Can; bosses get half-HP phases only where a stage asks for one.
const find = (id: string) => CHAPTERS.flatMap((c) => c.stages).find((s) => s.id === id)!;
const plain = (s: StageDef): StageDef => ({ ...s, challenge: undefined });
const battle = (s: StageDef) => {
  const b = new Battle(s, stageMap(s), { seed: 1, sandbox: true });
  b.startBattle();
  b.clearFoes();
  return b;
};

describe('Chapter 2 challenge', () => {
  it('Chapter 1 is untouched; every Chapter 2 stage has a challenge', () => {
    for (const s of CHAPTERS[0].stages) expect(s.challenge, s.id).toBeUndefined();
    for (const s of CHAPTERS[1].stages) expect(s.challenge, s.id).toBeDefined();
    expect(CATS.white.slowStrength).toBe(0.45); // Noble White's base slow unchanged
  });

  it('raises HP / armor / speed but not the dried-fish reward', () => {
    const st = find('2-17');
    for (const id of ['normal', 'armored', 'brute', 'ironclad'] as const) {
      const hard = battle(st).spawn({ enemy: id, count: 1, interval: 1 });
      const base = battle(plain(st)).spawn({ enemy: id, count: 1, interval: 1 });
      expect(hard.maxHp, id).toBeGreaterThan(base.maxHp);
      expect(hard.speed, id).toBeGreaterThan(base.speed);
      expect(hard.reward, id).toBe(base.reward);
      if (ENEMIES[id].armor > 0) expect(hard.armor, id).toBe(base.armor + (st.challenge!.armor ?? 0));
    }
  });

  it('never changes chests or the Living Cat Food Can (fast, slow-immune, looping, same HP)', () => {
    for (const id of ['2-6', '2-9', '2-15', '2-18']) {
      const st = find(id);
      const can = battle(st).spawn({ enemy: 'canMonster', count: 1, interval: 1 });
      const ref = battle(plain(st)).spawn({ enemy: 'canMonster', count: 1, interval: 1 });
      expect([can.maxHp, can.speed, can.armor, can.reward]).toEqual([ref.maxHp, ref.speed, ref.armor, ref.reward]);
      expect(ENEMIES.canMonster.slowImmune && ENEMIES.canMonster.loops).toBe(true);
      const chest = battle(st).spawn({ chest: 'gold' });
      expect(chest.maxHp).toBe(battle(plain(st)).spawn({ chest: 'gold' }).maxHp);
    }
  });

  it('bosses enter a phase at half HP on 2-10 and 2-15 (not on 1-10), and 2-20 brings stronger guards', () => {
    const phase = (st: StageDef, boss: 'boss' | 'mushroomKing' | 'moonEmperor') => {
      const b = battle(st);
      const f = b.spawn({ enemy: boss, count: 1, interval: 1 });
      f.shield = 0;
      const before = b.foes.length;
      f.hp = f.maxHp * 0.5 + 1;
      (b as unknown as { hit: (f: unknown, dmg: number, show: boolean) => void }).hit(f, 50, false); // the phase starts on a hit
      return { phased: !!f.phased, guards: b.foes.filter((x) => x.alive).length - before, ids: b.foes.slice(before).map((x) => x.defId) };
    };
    expect(phase(find('1-10'), 'boss').phased).toBe(false);
    const cheese = phase(find('2-15'), 'boss');
    expect(cheese.phased && cheese.ids.filter((i) => i === 'thief').length).toBe(2);
    const king = phase(find('2-10'), 'mushroomKing');
    expect(king.phased && king.ids).toContain('ironclad');
    const emperor = phase(find('2-20'), 'moonEmperor');
    expect(emperor.phased && emperor.ids).toContain('captain');
  });
});
