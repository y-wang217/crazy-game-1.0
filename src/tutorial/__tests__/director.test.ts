import { CHAPTERS } from '../../config/chapters';
import { MAPS } from '../../config/maps';
import { Battle } from '../../game/battle';
import { TutorialDirector, type SeenStore } from '../director';

const map = MAPS.forest;
const stage = (n: number) => CHAPTERS[0].stages[n - 1];

function memSeen(initial: string[] = []): SeenStore & { ids: Set<string> } {
  const ids = new Set(initial);
  return { ids, has: (id) => ids.has(id), mark: (id) => void ids.add(id) };
}

/** Advance one "frame": director decides, battle runs if not frozen. */
function frame(d: TutorialDirector, b: Battle, dt = 0.1) {
  const s = d.update(b);
  if (b.running) b.update(dt);
  return s;
}

describe('tutorial director', () => {
  it('stage 1: welcome → summon (interactive) → cat intro → lessons, battle frozen meanwhile', () => {
    const seen = memSeen();
    const b = new Battle(stage(1), map, 3);
    const d = new TutorialDirector('1-1', seen);

    let s = frame(d, b);
    expect(s?.id).toBe('tut:welcome');
    expect(b.frozen).toBe(true);
    expect(d.allows('summon')).toBe(false); // passive: only Continue
    b.update(10);
    expect(b.time).toBe(0); // frozen: nothing advanced
    d.complete(b);

    s = frame(d, b);
    expect(s?.id).toBe('tut:summon');
    expect(s?.expect).toBe('summon');
    expect(d.allows('summon')).toBe(true);
    expect(d.allows('tap')).toBe(false);
    expect(b.time).toBe(0);
    expect(b.summon().ok).toBe(true);
    d.onAction('summon', b);
    expect(d.active).toBeNull();

    // First summon of a species → its introduction, once.
    s = frame(d, b);
    expect(s?.panel.kind).toBe('cat');
    const catId = s!.id;
    expect(catId).toMatch(/^cat:(kitten|tabby)$/);
    d.complete(b);
    expect(seen.has(catId)).toBe(true);

    s = frame(d, b);
    expect(s?.id).toBe('tut:autoAttack');
    d.complete(b);

    s = frame(d, b);
    expect(s?.id).toBe('tut:target');
    expect(s?.pointer?.type).toBe('tap');
    // wrong action is rejected; tapping completes it
    expect(d.allows('moved')).toBe(false);
    b.cycleTarget(b.cats[0].uid);
    d.onAction('tap', b);

    s = frame(d, b);
    expect(s?.id).toBe('tut:modes');
    d.complete(b);
    s = frame(d, b);
    expect(s?.id).toBe('tut:ready');
    d.complete(b);

    // Lessons done → battle runs.
    s = frame(d, b);
    expect(s).toBeNull();
    expect(b.frozen).toBe(false);
    expect(b.time).toBeGreaterThan(0);
  });

  it('the first mouse gets an introduction, and the battle pauses for it', () => {
    const seen = memSeen(['tut:welcome', 'tut:summon', 'tut:autoAttack', 'tut:target', 'tut:modes', 'tut:ready', 'cat:kitten', 'cat:tabby']);
    const b = new Battle(stage(1), map, 3);
    const d = new TutorialDirector('1-1', seen);
    let s = null;
    for (let i = 0; i < 500 && !s; i++) s = frame(d, b);
    expect(s?.id).toBe('enemy:normal');
    expect(s?.focus[0].kind).toBe('foe');
    const dist = b.foes.map((f) => f.dist);
    frame(d, b, 1);
    expect(b.foes.map((f) => f.dist)).toEqual(dist);
    d.complete(b);
    frame(d, b, 1);
    expect(b.foes[0].dist).toBeGreaterThan(dist[0]);
  });

  it('cat introductions never repeat across stages', () => {
    const seen = memSeen();
    const b1 = new Battle(stage(1), map, 3);
    const d1 = new TutorialDirector('1-1', seen);
    b1.fish = 999;
    // Clear everything stage 1 shows, summoning plenty of cats.
    for (let i = 0; i < 400; i++) {
      const s = d1.update(b1);
      if (s && !s.expect) d1.complete(b1);
      else if (s?.expect === 'summon') {
        b1.summon();
        d1.onAction('summon', b1);
      } else if (s?.expect === 'tap') {
        b1.cycleTarget(b1.cats[0].uid);
        d1.onAction('tap', b1);
      } else if (b1.emptyTiles().length) b1.summon();
      if (b1.running) b1.update(0.1);
    }
    expect(seen.has('cat:kitten')).toBe(true);
    expect(seen.has('cat:tabby')).toBe(true);

    // Stage 2 starts with kittens and a tabby: no cat intros, straight to the move lesson.
    const b2 = new Battle(stage(2), map, 4);
    const d2 = new TutorialDirector('1-2', seen);
    const s = d2.update(b2);
    expect(s?.id).toBe('tut:move');
  });

  it('stage 2: move, swap and merge lessons require those exact actions', () => {
    const seen = memSeen(['cat:kitten', 'cat:tabby']);
    const b = new Battle(stage(2), map, 4);
    const d = new TutorialDirector('1-2', seen);

    let s = d.update(b)!;
    expect(s.id).toBe('tut:move');
    expect(s.pointer?.type).toBe('drag');
    expect(d.allows('swapped')).toBe(false);
    expect(d.allows('merged')).toBe(false);
    const ptr = s.pointer as { from: { uid: number }; to: { id: string } };
    expect(b.dropCat(ptr.from.uid, ptr.to.id).result).toBe('moved');
    d.onAction('moved', b);

    s = d.update(b)!;
    expect(s.id).toBe('tut:swap');
    const sp = s.pointer as { from: { uid: number }; to: { uid: number } };
    const target = b.catByUid(sp.to.uid)!;
    expect(b.dropCat(sp.from.uid, target.tileId).result).toBe('swapped');
    d.onAction('swapped', b);

    s = d.update(b)!;
    expect(s.id).toBe('tut:merge');
    const mp = s.pointer as { from: { uid: number }; to: { uid: number } };
    const into = b.catByUid(mp.to.uid)!;
    expect(b.dropCat(mp.from.uid, into.tileId).result).toBe('merged');
    expect(into.level).toBe(2);
    d.onAction('merged', b);

    s = d.update(b)!;
    expect(s.id).toBe('tut:mergeInfo');
    d.complete(b);
    expect(d.update(b)).toBeNull();
  });

  it('merge lesson guarantees a compatible pair even if the player merged early', () => {
    const seen = memSeen(['cat:kitten', 'cat:tabby', 'tut:move', 'tut:swap']);
    const b = new Battle(stage(2), map, 4);
    const ks = b.cats.filter((c) => c.type === 'kitten');
    b.dropCat(ks[0].uid, ks[1].tileId); // no Lv.1 pair left
    const d = new TutorialDirector('1-2', seen);
    const s = d.update(b)!;
    expect(s.id).toBe('tut:merge');
    expect(b.cats.filter((c) => c.type === 'kitten' && c.level === 1).length).toBeGreaterThanOrEqual(2);
  });

  it('stage 5 skill lesson waits for wave 2 and pays for the first skill', () => {
    const seen = memSeen(['cat:kitten', 'cat:tabby', 'cat:orange', 'cat:black', 'enemy:normal', 'enemy:fast', 'chest:bronze', 'chest:silver']);
    const b = new Battle(stage(5), map, 9);
    const d = new TutorialDirector('1-5', seen);
    b.fish = 0;
    let s = null;
    for (let i = 0; i < 3000 && !s; i++) {
      s = d.update(b);
      if (s && s.id.startsWith('cat:')) {
        d.complete(b);
        s = null;
      }
      if (b.running) b.update(0.05);
      if (b.status === 'reward') b.chooseReward(0);
    }
    expect(s?.id).toBe('tut:skillShop');
    expect(b.waveIndex).toBeGreaterThanOrEqual(1);
    expect(b.fish).toBeGreaterThanOrEqual(b.skillCost);
    expect(b.buySkill().ok).toBe(true);
    d.onAction('skill', b);
    expect(d.update(b)?.id).toBe('tut:skillDup');
  });

  it('does not start lessons during a chest reward or after the battle ends', () => {
    const b = new Battle(stage(1), map, 3);
    const d = new TutorialDirector('1-1', memSeen());
    b.status = 'reward';
    expect(d.update(b)).toBeNull();
    b.status = 'victory';
    expect(d.update(b)).toBeNull();
  });
});
