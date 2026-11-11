import { ALL_STAGE_IDS, findStage, PRACTICE_STAGE, PRACTICE_STAGE_ID } from '../../config/chapters';
import { MAPS } from '../../config/maps';
import { Battle } from '../../game/battle';
import { chapterProgress } from '../../game/progression';
import { parseSave } from '../../save/store';
import { practiceTeamCat } from '../../ui/screens/TeamScreen';
import { GLOBAL_STEPS, STAGE_STEPS } from '../steps';

describe('Replay Interactive Tutorial (practice)', () => {
  it('is a separate stage outside every chapter (no unlocks, rewards or progress)', () => {
    expect(ALL_STAGE_IDS).not.toContain(PRACTICE_STAGE_ID);
    expect(findStage(PRACTICE_STAGE_ID)?.stage).toBe(PRACTICE_STAGE);
    expect(PRACTICE_STAGE.rewards).toEqual({ firstClear: 0, replay: 0 });
    // A save that somehow names it is not changed by it.
    const save = parseSave(JSON.stringify({ version: 3, cleared: { practice: 3 }, unlocked: ['1-1', 'practice'] }));
    expect(save.cleared).toEqual({});
    expect(chapterProgress(save)[0].cleared).toBe(0);
  });

  it('teaches every Stage 1 lesson, the speed button and Tactical Pause, and has a chest', () => {
    const ids = STAGE_STEPS[PRACTICE_STAGE_ID].map((s) => s.id);
    for (const id of ['tut:summon', 'tut:target', 'tut:modes', 'tut:move', 'tut:swap', 'tut:merge', 'tut:speed']) expect(ids).toContain(id);
    expect(GLOBAL_STEPS.map((s) => s.id)).toContain('tut:tpause');
    const b = new Battle(PRACTICE_STAGE, MAPS.forest_compact, {});
    const tpause = GLOBAL_STEPS.find((s) => s.id === 'tut:tpause')!;
    b.startBattle();
    b.placeCat('kitten', 1, b.emptyTiles()[0].id);
    b.placeCat('tabby', 1, b.emptyTiles()[0].id);
    // Tactical Pause is normally from 1-3 on; the practice stage includes it.
    for (let i = 0; i < 200 && !tpause.when!(b, { has: () => false, mark: () => {} }); i++) b.update(0.1);
    expect(tpause.when!(b, { has: () => false, mark: () => {} })).toBe(true);
    const chests = PRACTICE_STAGE.waves.flatMap((w) => w.groups).filter((g) => 'chest' in g);
    expect(chests.length).toBe(1);
  });

  it('Edit Team practice prefers an owned cat outside the team, else a trial cat', () => {
    const team = ['kitten', 'tabby', 'orange', 'black', 'white'] as const;
    expect(practiceTeamCat({ team: [...team], collection: { kitten: 1, tabby: 1, orange: 1, black: 1, white: 1, sable: 1 } })).toBe('sable');
    const trial = practiceTeamCat({ team: [...team], collection: { kitten: 1, tabby: 1, orange: 1, black: 1, white: 1 } });
    expect(trial).not.toBeNull();
    expect(team).not.toContain(trial);
  });
});
