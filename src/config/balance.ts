// Central balancing knobs. Tweak these after playtesting.
// (The in-game debug panel — open the game with ?debug — can scale many of these live.)

export const BALANCE = {
  // ---- Economy (dried fish, in-battle) ----
  summon: {
    /**
     * Cost of the 1st, 2nd, 3rd… summon in a stage. Resets every stage.
     * Cheap early summons let you build a formation quickly; it then climbs gently.
     */
    costTable: [1, 2, 3, 5, 7, 9, 11, 13, 15, 18, 21, 24, 27, 30],
    /** After the table runs out, each further summon costs this much more. */
    stepAfterTable: 3,
    maxCost: 60,
  },
  skillRoll: {
    baseCost: 20,
    /** Cost increase per skill bought this stage. */
    costStep: 6,
    maxCost: 60,
  },
  /**
   * Enemy fish rewards scale with enemy toughness: reward * toughness^exponent
   * (toughness = stage hpScale × per-wave ramp). 0 = never scale, 1 = scale with HP.
   */
  rewardScaleExponent: 0.3,
  /** Dried fish bonus when a wave is fully cleared. */
  waveClearBonus: 4,
  /** Dried fish given instead of a chest reward when every skill is maxed. */
  maxedChestFish: 15,

  // ---- Waves ----
  /** Seconds before wave 1 starts (time to summon). */
  firstWaveDelay: 6,
  /** Max seconds between end of a wave's spawns and the next wave (skipped early if field is clear). */
  waveGap: 7,
  /** Short breather when the field is cleared before the next wave. */
  clearedWaveGap: 2.5,
  /**
   * Enemy HP ramp inside a stage: toughness = hpScale × (1 + growth × waveIndex^curve).
   * curve > 1 keeps early waves gentle and makes late waves demand a stronger formation.
   * `growth` defaults to waveHpGrowth; stages override it.
   */
  waveHpGrowth: 0.05,
  waveHpCurve: 1.5,

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

  // ---- Feature unlocks ----
  unlocks: {
    /** The Random Skill button is available from this stage number on. */
    skillShopFromStage: 5,
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

/** Cost of the next summon given how many cats were summoned this stage. */
export function summonCost(summonsSoFar: number, mult = 1): number {
  const s = BALANCE.summon;
  const t = s.costTable;
  const raw = summonsSoFar < t.length ? t[summonsSoFar] : t[t.length - 1] + s.stepAfterTable * (summonsSoFar - t.length + 1);
  return Math.max(1, Math.round(Math.min(s.maxCost, raw) * mult));
}

export function skillRollCost(rollsSoFar: number): number {
  const s = BALANCE.skillRoll;
  return Math.min(s.maxCost, s.baseCost + s.costStep * rollsSoFar);
}
