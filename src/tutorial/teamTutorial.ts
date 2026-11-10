import { CAT_ORDER, STARTER_CATS } from '../config/cats';
import { TEAM_SIZE } from '../config/collection';
import type { CatId } from '../game/types';

// Edit Team tutorial: the first time a new (non-starter) cat joins, the player is walked
// through actually putting it into the battle team. It only counts as done when the team is
// CONFIRMED with that cat in it, or when the player deliberately taps "Skip tutorial".
// Closing a popup or leaving the Team screen early never completes it — it comes back.

export const TEAM_TUTORIAL_ID = 'tut:team';

interface TeamTutorialSave {
  seen: string[];
  team: CatId[];
  collection: Partial<Record<CatId, unknown>>;
}

/** Already handled: seen, or the player put a non-starter in the team on their own. */
export function teamTutorialDone(save: TeamTutorialSave): boolean {
  return save.seen.includes(TEAM_TUTORIAL_ID) || save.team.some((id) => !STARTER_CATS.includes(id));
}

/** The new cat the tutorial is about, or null when there is nothing to teach. */
export function teamTutorialCat(save: TeamTutorialSave): CatId | null {
  if (teamTutorialDone(save)) return null;
  return CAT_ORDER.find((id) => save.collection[id] && !STARTER_CATS.includes(id) && !save.team.includes(id)) ?? null;
}

export type TeamTutorialStep = 'slot' | 'cat' | 'confirm';

/**
 * What the player must do next on the Team screen, derived from the real (draft) team:
 * pick a slot to replace → tap the new cat → confirm. Undoing a step steps back.
 */
export function teamTutorialStep(team: CatId[], cat: CatId, selectedSlot: number | null): TeamTutorialStep {
  if (team.includes(cat)) return 'confirm';
  if (selectedSlot !== null || team.length < TEAM_SIZE) return 'cat';
  return 'slot';
}
