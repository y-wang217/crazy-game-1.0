import type { CatId, SkillDef, SkillEffect, SkillId } from '../game/types';

// ---------------------------------------------------------------------------
// Skills are data: `per` is the effect gained PER LEVEL (additive).
//   dmg / speed / range / splash / splashRatio / slow / fish → fractions (0.25 = +25%)
//   combo / armor → flat amounts;  slowDur → seconds
// Skills with `cat` only affect that cat; skills without it affect every cat.
// Names & descriptions live in the i18n files (`skill.<id>.name/.desc`).
// ---------------------------------------------------------------------------

const S = (
  id: SkillId,
  icon: string,
  tier: SkillDef['tier'],
  maxLevel: number,
  per: SkillEffect,
  cat?: CatId,
): SkillDef => ({ id, icon, tier, maxLevel, per, cat });

export const SKILLS: Record<SkillId, SkillDef> = {
  // ---- General (all cats / battle-wide) ----
  sharpClaws: S('sharpClaws', '🗡️', 'improved', 5, { dmg: 0.1 }),
  catnipRush: S('catnipRush', '🌿', 'improved', 5, { speed: 0.08 }),
  armorBreak: S('armorBreak', '🔨', 'improved', 3, { armor: 2 }),
  fishyFortune: S('fishyFortune', '🐟', 'basic', 3, { fish: 0.2 }),

  // ---- Kitten: balanced attacker ----
  bravePaws: S('bravePaws', '🐾', 'improved', 4, { dmg: 0.25 }, 'kitten'),
  explorerEyes: S('explorerEyes', '👀', 'basic', 3, { range: 0.12 }, 'kitten'),
  zoomies: S('zoomies', '💨', 'basic', 4, { speed: 0.15 }, 'kitten'),

  // ---- Tabby Warrior: combo fighter ----
  flurryPaws: S('flurryPaws', '👊', 'improved', 3, { combo: 1 }, 'tabby'),
  quickJabs: S('quickJabs', '⚡', 'basic', 4, { speed: 0.15 }, 'tabby'),
  championPunch: S('championPunch', '🥊', 'basic', 4, { dmg: 0.22 }, 'tabby'),

  // ---- Chubby Orange: heavy splash ----
  bigBelly: S('bigBelly', '🌀', 'basic', 4, { splash: 0.2 }, 'orange'),
  bellySlam: S('bellySlam', '💥', 'improved', 4, { dmg: 0.25 }, 'orange'),
  aftershock: S('aftershock', '🌊', 'basic', 3, { splashRatio: 0.1 }, 'orange'),

  // ---- Black Cat: sniper ----
  steadyAim: S('steadyAim', '🎯', 'basic', 4, { speed: 0.15 }, 'black'),
  deadeye: S('deadeye', '💫', 'improved', 4, { dmg: 0.25 }, 'black'),
  longScope: S('longScope', '🔍', 'basic', 3, { range: 0.1 }, 'black'),

  // ---- Noble White: distraction support ----
  dazzlingGrace: S('dazzlingGrace', '💖', 'improved', 3, { slow: 0.07 }, 'white'),
  lingeringCharm: S('lingeringCharm', '⏳', 'basic', 3, { slowDur: 0.5 }, 'white'),
  radiantBeauty: S('radiantBeauty', '✨', 'basic', 3, { range: 0.12 }, 'white'),

  // ---- Mr. Whiskers: ricochet ----
  encore: S('encore', '🎩', 'improved', 2, { bounce: 1 }, 'whiskers'),
  stageMagic: S('stageMagic', '🪄', 'basic', 4, { dmg: 0.22 }, 'whiskers'),

  // ---- Sir Sable: piercing line ----
  keenEdge: S('keenEdge', '🗡️', 'improved', 4, { dmg: 0.22 }, 'sable'),
  swiftDraw: S('swiftDraw', '💨', 'basic', 4, { speed: 0.12 }, 'sable'),

  // ---- Captain Mallow: support ----
  warmHeart: S('warmHeart', '💛', 'improved', 3, { buff: 0.06 }, 'mallow'),
  biggerBell: S('biggerBell', '🔔', 'basic', 3, { range: 0.12 }, 'mallow'),

  // ---- Shadow Pounce: execute ----
  sharpInstinct: S('sharpInstinct', '🐾', 'improved', 3, { execute: 0.06 }, 'pounce'),
  rooftopSprint: S('rooftopSprint', '⚡', 'basic', 4, { speed: 0.12 }, 'pounce'),

  // ---- Silver Devil: poison ----
  potentBrew: S('potentBrew', '🧪', 'improved', 4, { poison: 0.22 }, 'devil'),
  lingeringVenom: S('lingeringVenom', '⏳', 'basic', 3, { poisonDur: 1 }, 'devil'),
};

export const SKILL_ORDER: SkillId[] = [
  'sharpClaws',
  'catnipRush',
  'armorBreak',
  'fishyFortune',
  'bravePaws',
  'explorerEyes',
  'zoomies',
  'flurryPaws',
  'quickJabs',
  'championPunch',
  'bigBelly',
  'bellySlam',
  'aftershock',
  'steadyAim',
  'deadeye',
  'longScope',
  'dazzlingGrace',
  'lingeringCharm',
  'radiantBeauty',
  'encore',
  'stageMagic',
  'keenEdge',
  'swiftDraw',
  'warmHeart',
  'biggerBell',
  'sharpInstinct',
  'rooftopSprint',
  'potentBrew',
  'lingeringVenom',
];

/**
 * How likely a skill is to be offered (random purchase and chest choices).
 * Skills for cats you actually have on the board are strongly preferred; skills
 * for roster cats you don't have yet are rare; general skills sit in between.
 */
export const SKILL_WEIGHTS = {
  general: 1,
  catOnBoard: 2.5,
  /** Extra weight per additional cat of that type on the board (capped). */
  perExtraCat: 0.25,
  perExtraCatCap: 4,
  catInRosterOnly: 0.3,
  /** Chest offers: at least this many choices are general or for cats on the board (when possible). */
  chestRelevantMin: 2,
} as const;

const pct = (x: number) => Math.round(x * 100);

/** Numbers for a skill's localized description at a given level (`skill.<id>.desc` uses {a}). */
export function skillParams(id: SkillId, level: number): Record<string, number | string> {
  const per = SKILLS[id].per;
  const [key, v] = Object.entries(per)[0] as [keyof SkillEffect, number];
  const total = v * level;
  if (key === 'combo' || key === 'armor' || key === 'bounce') return { a: total };
  if (key === 'slowDur' || key === 'poisonDur') return { a: total.toFixed(1) };
  return { a: pct(total) };
}
