import { BALANCE } from '../config/balance';
import { SKILLS } from '../config/skills';
import type { CatDef, CatId, SkillId } from './types';

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

/** Multipliers / bonuses for one cat type (or for all cats). */
export interface CatMods {
  dmg: number;
  speed: number;
  range: number;
  combo: number;
  splash: number;
  splashRatio: number;
  slow: number;
  slowDur: number;
}

export interface SkillMods {
  /** Applies to every cat. */
  all: CatMods;
  /** Applies only to that cat type (stacks multiplicatively with `all`). */
  cat: Record<CatId, CatMods>;
  armorReduce: number;
  fishMult: number;
}

const neutralCat = (): CatMods => ({ dmg: 1, speed: 1, range: 1, combo: 0, splash: 1, splashRatio: 0, slow: 0, slowDur: 0 });

export function computeSkillMods(skills: Partial<Record<SkillId, number>>): SkillMods {
  const mods: SkillMods = {
    all: neutralCat(),
    cat: { kitten: neutralCat(), tabby: neutralCat(), orange: neutralCat(), black: neutralCat(), white: neutralCat() },
    armorReduce: 0,
    fishMult: 1,
  };
  for (const [id, lv] of Object.entries(skills) as [SkillId, number][]) {
    if (!lv) continue;
    const def = SKILLS[id];
    const m = def.cat ? mods.cat[def.cat] : mods.all;
    const p = def.per;
    if (p.dmg) m.dmg += p.dmg * lv;
    if (p.speed) m.speed += p.speed * lv;
    if (p.range) m.range += p.range * lv;
    if (p.combo) m.combo += p.combo * lv;
    if (p.splash) m.splash += p.splash * lv;
    if (p.splashRatio) m.splashRatio += p.splashRatio * lv;
    if (p.slow) m.slow += p.slow * lv;
    if (p.slowDur) m.slowDur += p.slowDur * lv;
    if (p.armor) mods.armorReduce += p.armor * lv;
    if (p.fish) mods.fishMult += p.fish * lv;
  }
  return mods;
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
  const a = mods.all;
  const c = mods.cat[def.id];
  const damage = def.damage * L.damageMult[li] * a.dmg * c.dmg;
  const range = def.range * (1 + L.rangePerLevel * up) * a.range * c.range;
  const interval = def.interval / ((1 + L.speedPerLevel * up) * a.speed * c.speed);
  const slowStrength = Math.min(BALANCE.slowCap, (def.slowStrength ?? 0) + L.slowPerLevel * up + c.slow);
  return {
    damage,
    range,
    interval,
    comboHits: (def.comboHits ?? 1) + c.combo,
    splashRadius: (def.splashRadius ?? 0) * c.splash,
    splashRatio: Math.min(1, (def.splashRatio ?? 0) + (def.splashRatio ? c.splashRatio : 0)),
    slowStrength,
    slowDuration: (def.slowDuration ?? 0) + c.slowDur,
    focusBonus: def.focusBonus ?? 0,
  };
}
