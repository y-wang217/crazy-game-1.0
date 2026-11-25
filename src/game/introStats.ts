import { CATS } from "../config/cats";
import { getCatStats } from "./combat";
import type { CatId } from "./types";

// Encyclopedia Intro tab (V1.6.4): a cat's real base numbers, read from the engine — the same
// getCatStats the battle uses — at the cat's permanent ★ rank and in-battle Lv.1, with no chest
// skills, skins or temporary buffs. Replaces the 0–5 rating meters, which playtesting found unclear.

/** World pixels per board tile. */
export const TILE_PX = 50;

export type IntroStatKey =
  | "damage"
  | "attackSpeed"
  | "range"
  | "every"
  | "slow"
  | "auraRadius"
  | "buff"
  | "supportRange"
  | "area"
  | "line"
  | "bounce"
  | "execute"
  | "poison"
  | "aim";

export interface IntroStat {
  key: IntroStatKey;
  /** i18n params for `introStat.<key>.value`. */
  params: Record<string, string | number>;
  /** The cat's defining number (shown highlighted). */
  signature?: boolean;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const r1 = (n: number) => Math.round(n * 10) / 10;
const tiles = (px: number) => r2(px / TILE_PX);
const pct = (f: number) => Math.round(f * 100);

export function introStats(cat: CatId, star: number): IntroStat[] {
  const def = CATS[cat];
  const st = getCatStats(def, 1, undefined, star);
  const perSec = r2(1 / st.interval);
  const damage: IntroStat =
    st.comboHits > 1
      ? { key: "damage", params: { v: r1(st.damage), hits: st.comboHits } }
      : { key: "damage", params: { v: r1(st.damage) } };
  switch (def.attack) {
    // Support and control: no direct damage, but a clearly shown effect, radius and rhythm.
    case "aura":
      return [
        { key: "damage", params: { v: 0 } },
        {
          key: "slow",
          params: { p: pct(st.slowStrength), s: r1(st.slowDuration) },
          signature: true,
        },
        { key: "auraRadius", params: { v: tiles(st.range) } },
        { key: "every", params: { s: r1(st.interval) } },
      ];
    case "support":
      return [
        { key: "damage", params: { v: 0 } },
        {
          key: "buff",
          params: { p: pct(st.buffSpeed), s: r1(st.buffDuration) },
          signature: true,
        },
        { key: "supportRange", params: { v: tiles(st.range) } },
        { key: "every", params: { s: r1(st.interval) } },
      ];
  }
  const base: IntroStat[] = [
    damage,
    { key: "attackSpeed", params: { v: perSec } },
    { key: "range", params: { v: tiles(st.range) } },
  ];
  switch (def.attack) {
    case "slam":
      return [
        ...base,
        {
          key: "area",
          params: { v: tiles(st.splashRadius), p: pct(st.splashRatio) },
          signature: true,
        },
      ];
    case "pierce":
      return [
        ...base,
        { key: "line", params: { v: tiles(st.pierceLength) }, signature: true },
      ];
    case "ricochet":
      return [
        ...base,
        {
          key: "bounce",
          params: { n: st.bounces, p: pct(1 - st.bounceFalloff) },
          signature: true,
        },
      ];
    case "execute":
      return [
        ...base,
        {
          key: "execute",
          params: { p: pct(st.executeThreshold), x: r1(st.executeMult) },
          signature: true,
        },
      ];
    case "poison":
      return [
        ...base,
        {
          key: "poison",
          params: { v: r1(st.poisonDps), s: r1(st.poisonDuration) },
          signature: true,
        },
      ];
    case "snipe":
      return [...base, { key: "aim", params: { s: r1(def.windup ?? 0) } }];
    default:
      return base;
  }
}
