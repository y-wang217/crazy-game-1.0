// Cat Food Can (貓罐頭) sources after Recruitment unlocks (V1.6). Every permanent can is either a
// guaranteed one-time grant or a random bonus capped to once per stage per save, so replaying
// easy stages can never farm recruitment currency. All numbers are tuning knobs.
//
//   2-5 clear ............ 2 cans (unlock gift, config/unlocks.ts CANS.introGift)
//   first clears ......... 2-8: 1 · 2-10: 2 · 2-13: 1 · 2-16: 1 · 2-18: 1 · 2-20: 3   (= 11 with the gift)
//   Living Cat Food Can .. 1 can the first time it is defeated on each of its four stages
//   Gold Chest ........... 4% chance of +1 can, at most once per stage (not on the four can-monster stages)

/** One-time first-clear rewards (milestone ids `cans:clear:<stage>`). */
export const MILESTONE_CANS: Record<string, number> = {
  '2-8': 1,
  '2-10': 2,
  '2-13': 1,
  '2-16': 1,
  '2-18': 1,
  '2-20': 3,
};

/** 罐頭怪 / Living Cat Food Can — the secret enemy. */
export const CAN_MONSTER = {
  /** The only stages it can ever appear on (stage select shows a small, unexplained can icon). */
  stages: ['2-6', '2-9', '2-15', '2-18'] as readonly string[],
  /** Chance on the first-ever attempt of a stage (attempt = battle started, won or not). */
  firstAttemptChance: 1,
  /** Chance on every later attempt (design range 0.30–0.40). */
  repeatChance: 0.35,
  /** Cans for the first defeat on each stage (milestone `canMonster:<stage>`). */
  rewardCans: 1,
  /** Fish coins for defeating it again after that stage's can was claimed. */
  repeatCoins: 20,
} as const;

/** Gold Treasure Chest bonus can (only once Recruitment is unlocked). */
export const GOLD_CHEST_CAN = {
  chance: 0.04,
  cans: 1,
} as const;

export const isCanMonsterStage = (stageId: string) => CAN_MONSTER.stages.includes(stageId);

/** Does the Living Cat Food Can join this attempt? `attemptsBefore` counts earlier attempts. */
export function rollCanMonster(stageId: string, attemptsBefore: number, rand: () => number = Math.random): boolean {
  if (!isCanMonsterStage(stageId)) return false;
  return rand() < (attemptsBefore === 0 ? CAN_MONSTER.firstAttemptChance : CAN_MONSTER.repeatChance);
}

export const milestoneId = {
  clear: (stage: string) => `cans:clear:${stage}`,
  canMonster: (stage: string) => `canMonster:${stage}`,
  goldChest: (stage: string) => `goldCan:${stage}`,
};
