import { BALANCE } from '../config/balance';
import { ALL_STAGE_IDS } from '../config/chapters';
import type { StageDef } from './types';

export function computeStars(baseHp: number, maxBaseHp: number): 1 | 2 | 3 {
  const f = maxBaseHp > 0 ? baseHp / maxBaseHp : 0;
  if (f >= BALANCE.stars.three) return 3;
  if (f >= BALANCE.stars.two) return 2;
  return 1;
}

export function stageClearCoins(stage: StageDef, firstClear: boolean): number {
  return firstClear ? stage.rewards.firstClear : stage.rewards.replay;
}

export function nextStageId(stageId: string): string | null {
  const i = ALL_STAGE_IDS.indexOf(stageId);
  return i >= 0 && i < ALL_STAGE_IDS.length - 1 ? ALL_STAGE_IDS[i + 1] : null;
}

export interface RewardLine {
  key: 'firstClear' | 'stageReward' | 'chests';
  amount: number;
}

/** What this battle earned (separate from the player's existing balance). */
export function rewardSummary(r: { victory: boolean; coins: number; firstClear: boolean; chestCoins: number }): {
  lines: RewardLine[];
  total: number;
} {
  const lines: RewardLine[] = [];
  if (r.victory && r.coins > 0) lines.push({ key: r.firstClear ? 'firstClear' : 'stageReward', amount: r.coins });
  if (r.chestCoins > 0) lines.push({ key: 'chests', amount: r.chestCoins });
  return { lines, total: lines.reduce((a, l) => a + l.amount, 0) };
}
