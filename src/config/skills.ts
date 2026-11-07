import type { SkillDef, SkillId } from '../game/types';

// Numeric effect per level for each skill. Kept here so balancing is one place.
export const SKILL_VALUES = {
  sharpClaws: { damagePerLevel: 0.15 },
  catnipRush: { speedPerLevel: 0.12 },
  keenEyes: { rangePerLevel: 0.08 },
  bellySlam: { splashPerLevel: 0.2, damagePerLevel: 0.15 },
  flurryPaws: { hitsPerLevel: 1 },
  armorBreak: { armorPerLevel: 2 },
  dazzlingGrace: { slowPerLevel: 0.08, durationPerLevel: 0.4 },
  fishyFortune: { fishPerLevel: 0.2 },
} as const;

const pct = (x: number) => `${Math.round(x * 100)}%`;

export const SKILLS: Record<SkillId, SkillDef> = {
  sharpClaws: {
    id: 'sharpClaws',
    name: 'Sharp Claws',
    icon: '🗡️',
    tier: 'improved',
    maxLevel: 5,
    describe: (l) => `All cats deal +${pct(SKILL_VALUES.sharpClaws.damagePerLevel * l)} damage.`,
  },
  catnipRush: {
    id: 'catnipRush',
    name: 'Catnip Rush',
    icon: '🌿',
    tier: 'improved',
    maxLevel: 5,
    describe: (l) => `All cats attack ${pct(SKILL_VALUES.catnipRush.speedPerLevel * l)} faster.`,
  },
  keenEyes: {
    id: 'keenEyes',
    name: 'Keen Eyes',
    icon: '👀',
    tier: 'basic',
    maxLevel: 4,
    describe: (l) => `All cats get +${pct(SKILL_VALUES.keenEyes.rangePerLevel * l)} range.`,
  },
  bellySlam: {
    id: 'bellySlam',
    name: 'Belly Slam',
    icon: '💥',
    tier: 'improved',
    maxLevel: 4,
    requiresCat: 'orange',
    describe: (l) =>
      `Orange slams: +${pct(SKILL_VALUES.bellySlam.splashPerLevel * l)} splash size, +${pct(
        SKILL_VALUES.bellySlam.damagePerLevel * l,
      )} damage.`,
  },
  flurryPaws: {
    id: 'flurryPaws',
    name: 'Flurry Paws',
    icon: '👊',
    tier: 'basic',
    maxLevel: 3,
    requiresCat: 'tabby',
    describe: (l) => `Tabby combos hit +${SKILL_VALUES.flurryPaws.hitsPerLevel * l} extra time(s).`,
  },
  armorBreak: {
    id: 'armorBreak',
    name: 'Armor Break',
    icon: '🔨',
    tier: 'improved',
    maxLevel: 3,
    describe: (l) => `Enemies lose ${SKILL_VALUES.armorBreak.armorPerLevel * l} armor.`,
  },
  dazzlingGrace: {
    id: 'dazzlingGrace',
    name: 'Dazzling Grace',
    icon: '💖',
    tier: 'basic',
    maxLevel: 3,
    requiresCat: 'white',
    describe: (l) =>
      `White cat slows +${pct(SKILL_VALUES.dazzlingGrace.slowPerLevel * l)} more, lasting +${(
        SKILL_VALUES.dazzlingGrace.durationPerLevel * l
      ).toFixed(1)}s.`,
  },
  fishyFortune: {
    id: 'fishyFortune',
    name: 'Fishy Fortune',
    icon: '🐟',
    tier: 'basic',
    maxLevel: 3,
    describe: (l) => `+${pct(SKILL_VALUES.fishyFortune.fishPerLevel * l)} dried fish from enemies.`,
  },
};

export const SKILL_ORDER: SkillId[] = [
  'sharpClaws',
  'catnipRush',
  'keenEyes',
  'armorBreak',
  'bellySlam',
  'flurryPaws',
  'dazzlingGrace',
  'fishyFortune',
];
