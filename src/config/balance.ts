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
    /**
     * Simulation speed of the "1×" setting relative to the original (V1.2) pace.
     * V1.3 made it 1.2; the pacing update slowed combat by 10% (1.2 × 0.9 = 1.08) so players
     * have more time to think. Every option (0.5×–2×) is relative to this.
     */
    baseline: 1.08,
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
  /**
   * Max seconds between the end of a wave's spawns and the next wave while mice are still on
   * the road (the pressure cap — unchanged by the pacing update so difficulty stays the same).
   */
  waveGap: 4.5,
  /** Short breather when the field is cleared before the next wave. */
  clearedWaveGap: 1.2,
  /**
   * Pacing update: extra calm time (game seconds) added after the field is CLEARED, counted
   * from the moment the last mouse falls, so a cleared field always gets
   * clearedWaveGap + waveBreather (= 4.2 s) to inspect, reposition and merge. A "next wave
   * in N" countdown shows during it. Only added when the field is empty, so it doesn't make
   * waves easier (no passive income, no extra shooting time on live mice).
   */
  waveBreather: 3,
  /**
   * Extra seconds added to the pressure cap (waveGap) when mice are still alive. Sim (naive bot,
   * 10 seeds): 0 = V1.4 results exactly; 1.5 = slightly gentler early Chapter 1 for weak play
   * (1-4: 4→6/10 wins), smart play unchanged; 3 = clearly easier (1-4: 9/10). 0 restores the old pressure.
   */
  waveBreatherHostile: 1.5,
  /**
   * Enemy HP ramp inside a stage: toughness = hpScale × (1 + growth × waveIndex^curve).
   * curve > 1 keeps early waves gentle and makes late waves demand a stronger formation.
   * `growth` defaults to waveHpGrowth; stages override it.
   */
  waveHpGrowth: 0.05,
  waveHpCurve: 1.5,

  // ---- Combat ----
  /** Moonshadow Emperor (2-20): when its HP first drops to `regrowAt`, the veil regrows. */
  boss: {
    regrowAt: 0.5,
    /** Fraction of the original shield that comes back. */
    regrowShield: 0.6,
    /** Regular mice that appear behind it at that moment. */
    regrowGuards: 4,
  },
  /** Elite enemies (see config/enemies.ts). */
  elite: {
    /** Mouse Captain: mice within this radius (world px; a tile is 50) take less damage… */
    guardRadius: 70,
    /** …by this fraction (direct hits only — poison is unaffected). */
    guardReduction: 0.35,
  },
  /** Minimum fraction of raw damage that always gets through armor. */
  minDamageRatio: 0.2,
  /** Hard cap on movement slowdown (0.7 = 70% slower). */
  slowCap: 0.7,

  // ---- Cat levels ----
  levels: {
    maxLevel: 5,
    /**
     * Damage multiplier per level (index 0 = Lv.1). Front-loaded merge payoff (V1.5 review):
     * merging into Lv.2 / Lv.3 gives a little MORE than the two cats it uses (×2.1 per step),
     * Lv.4 / Lv.5 give a smaller step (≈ +80% DPS each) so one Lv.5 cat is strong but not
     * a runaway breakpoint. Lv.5 ≈ 15× Lv.1 DPS (was ≈ 20×); every level still clearly beats
     * the one before. Was [1, 2, 4, 8, 16].
     */
    damageMult: [1, 2.1, 4.2, 7.6, 13],
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
