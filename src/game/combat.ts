import { BALANCE } from '../config/balance';
import { STARS } from '../config/collection';
import { CAT_ORDER } from '../config/cats';
import { SKILLS } from '../config/skills';
import type { CatDef, CatId, SkillId, SkinBonus } from './types';

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
export function applyDamageToPools(hp: number, shield: number, dmg: number): { hp: number; shield: number; dealt: number } {
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
  bounce: number;
  buff: number;
  execute: number;
  poison: number;
  poisonDur: number;
}

export interface SkillMods {
  /** Applies to every cat. */
  all: CatMods;
  /** Applies only to that cat type (stacks multiplicatively with `all`). */
  cat: Record<CatId, CatMods>;
  armorReduce: number;
  fishMult: number;
}

const neutralCat = (): CatMods => ({
  dmg: 1,
  speed: 1,
  range: 1,
  combo: 0,
  splash: 1,
  splashRatio: 0,
  slow: 0,
  slowDur: 0,
  bounce: 0,
  buff: 0,
  execute: 0,
  poison: 1,
  poisonDur: 0,
});

export function computeSkillMods(skills: Partial<Record<SkillId, number>>): SkillMods {
  const mods: SkillMods = {
    all: neutralCat(),
    cat: Object.fromEntries(CAT_ORDER.map((id) => [id, neutralCat()])) as Record<CatId, CatMods>,
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
    if (p.bounce) m.bounce += p.bounce * lv;
    if (p.buff) m.buff += p.buff * lv;
    if (p.execute) m.execute += p.execute * lv;
    if (p.poison) m.poison += p.poison * lv;
    if (p.poisonDur) m.poisonDur += p.poisonDur * lv;
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
  /** Ricochet: extra targets after the first hit, jump distance and per-jump falloff. */
  bounces: number;
  bounceRange: number;
  bounceFalloff: number;
  /** Pierce: half-width and length (px) of the sword wave. */
  pierceWidth: number;
  pierceLength: number;
  /** Support: attack-speed buff given to allies and its duration. */
  buffSpeed: number;
  buffDuration: number;
  /** Execute: HP threshold and damage multiplier below it. */
  executeThreshold: number;
  executeMult: number;
  /** Poison: damage per second and duration. */
  poisonDps: number;
  poisonDuration: number;
  /** Permanent star rank these stats were computed with. */
  star: number;
}

/**
 * Effective stats for a cat: in-battle level (Lv.1–5, from merging) × permanent star rank
 * (1★–5★, from the collection) × this battle's skills. The two progressions are separate:
 * `level` resets every battle, `star` never does.
 */
/**
 * Special-skin bonus (one stat, a few percent). Applied once per unit on top of level, star and
 * skills; one skin per species, so bonuses never stack.
 */
export function applySkinBonus(st: CatStats, bonus: SkinBonus | undefined): CatStats {
  if (!bonus || !(bonus.pct > 0)) return st;
  const k = 1 + bonus.pct / 100;
  if (bonus.stat === 'damage') return { ...st, damage: st.damage * k, poisonDps: st.poisonDps * k };
  if (bonus.stat === 'attackSpeed') return { ...st, interval: st.interval / k };
  return { ...st, range: st.range * k };
}

export function getCatStats(def: CatDef, level: number, mods: SkillMods = NO_MODS, star = 1): CatStats {
  const L = BALANCE.levels;
  const li = Math.max(0, Math.min(L.damageMult.length - 1, level - 1));
  const si = Math.max(0, Math.min(STARS.max - 1, star - 1));
  const up = level - 1;
  const a = mods.all;
  const c = mods.cat[def.id];
  const lvDmg = L.damageMult[li] * STARS.damageMult[si];
  const damage = def.damage * lvDmg * a.dmg * c.dmg;
  const range = def.range * (1 + L.rangePerLevel * up) * a.range * c.range;
  const interval = def.interval / ((1 + L.speedPerLevel * up) * a.speed * c.speed * STARS.speedMult[si]);
  const support = STARS.supportMult[si];
  const slowStrength = Math.min(BALANCE.slowCap, ((def.slowStrength ?? 0) + L.slowPerLevel * up + c.slow) * (def.slowStrength ? support : 1));
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
    bounces: (def.bounces ?? 0) + c.bounce,
    bounceRange: (def.bounceRange ?? 0) * (1 + L.rangePerLevel * up),
    bounceFalloff: def.bounceFalloff ?? 0,
    pierceWidth: def.pierceWidth ?? 0,
    pierceLength: range * (def.pierceLength ?? 0),
    buffSpeed: def.buffSpeed ? (def.buffSpeed + 0.04 * up + c.buff) * support : 0,
    buffDuration: def.buffDuration ?? 0,
    executeThreshold: def.executeThreshold ? Math.min(0.7, def.executeThreshold + c.execute) : 0,
    executeMult: def.executeMult ?? 1,
    poisonDps: (def.poisonDps ?? 0) * lvDmg * a.dmg * c.poison,
    poisonDuration: (def.poisonDuration ?? 0) + c.poisonDur,
    star: si + 1,
  };
}
