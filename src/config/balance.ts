// Central balancing knobs. Tweak these after playtesting.

export const BALANCE = {
  // ---- Economy (dried fish, in-battle) ----
  summon: {
    baseCost: 20,
    /** Cost increase per cat summoned this stage. */
    costStep: 3,
    maxCost: 60,
  },
  skillRoll: {
    baseCost: 40,
    costStep: 12,
    maxCost: 120,
  },
  /**
   * Enemy fish rewards scale with stage HP: reward * hpScale^exponent.
   * (0 = never scale, 1 = scale fully with HP.)
   */
  rewardScaleExponent: 0.7,
  /** Dried fish bonus when a wave is fully cleared. */
  waveClearBonus: 15,

  // ---- Waves ----
  /** Seconds before wave 1 starts (time to summon). */
  firstWaveDelay: 4,
  /** Max seconds between end of a wave's spawns and the next wave (skipped early if field is clear). */
  waveGap: 8,
  /** Short breather when the field is cleared before the next wave. */
  clearedWaveGap: 2,

  // ---- Combat ----
  /** Minimum fraction of raw damage that always gets through armor. */
  minDamageRatio: 0.2,
  /** Hard cap on movement slowdown (0.7 = 70% slower). */
  slowCap: 0.7,

  // ---- Cat levels ----
  levels: {
    maxLevel: 5,
    /** Damage multiplier per level (index 0 = Lv.1). */
    damageMult: [1, 1.8, 3.2, 5.6, 9.6],
    /** Extra range per level above 1 (fraction). */
    rangePerLevel: 0.06,
    /** Extra attack speed per level above 1 (fraction). */
    speedPerLevel: 0.06,
    /** White cat: extra slow strength per level above 1. */
    slowPerLevel: 0.05,
  },

  // ---- Stage results ----
  stars: {
    /** Fraction of base HP remaining for 3 / 2 stars. */
    three: 1.0,
    two: 0.5,
  },

  // ---- Input ----
  /** Pointer travel (CSS px) before a press becomes a drag. */
  dragThresholdPx: 10,
} as const;

export function summonCost(summonsSoFar: number): number {
  const s = BALANCE.summon;
  return Math.min(s.maxCost, s.baseCost + s.costStep * summonsSoFar);
}

export function skillRollCost(rollsSoFar: number): number {
  const s = BALANCE.skillRoll;
  return Math.min(s.maxCost, s.baseCost + s.costStep * rollsSoFar);
}
