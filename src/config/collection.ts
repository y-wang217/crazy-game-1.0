import type { CatId } from '../game/types';

// ---------------------------------------------------------------------------
// Permanent progression: star ranks (1★–5★), fragments, recruitment, team.
// In-battle levels (Lv.1–Lv.5, merging) live in balance.ts and reset every battle;
// star ranks are saved and never reset. Every number here is a tuning knob.
// ---------------------------------------------------------------------------

export const STARS = {
  max: 5,
  /** Star rank that unlocks the cat's Special Ability. */
  specialAt: 3,
  /** Star rank that unlocks the cat's Ultimate Ability. */
  ultimateAt: 5,
  /** Permanent stat multipliers by star (index = star − 1). Deliberately modest. */
  damageMult: [1, 1.06, 1.1, 1.16, 1.2] as readonly number[],
  speedMult: [1, 1.02, 1.04, 1.06, 1.08] as readonly number[],
  /** Support strength (Noble White's slow, Captain Mallow's buff). */
  supportMult: [1, 1.05, 1.08, 1.12, 1.15] as readonly number[],
  /** Cost to go from star N to N+1 (index = current star − 1). */
  costs: [
    { fragments: 10, coins: 100 },
    { fragments: 20, coins: 250 },
    { fragments: 30, coins: 500 },
    { fragments: 40, coins: 800 },
  ] as readonly { fragments: number; coins: number }[],
} as const;

export const RECRUIT = {
  /** Fish coins per draw. */
  cost: 100,
  /** Fragments for that exact cat when a draw is a duplicate. */
  duplicateFragments: 10,
  /**
   * New-cat guarantee: if this many draws in a row gave only duplicates, the next draw is a
   * cat you do not own yet (while any remain). Shown to the player as a counter.
   */
  guaranteeNewWithin: 6,
  /** Draw weight per cat (equal odds: every cat has the same chance). */
  weight: 1,
  /** Fragments for a cat already at 5★ convert into fish coins at this rate. */
  maxedFragmentCoins: 5,
} as const;

/**
 * Fragment top-up (V1.5 economy audit): buy the fragments still missing for an owned cat's NEXT
 * star with fish coins. Removes the pure-luck wall on upgrading the cat you actually want
 * (5★ for one chosen cat used to need ~100 recruits ≈ 10,000 coins). Only ever the missing
 * amount (no overbuying), never for a 5★ cat, so it can't be looped with `maxedFragmentCoins`.
 * Draws stay the better value for broad progress: 100 coins → 10 fragments for some cat.
 */
export const FRAGMENT_TOPUP = { enabled: true, coinsPerFragment: 30 } as const;

/** Most cat species a player can bring into a battle (random summons pick from these). */
export const TEAM_SIZE = 5;
/**
 * Fewest species allowed. Bringing 4 instead of 5 is optional: fewer species means
 * more matching pairs (easier merges) but less variety.
 */
export const TEAM_MIN = 4;

/**
 * First clear of a chapter's final stage grants a cat (once per chapter, also retroactively).
 * If it is already owned, the player gets a different unowned new cat instead, or — if they
 * own every cat — `fallbackFragments` fragments of the listed cat.
 */
export const CHAPTER_REWARDS: Record<string, { cat: CatId; fallbackFragments: number }> = {
  ch1: { cat: 'sable', fallbackFragments: 30 },
  ch2: { cat: 'devil', fallbackFragments: 30 },
};

// ---------------------------------------------------------------------------
// Special (3★) and Ultimate (5★) abilities. Ultimates all use the same model:
// one shared, automatic cooldown per species (the highest-level copy on the
// board performs it), so several copies can never spam it.
// ---------------------------------------------------------------------------

export const ULTIMATE = {
  /** Seconds (game time) between ultimates of the same species. */
  cooldown: 22,
  /** The bar starts this full when combat begins. */
  startCharge: 0.5,
} as const;

export const ABILITIES = {
  kitten: {
    /** Every Nth yarn ball is a big empowered one. */
    special: { every: 4, mult: 2 },
    /** Heroic burst: a rapid volley of empowered yarn balls. */
    ultimate: { shots: 6, gap: 0.12, mult: 1.6 },
  },
  tabby: {
    /** The last punch of every combo hits harder. */
    special: { finisherMult: 2 },
    /** Extended flurry. */
    ultimate: { punches: 12, mult: 1.2 },
  },
  orange: {
    /** Slammed mice take extra damage from everyone for a short time. */
    special: { vulnerable: 0.15, duration: 3 },
    /** One enormous local slam (no screen shake). */
    ultimate: { radiusMult: 1.8, dmgMult: 4 },
  },
  black: {
    /** Every Nth shot ignores part of the target's armor. */
    special: { every: 3, armorIgnore: 0.6 },
    /** Charged shot at the toughest mouse in (extended) range. */
    ultimate: { dmgMult: 6, rangeMult: 1.4 },
  },
  white: {
    /** Every Nth charm lasts longer. */
    special: { every: 3, durationMult: 2 },
    /** Grand royal pose: slows every mouse in a wide circle. */
    ultimate: { radiusMult: 2, slow: 0.6, duration: 3 },
  },
  whiskers: {
    /** Every Nth yarn ball gets an extra bounce. */
    special: { every: 4, extraBounces: 1 },
    /** Giant yarn ball that ricochets many times. */
    ultimate: { bounces: 8, dmgMult: 2.2, falloff: 0.9, bounceRangeMult: 1.4 },
  },
  sable: {
    /** Sword waves strip armor for a short time. */
    special: { armorShred: 3, duration: 3 },
    /** Telegraphed long slash through everything in a line. */
    ultimate: { telegraph: 0.6, dmgMult: 5, lengthMult: 2.2, width: 22 },
  },
  mallow: {
    /** When a nearby ally merges, nearby allies get a damage boost (with its own cooldown). */
    special: { dmgBuff: 0.15, duration: 4, cooldown: 2 },
    /** Whole team: faster attacks and a little extra damage. */
    ultimate: { speedBuff: 0.25, dmgBuff: 0.15, duration: 6 },
  },
  pounce: {
    /** After a kill, the next strike is empowered (with a cooldown). */
    special: { mult: 2.5, cooldown: 4 },
    /** Rapid strikes on wounded mice in range (capped; bosses take normal hits). */
    ultimate: { strikes: 6, gap: 0.1, hpBelow: 0.5, mult: 3 },
  },
  devil: {
    /** Repeated hits on the same mouse stack poison (capped). */
    special: { maxStacks: 3 },
    /** Mark the toughest mouse: stronger poison and bonus damage from allies. */
    ultimate: { duration: 6, poisonMult: 2.5, allyBonus: 0.15, bossPoisonMult: 1.6, bossAllyBonus: 0.08 },
  },
} as const satisfies Record<CatId, { special: Record<string, number>; ultimate: Record<string, number> }>;

/** Poison against bosses is weaker so it can't trivialize them. */
export const POISON_BOSS_MULT = 0.7;

export function starCost(currentStar: number): { fragments: number; coins: number } | null {
  if (currentStar >= STARS.max) return null;
  return STARS.costs[Math.max(0, currentStar - 1)] ?? null;
}

/** Numbers used by the localized ability descriptions (`ability.<cat>.special/ult.desc`). */
export function abilityParams(cat: CatId, which: 'special' | 'ult'): Record<string, number | string> {
  const pct = (x: number) => Math.round(x * 100);
  const A = ABILITIES[cat] as { special: Record<string, number>; ultimate: Record<string, number> };
  const p = which === 'special' ? A.special : A.ultimate;
  const out: Record<string, number | string> = { cd: ULTIMATE.cooldown };
  for (const [k, v] of Object.entries(p)) {
    // fractions → percent, multipliers stay as ×N
    out[k] =
      k.toLowerCase().includes('mult') ||
      [
        'shots',
        'punches',
        'strikes',
        'bounces',
        'every',
        'extraBounces',
        'maxStacks',
        'armorShred',
        'duration',
        'cooldown',
        'telegraph',
        'gap',
        'width',
      ].includes(k)
        ? v
        : pct(v);
  }
  return out;
}
