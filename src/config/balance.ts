// Central balancing knobs. Tweak these after playtesting.
// (The in-game debug panel — open the game with ?debug — can scale many of these live.)

export const BALANCE = {
  // ---- Economy (dried fish, in-battle) ----
  summon: {
    /**
     * Tiered summon cost: the price stays the same for `tierSize` summons, then rises by `perTier`.
     *   cost = base + perTier × floor(summonsSoFar / tierSize), capped at maxCost.
     * Default: 1,1,1 → 2,2,2 → 3,3,3 → 4,4,4 → 5,5,5 → 6… Resets every battle.
     */
    base: 1,
    tierSize: 3,
    perTier: 1,
    maxCost: 30,
  },
  /**
   * Selling a cat in battle (long-press panel). Refund per in-battle level (index = Lv − 1).
   * Checked against the summon curve: a Lv.N cat needs 2^(N−1) summons, so even at the
   * cheapest prices (1,1,1,2,2,2,…) Lv.2 costs ≥2, Lv.3 ≥5, Lv.4 ≥15, Lv.5 ≥51 dried fish.
   * Refunds stay well below that, and every summon raises the summon counter, so
   * summon → sell can never gain fish (it only frees the tile).
   */
  sell: {
    refund: [1, 1, 3, 5, 9] as readonly number[],
    /** Ask for confirmation before selling cats at or above this level. */
    confirmFromLevel: 3,
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
  chest: {
    /** Chest HP × (1 + hpPerStage × (stage number − 1)). */
    hpPerStage: 0.2,
  },

  // ---- Preparation & speed ----
  /**
   * Every stage opens with a preparation phase (no enemies) of this many REAL seconds.
   * It is not affected by game speed, pauses while tutorials / modals are open, and the
   * player can skip it with "Start Battle".
   */
  prepSeconds: 20,
  speed: {
    /** Simulation speed of the "1×" setting relative to the original (V1.2) pace. */
    baseline: 1.2,
    /** Selectable multipliers, relative to the baseline above. */
    options: [0.5, 0.75, 1, 1.5, 2] as readonly number[],
    default: 1,
  },

  // ---- Waves ----
  waves: {
    /**
     * Every stage plan in chapters.ts is written at its original length; the game plays
     * round(waves × countScale) waves (min 3). The enemy mix, wave sizes and HP ramp are
     * stretched over the shorter stage, so variety, chests and bosses all remain — the
     * stage simply has ~30% fewer waves (and ~30% fewer mice).
     */
    countScale: 0.7,
    /** Dried fish per defeated mouse is multiplied by this, so fewer mice still pay for frequent summons. */
    fishMult: 1.25,
  },
  /** Max seconds between end of a wave's spawns and the next wave (skipped early if field is clear). */
  waveGap: 4.5,
  /** Short breather when the field is cleared before the next wave. */
  clearedWaveGap: 1.2,
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
    /**
     * Damage multiplier per level (index 0 = Lv.1). ×2 per merge means merging never
     * loses damage (plus the speed/range bonus and a freed tile).
     */
    damageMult: [1, 2, 4, 8, 16],
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
  const raw = Math.min(s.maxCost, s.base + s.perTier * Math.floor(summonsSoFar / s.tierSize));
  return Math.max(1, Math.round(raw * mult));
}

export function skillRollCost(rollsSoFar: number): number {
  const s = BALANCE.skillRoll;
  return Math.min(s.maxCost, s.baseCost + s.costStep * rollsSoFar);
}
