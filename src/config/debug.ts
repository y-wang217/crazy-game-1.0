// Developer-only balance overrides. Neutral values (1 / null) mean "use the config".
// The debug panel (open the game with ?debug, or tap the version label 5×) edits these.

export interface Tuning {
  /** Override every stage's starting dried fish (null = stage value). */
  startFish: number | null;
  /** Multiplies every summon cost. */
  summonCostMult: number;
  /** Multiplies enemy & chest HP / shields. */
  enemyHpMult: number;
  /** Multiplies enemy movement speed. */
  enemySpeedMult: number;
  /** Multiplies the number of enemies in each spawn group. */
  enemyCountMult: number;
  /** Multiplies the time between waves and spawn intervals. */
  waveIntervalMult: number;
  /** Multiplies all cat damage. */
  catDamageMult: number;
}

export const NEUTRAL_TUNING: Tuning = {
  startFish: null,
  summonCostMult: 1,
  enemyHpMult: 1,
  enemySpeedMult: 1,
  enemyCountMult: 1,
  waveIntervalMult: 1,
  catDamageMult: 1,
};
