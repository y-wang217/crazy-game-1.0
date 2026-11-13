import { ALL_STAGE_IDS } from '../config/chapters';
import { FEATURE_UNLOCKS, TUTORIAL_UNLOCK_STAGE, type TutorialId } from '../config/unlocks';
import type { CatId } from '../game/types';
import { TEAM_TUTORIAL_ID, teamTutorialCat } from './teamTutorial';

// Progression-gated unlock tutorials (V1.6 UX fix). An unlock tutorial is "pending" from the
// moment its stage is cleared until it is finished ('done') or deliberately skipped ('skipped').
// Saves from before V1.6 are marked 'legacy' and never pending. While one is pending, no stage
// after its unlock stage can be started (earlier stages stay playable). This is the single
// source of truth for Home (which tutorial to show next), Stage Select (lock), the victory
// screen (no "Next stage") and App's navigation guard.

export interface GateSave {
  cleared: Record<string, number>;
  tutorials: Partial<Record<TutorialId, string>>;
  seen: string[];
  team: CatId[];
  collection: Partial<Record<CatId, unknown>>;
}

const cleared = (save: GateSave, stage: string) => stage in save.cleared;

/** Pending unlock tutorials, in the order Home presents them. */
export function pendingTutorials(save: GateSave): TutorialId[] {
  const tut = save.tutorials;
  const out: TutorialId[] = [];
  const team = cleared(save, FEATURE_UNLOCKS.team);
  const sable = !!save.collection.sable;
  const teamDecided = !!tut.team || save.seen.includes(TEAM_TUTORIAL_ID);
  if (cleared(save, FEATURE_UNLOCKS.shop) && !tut.shopCats) out.push('shopCats');
  if (team && sable && !tut.sableStory) out.push('sableStory');
  if (team && !tut.team && teamTutorialCat(save) !== null) out.push('team');
  if (team && sable && teamDecided && !tut.pierce) out.push('pierce');
  if (cleared(save, FEATURE_UNLOCKS.recruit) && !tut.recruit) out.push('recruit');
  return out;
}

/** The pending tutorial that blocks `stageId`, or null when the stage may be started. */
export function tutorialBlocking(save: GateSave, stageId: string): TutorialId | null {
  const at = ALL_STAGE_IDS.indexOf(stageId);
  if (at < 0) return null;
  for (const id of pendingTutorials(save)) {
    if (at > ALL_STAGE_IDS.indexOf(TUTORIAL_UNLOCK_STAGE[id])) return id;
  }
  return null;
}
