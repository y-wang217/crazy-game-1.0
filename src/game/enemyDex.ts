import { CAN_MONSTER } from "../config/canRewards";
import { CHAPTERS } from "../config/chapters";
import { ENEMIES } from "../config/enemies";
import type { EnemyId, StageDef } from "./types";

// Enemy Encyclopedia data (V1.6.4). Everything is derived from the real stage and enemy configs,
// so new chapters / enemies appear automatically in the order players meet them.

/** Every enemy a stage can send (built waves include elites and bosses). The secret can is only on its own stages. */
export function stageEnemies(stage: StageDef): EnemyId[] {
  const out = new Set<EnemyId>();
  for (const w of stage.waves)
    for (const g of w.groups) if ("enemy" in g) out.add(g.enemy);
  if (CAN_MONSTER.stages.includes(stage.id)) out.add("canMonster");
  return [...out];
}

export interface DexEntry {
  id: EnemyId;
  /** First stage (id) where it can appear, in play order. */
  firstStage: string;
  /** Chapter id of that stage. */
  chapterId: string;
}

/** All enemies in the order they first appear in the campaign. */
export const ENEMY_DEX: DexEntry[] = (() => {
  const seen = new Map<EnemyId, DexEntry>();
  for (const ch of CHAPTERS)
    for (const s of ch.stages)
      for (const id of stageEnemies(s))
        if (!seen.has(id) && id in ENEMIES)
          seen.set(id, { id, firstStage: s.id, chapterId: ch.id });
  return [...seen.values()];
})();

/** Enemies whose details stay a secret even after meeting them (same rule as the first-meeting card). */
export const SECRET_ENEMIES = new Set<EnemyId>(["canMonster"]);

/**
 * Has the player met this enemy? Its first-meeting card was shown (`enemy:<id>` in `seen`), or —
 * so that "show tips again" never empties the Encyclopedia — the player cleared a stage that
 * always sends it. The secret can counts only once actually met (card shown or defeated).
 */
export function isEnemyDiscovered(
  id: EnemyId,
  save: {
    seen: string[];
    cleared: Record<string, number>;
    milestones: string[];
  },
): boolean {
  if (save.seen.includes(`enemy:${id}`)) return true;
  if (id === "canMonster")
    return save.milestones.some((m) => m.startsWith("canMonster:"));
  for (const ch of CHAPTERS)
    for (const s of ch.stages)
      if (s.id in save.cleared && stageEnemies(s).includes(id)) return true;
  return false;
}
