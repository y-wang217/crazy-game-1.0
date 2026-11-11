import { BALANCE } from '../config/balance';
import { ALL_STAGE_IDS, CHAPTERS } from '../config/chapters';
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

export interface ChapterProgress {
  id: string;
  number: number;
  cleared: number;
  /** Stage count read from the chapter itself, so new chapters / stages never need a hardcoded total. */
  total: number;
  complete: boolean;
  /** The chapter's first stage is unlocked. */
  open: boolean;
}

/** Per-chapter clear counts: only stages that belong to that chapter count towards it. */
export function chapterProgress(save: { cleared: Record<string, number>; unlocked: string[] }): ChapterProgress[] {
  return CHAPTERS.map((ch) => {
    const cleared = ch.stages.filter((s) => s.id in save.cleared).length;
    const total = ch.stages.length;
    return { id: ch.id, number: ch.number, cleared, total, complete: cleared >= total, open: save.unlocked.includes(ch.stages[0].id) || cleared > 0 };
  });
}

/** The chapter the player is working on: the latest open chapter (the last one once everything is open). */
export function currentChapter(progress: ChapterProgress[]): ChapterProgress {
  const open = progress.filter((c) => c.open);
  return open.find((c) => !c.complete) ?? open[open.length - 1] ?? progress[0];
}
