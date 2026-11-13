import { describe, expect, it } from 'vitest';
import type { CatId } from '../../game/types';
import { pendingTutorials, tutorialBlocking, type GateSave } from '../gate';
import { rewindStep, TOURS } from '../tours';

const clearedUpTo = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, 3]));
const ch1 = (n: number) => Array.from({ length: n }, (_, i) => `1-${i + 1}`);
const starters: CatId[] = ['kitten', 'tabby', 'orange', 'black', 'white'];
const save = (over: Partial<GateSave> = {}): GateSave => ({
  cleared: {},
  tutorials: {},
  seen: [],
  team: starters,
  collection: { kitten: {}, tabby: {}, orange: {}, black: {}, white: {} },
  ...over,
});

describe('progression-gated unlock tutorials', () => {
  it('nothing is pending (or blocked) before 1-4 is cleared', () => {
    const s = save({ cleared: clearedUpTo(ch1(3)) });
    expect(pendingTutorials(s)).toEqual([]);
    expect(tutorialBlocking(s, '1-5')).toBeNull();
  });

  it('after 1-4: Shop & Encyclopedia is pending and blocks 1-5 and later, not earlier stages', () => {
    const s = save({ cleared: clearedUpTo(ch1(4)) });
    expect(pendingTutorials(s)).toEqual(['shopCats']);
    for (const id of ['1-5', '1-6', '1-10', '2-1', '2-20']) expect(tutorialBlocking(s, id), id).toBe('shopCats');
    for (const id of ['1-1', '1-2', '1-3', '1-4']) expect(tutorialBlocking(s, id), id).toBeNull();
  });

  it('only finishing or deliberately skipping opens the gate', () => {
    for (const outcome of ['done', 'skipped', 'legacy']) {
      const s = save({ cleared: clearedUpTo(ch1(4)), tutorials: { shopCats: outcome } });
      expect(tutorialBlocking(s, '1-5'), outcome).toBeNull();
    }
  });

  it('after 1-10: Sir Sable story → Edit Team → piercing lesson gate Chapter 2', () => {
    const base = { cleared: clearedUpTo(ch1(10)), collection: { ...save().collection, sable: {} } };
    const s = save({ ...base, tutorials: { shopCats: 'done' } });
    expect(pendingTutorials(s)).toEqual(['sableStory', 'team']);
    expect(tutorialBlocking(s, '2-1')).toBe('sableStory');
    expect(tutorialBlocking(s, '1-10')).toBeNull();
    const after = save({ ...base, seen: ['tut:team'], tutorials: { shopCats: 'done', sableStory: 'done', team: 'done' } });
    expect(pendingTutorials(after)).toEqual(['pierce']);
    const all = save({ ...base, seen: ['tut:team'], tutorials: { shopCats: 'done', sableStory: 'done', team: 'done', pierce: 'skipped' } });
    expect(tutorialBlocking(all, '2-1')).toBeNull();
  });

  it('after 2-5: Recruitment gates 2-6 and later', () => {
    const cleared = clearedUpTo([...ch1(10), '2-1', '2-2', '2-3', '2-4', '2-5']);
    const tutorials = { shopCats: 'done', sableStory: 'done', team: 'done', pierce: 'done' };
    const s = save({ cleared, tutorials, seen: ['tut:team'], collection: { ...save().collection, sable: {} } });
    expect(pendingTutorials(s)).toEqual(['recruit']);
    expect(tutorialBlocking(s, '2-5')).toBeNull();
    expect(tutorialBlocking(s, '2-6')).toBe('recruit');
  });

  it('saves from before V1.6 (legacy) are never blocked', () => {
    const cleared = clearedUpTo([...ch1(10), '2-1', '2-2', '2-3', '2-4', '2-5', '2-6']);
    const tutorials = { shopCats: 'legacy', sableStory: 'legacy', team: 'legacy', pierce: 'legacy', recruit: 'legacy' };
    const s = save({ cleared, tutorials, seen: ['tut:team'], collection: { ...save().collection, sable: {} } });
    expect(pendingTutorials(s)).toEqual([]);
    expect(tutorialBlocking(s, '2-7')).toBeNull();
  });
});

describe('Shop & Encyclopedia tour', () => {
  const steps = TOURS.shopCats;
  it('walks through the real screens and ends back Home', () => {
    expect(steps.map((s) => s.screen)).toEqual(['home', 'shop', 'shop', 'home', 'cats', 'catProfile', 'catProfile', 'cats', 'home']);
    expect(steps[steps.length - 1].action).toBe('finish');
    expect(steps.filter((s) => s.action === 'finish')).toHaveLength(1);
    // The Shop step can be looked at but never bought from.
    expect(steps[1].viewOnly).toBe(true);
  });

  it('resumes from the right step after the player leaves the path', () => {
    // Back from the Shop while it is being explained → tap Shop again.
    expect(rewindStep('shopCats', 1, 'home')).toBe(0);
    // Back from a cat profile → pick a cat again.
    expect(rewindStep('shopCats', 5, 'cats')).toBe(4);
    // Home from the Encyclopedia list → open the Encyclopedia again.
    expect(rewindStep('shopCats', 4, 'home')).toBe(3);
    // A screen the tour never visits: stay put (the stage gate still applies).
    expect(rewindStep('shopCats', 4, 'stages')).toBeNull();
  });
});
