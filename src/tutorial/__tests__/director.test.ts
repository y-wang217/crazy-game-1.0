import { CHAPTERS } from '../../config/chapters';
import { MAPS } from '../../config/maps';
import { Battle } from '../../game/battle';
import { TutorialDirector, type ActiveStep, type SeenStore } from '../director';

const map = MAPS[CHAPTERS[0].mapId];
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

/** Perform whatever the active lesson asks for, the way a player would. */
function perform(s: ActiveStep, d: TutorialDirector, b: Battle) {
  if (!s.expect) return d.complete(b);
  if (s.expect === 'summon') {
    b.summon();
    return d.onAction('summon', b);
  }
  if (s.expect === 'tap') {
    b.cycleTarget(b.cats[0].uid);
    return d.onAction('tap', b);
  }
  const p = s.pointer as { from: { uid: number }; to: { uid?: number; id?: string } };
  const to = p.to.id ?? b.catByUid(p.to.uid!)!.tileId;
  const r = b.dropCat(p.from.uid, to);
  expect(r.result).toBe(s.expect);
  d.onAction(r.result as 'moved', b);
}

const STAGE1_LESSONS = [
  'tut:welcome',
  'tut:summon',
  'tut:autoAttack',
  'tut:target',
  'tut:modes',
  'tut:summonMore',
  'tut:move',
  'tut:swap',
  'tut:merge',
  'tut:mergeInfo',
  'tut:ready',
];

describe('tutorial director', () => {
  it('stage 1 teaches summon, targeting, move, swap and merge — in order, one at a time', () => {
    const seen = memSeen();
    const b = new Battle(stage(1), map, 3);
    const d = new TutorialDirector('1-1', seen);
    const shown: string[] = [];
    for (let i = 0; i < 200; i++) {
      const s = frame(d, b);
      if (!s) break;
      expect(b.frozen).toBe(true);
      expect(b.time).toBe(0); // nothing advances during lessons
      if (shown[shown.length - 1] !== s.id) shown.push(s.id);
      perform(s, d, b);
    }
    const lessons = shown.filter((id) => id.startsWith('tut:'));
    expect(lessons).toEqual(STAGE1_LESSONS);
    // Cat intros happen exactly once per species met.
    const intros = shown.filter((id) => id.startsWith('cat:'));
    expect(new Set(intros).size).toBe(intros.length);
    expect(intros.length).toBeGreaterThanOrEqual(1);
    // After the lessons the battle runs.
    expect(b.frozen).toBe(false);
    frame(d, b);
    expect(b.time).toBeGreaterThan(0);
    // The merge lesson really merged something.
    expect(b.stats.merges).toBe(1);
    expect(b.cats.some((c) => c.level === 2)).toBe(true);
  });

  it('interactive lessons reject the wrong action', () => {
    const seen = memSeen(['tut:welcome', 'tut:summon', 'tut:autoAttack', 'tut:target', 'tut:modes', 'tut:summonMore', 'cat:kitten', 'cat:tabby']);
    const b = new Battle(stage(1), map, 4);
    b.fish = 99;
    b.summon();
    b.summon();
    b.summon();
    const d = new TutorialDirector('1-1', seen);
    const s = d.update(b)!;
    expect(s.id).toBe('tut:move');
    expect(d.allows('moved')).toBe(true);
    expect(d.allows('swapped')).toBe(false);
    expect(d.allows('merged')).toBe(false);
    expect(d.allows('tap')).toBe(false);
    expect(d.allows('summon')).toBe(false);
  });

  it('"summon more" waits until three cats are on the board', () => {
    const seen = memSeen(['tut:welcome', 'tut:summon', 'tut:autoAttack', 'tut:target', 'tut:modes', 'cat:kitten', 'cat:tabby']);
    const b = new Battle(stage(1), map, 5);
    b.summon();
    const d = new TutorialDirector('1-1', seen);
    expect(d.update(b)?.id).toBe('tut:summonMore');
    expect(b.summon().ok).toBe(true);
    d.onAction('summon', b);
    expect(d.active?.id).toBe('tut:summonMore'); // only 2 cats
    expect(b.summon().ok).toBe(true);
    d.onAction('summon', b);
    expect(d.active).toBeNull();
  });

  it('swap and merge lessons create the cats they need instead of relying on luck', () => {
    const seen = memSeen([...STAGE1_LESSONS.slice(0, 7), 'cat:kitten', 'cat:tabby']);
    const b = new Battle(stage(1), map, 6);
    b.placeCat('kitten', 1, b.emptyTiles()[0].id); // only one cat: no swap or merge possible
    const d = new TutorialDirector('1-1', seen);
    let s = d.update(b)!;
    expect(s.id).toBe('tut:swap');
    perform(s, d, b);
    s = d.update(b)!;
    expect(s.id).toBe('tut:merge');
    perform(s, d, b);
    expect(b.cats.some((c) => c.level === 2)).toBe(true);
  });

  it('a cat placed by a lesson setup is introduced before the lesson', () => {
    const seen = memSeen([...STAGE1_LESSONS.slice(0, 7), 'cat:kitten']); // never met Tabby
    const b = new Battle(stage(1), map, 6);
    b.placeCat('kitten', 1, b.emptyTiles()[0].id);
    const d = new TutorialDirector('1-1', seen);
    const s = d.update(b)!;
    expect(s.id).toBe('cat:tabby');
    d.complete(b);
    expect(d.update(b)?.id).toBe('tut:swap');
  });

  it('stage 2 does not repeat lessons for players who finished stage 1', () => {
    const seen = memSeen([...STAGE1_LESSONS, 'cat:kitten', 'cat:tabby', 'enemy:normal']);
    const b = new Battle(stage(2), map, 4);
    const d = new TutorialDirector('1-2', seen);
    b.fish = 99;
    for (let i = 0; i < 5; i++) b.summon();
    for (let i = 0; i < 300; i++) {
      expect(frame(d, b)).toBeNull();
    }
    expect(b.time).toBeGreaterThan(20);
  });

  it('returning V1.1 players (stage 1 done, no move lessons yet) get them in stage 2', () => {
    const seen = memSeen(['tut:welcome', 'tut:summon', 'tut:autoAttack', 'tut:target', 'tut:modes', 'tut:ready', 'cat:kitten', 'cat:tabby']);
    const b = new Battle(stage(2), map, 4);
    b.fish = 99;
    b.summon();
    b.summon();
    const d = new TutorialDirector('1-2', seen);
    expect(d.update(b)?.id).toBe('tut:move');
  });

  it('players who already learned moving skip the new "summon more" warm-up', () => {
    const seen = memSeen(['tut:welcome', 'tut:summon', 'tut:autoAttack', 'tut:target', 'tut:modes', 'tut:move', 'tut:swap', 'tut:merge', 'tut:mergeInfo', 'cat:kitten', 'cat:tabby']);
    const b = new Battle(stage(1), map, 4);
    const d = new TutorialDirector('1-1', seen);
    expect(d.update(b)?.id).toBe('tut:ready');
    expect(seen.has('tut:summonMore')).toBe(true);
  });

  it('the first mouse gets an introduction once it is visible, and the battle pauses for it', () => {
    const seen = memSeen([...STAGE1_LESSONS, 'cat:kitten', 'cat:tabby']);
    const b = new Battle(stage(1), map, 3);
    const d = new TutorialDirector('1-1', seen);
    let s = null;
    for (let i = 0; i < 500 && !s; i++) s = frame(d, b);
    expect(s?.id).toBe('enemy:normal');
    expect(b.foes[0].dist).toBeGreaterThanOrEqual(45);
    const dist = b.foes.map((f) => f.dist);
    frame(d, b, 1);
    expect(b.foes.map((f) => f.dist)).toEqual(dist);
    d.complete(b);
    frame(d, b, 1);
    expect(b.foes[0].dist).toBeGreaterThan(dist[0]);
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
