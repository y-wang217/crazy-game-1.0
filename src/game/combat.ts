import { BALANCE } from '../config/balance';
import { SKILL_VALUES } from '../config/skills';
import type { CatDef, SkillId } from './types';

/**
 * Physical damage formula (one rule for everything):
 *   effectiveArmor = max(0, armor - armorReduction)
 *   damage = max(raw - effectiveArmor, raw * minDamageRatio)
 * So armor subtracts a flat amount per hit, but at least 20% always gets through.
 * Many small hits (tabby combos) suffer most against armor; big hits barely notice it.
 */
export function computeDamage(raw: number, armor: number, armorReduction = 0): number {
  if (raw <= 0) return 0;
  const eff = Math.max(0, armor - armorReduction);
  return Math.max(raw - eff, raw * BALANCE.minDamageRatio);
}

/** Damage applied to shield first, then HP. Returns the new values. */
export function applyDamageToPools(
  hp: number,
  shield: number,
  dmg: number,
): { hp: number; shield: number; dealt: number } {
  let remaining = dmg;
  let s = shield;
  if (s > 0) {
    const absorbed = Math.min(s, remaining);
    s -= absorbed;
    remaining -= absorbed;
  }
  const h = Math.max(0, hp - remaining);
  return { hp: h, shield: s, dealt: dmg };
}

export interface SkillMods {
  damageMult: number;
  attackSpeedMult: number;
  rangeMult: number;
  splashMult: number;
  slamDamageMult: number;
  comboExtra: number;
  armorReduce: number;
  slowBonus: number;
  slowDurationBonus: number;
  fishMult: number;
}

export function computeSkillMods(skills: Partial<Record<SkillId, number>>): SkillMods {
  const lv = (id: SkillId) => skills[id] ?? 0;
  const V = SKILL_VALUES;
  return {
    damageMult: 1 + V.sharpClaws.damagePerLevel * lv('sharpClaws'),
    attackSpeedMult: 1 + V.catnipRush.speedPerLevel * lv('catnipRush'),
    rangeMult: 1 + V.keenEyes.rangePerLevel * lv('keenEyes'),
    splashMult: 1 + V.bellySlam.splashPerLevel * lv('bellySlam'),
    slamDamageMult: 1 + V.bellySlam.damagePerLevel * lv('bellySlam'),
    comboExtra: V.flurryPaws.hitsPerLevel * lv('flurryPaws'),
    armorReduce: V.armorBreak.armorPerLevel * lv('armorBreak'),
    slowBonus: V.dazzlingGrace.slowPerLevel * lv('dazzlingGrace'),
    slowDurationBonus: V.dazzlingGrace.durationPerLevel * lv('dazzlingGrace'),
    fishMult: 1 + V.fishyFortune.fishPerLevel * lv('fishyFortune'),
  };
}

export const NO_MODS: SkillMods = computeSkillMods({});

export interface CatStats {
  damage: number;
  range: number;
  interval: number;
  comboHits: number;
  splashRadius: number;
  splashRatio: number;
  slowStrength: number;
  slowDuration: number;
  focusBonus: number;
}

/** Effective stats for a cat of a given level with current skill modifiers. */
export function getCatStats(def: CatDef, level: number, mods: SkillMods = NO_MODS): CatStats {
  const L = BALANCE.levels;
  const li = Math.max(0, Math.min(L.damageMult.length - 1, level - 1));
  const up = level - 1;
  let damage = def.damage * L.damageMult[li] * mods.damageMult;
  if (def.attack === 'slam') damage *= mods.slamDamageMult;
  const range = def.range * (1 + L.rangePerLevel * up) * mods.rangeMult;
  const interval = def.interval / ((1 + L.speedPerLevel * up) * mods.attackSpeedMult);
  const slowStrength = Math.min(
    BALANCE.slowCap,
    (def.slowStrength ?? 0) + L.slowPerLevel * up + (def.attack === 'aura' ? mods.slowBonus : 0),
  );
  return {
    damage,
    range,
    interval,
    comboHits: (def.comboHits ?? 1) + (def.attack === 'combo' ? mods.comboExtra : 0),
    splashRadius: (def.splashRadius ?? 0) * mods.splashMult,
    splashRatio: def.splashRatio ?? 0,
    slowStrength,
    slowDuration: (def.slowDuration ?? 0) + (def.attack === 'aura' ? mods.slowDurationBonus : 0),
    focusBonus: def.focusBonus ?? 0,
  };
}
