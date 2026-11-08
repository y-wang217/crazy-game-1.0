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

export const SKILLS: Record<SkillId, SkillDef> = {
  sharpClaws: {
    id: 'sharpClaws',
    name: 'Sharp Claws',
    icon: '🗡️',
    tier: 'improved',
    maxLevel: 5,
  },
  catnipRush: {
    id: 'catnipRush',
    name: 'Catnip Rush',
    icon: '🌿',
    tier: 'improved',
    maxLevel: 5,
  },
  keenEyes: {
    id: 'keenEyes',
    name: 'Keen Eyes',
    icon: '👀',
    tier: 'basic',
    maxLevel: 4,
  },
  bellySlam: {
    id: 'bellySlam',
    name: 'Belly Slam',
    icon: '💥',
    tier: 'improved',
    maxLevel: 4,
    requiresCat: 'orange',
  },
  flurryPaws: {
    id: 'flurryPaws',
    name: 'Flurry Paws',
    icon: '👊',
    tier: 'basic',
    maxLevel: 3,
    requiresCat: 'tabby',
  },
  armorBreak: {
    id: 'armorBreak',
    name: 'Armor Break',
    icon: '🔨',
    tier: 'improved',
    maxLevel: 3,
  },
  dazzlingGrace: {
    id: 'dazzlingGrace',
    name: 'Dazzling Grace',
    icon: '💖',
    tier: 'basic',
    maxLevel: 3,
    requiresCat: 'white',
  },
  fishyFortune: {
    id: 'fishyFortune',
    name: 'Fishy Fortune',
    icon: '🐟',
    tier: 'basic',
    maxLevel: 3,
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

const pct = (x: number) => Math.round(x * 100);

/** Numbers for a skill's localized description at a given level (`skill.<id>.desc`). */
export function skillParams(id: SkillId, level: number): Record<string, number | string> {
  const V = SKILL_VALUES;
  switch (id) {
    case 'sharpClaws':
      return { a: pct(V.sharpClaws.damagePerLevel * level) };
    case 'catnipRush':
      return { a: pct(V.catnipRush.speedPerLevel * level) };
    case 'keenEyes':
      return { a: pct(V.keenEyes.rangePerLevel * level) };
    case 'bellySlam':
      return { a: pct(V.bellySlam.splashPerLevel * level), b: pct(V.bellySlam.damagePerLevel * level) };
    case 'flurryPaws':
      return { a: V.flurryPaws.hitsPerLevel * level };
    case 'armorBreak':
      return { a: V.armorBreak.armorPerLevel * level };
    case 'dazzlingGrace':
      return { a: pct(V.dazzlingGrace.slowPerLevel * level), b: (V.dazzlingGrace.durationPerLevel * level).toFixed(1) };
    case 'fishyFortune':
      return { a: pct(V.fishyFortune.fishPerLevel * level) };
  }
}
