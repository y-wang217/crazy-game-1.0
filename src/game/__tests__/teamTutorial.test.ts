import { STARTER_CATS } from '../../config/cats';
import { TEAM_TUTORIAL_ID, teamTutorialCat, teamTutorialDone, teamTutorialStep } from '../../tutorial/teamTutorial';
import type { CatId } from '../types';

const owned = (ids: CatId[]) => Object.fromEntries(ids.map((id) => [id, { stars: 1, fragments: 0 }]));
const starters: CatId[] = [...STARTER_CATS];

describe('Edit Team tutorial', () => {
  it('starts only when a new (non-starter) cat is owned but not in the team', () => {
    expect(teamTutorialCat({ seen: [], team: starters, collection: owned(starters) })).toBeNull(); // fresh save
    expect(teamTutorialCat({ seen: [], team: starters, collection: owned([...starters, 'mallow']) })).toBe('mallow');
    // Seen (completed or deliberately skipped) → never again.
    expect(teamTutorialCat({ seen: [TEAM_TUTORIAL_ID], team: starters, collection: owned([...starters, 'mallow']) })).toBeNull();
    // A player who already put a new cat in the team doesn't need it.
    const team: CatId[] = ['kitten', 'tabby', 'orange', 'black', 'mallow'];
    expect(teamTutorialDone({ seen: [], team, collection: owned([...starters, 'mallow', 'devil']) })).toBe(true);
    expect(teamTutorialCat({ seen: [], team, collection: owned([...starters, 'mallow', 'devil']) })).toBeNull();
  });

  it('steps follow the real team: pick a slot → tap the new cat → confirm; undoing steps back', () => {
    expect(teamTutorialStep(starters, 'mallow', null)).toBe('slot');
    expect(teamTutorialStep(starters, 'mallow', 2)).toBe('cat');
    const swapped: CatId[] = ['kitten', 'tabby', 'mallow', 'black', 'white'];
    expect(teamTutorialStep(swapped, 'mallow', null)).toBe('confirm');
    // Removing the new cat again goes back to picking.
    expect(teamTutorialStep(starters, 'mallow', null)).toBe('slot');
    // A team with a free slot skips slot picking.
    expect(teamTutorialStep(['kitten', 'tabby', 'orange', 'black'], 'mallow', null)).toBe('cat');
  });
});
