import type { CatId } from "../game/types";
import { CATS } from "./cats";
import { CAT_CLASSES, tagsAt, type SkillTag } from "./catClasses";

// Encyclopedia Intro tab — "Combat overview" meters (0–5). Display data only: nothing here
// changes combat. Each meter has ONE documented source so the numbers stay honest:
//
// • Damage (輸出): the real battle engine's Lv.1 benchmark (catBenchmark.ts) — each cat alone on
//   the same tile against five identical scripted waves (a tight pack, mice one by one, fast
//   runners, armored knights, one huge mouse). Rating = round(3 × cat's average damage ÷ the
//   Kitten's), capped at 5, so 3 = Kitten level. catOverview.test.ts re-runs the benchmark and
//   fails if this table no longer matches the engine.
// • Team Utility (團隊作用): slowing, buffs and debuffs that help OTHER cats. Controller / Support
//   cats are built around it (5); every unlocked team effect from a 3★/5★ ability adds 1. Locked
//   ones never count. The test also measures White's slow and Mallow's bell in the engine.
// • Reach (攻擊覆蓋): Lv.1 range in tiles (<1.3 → 1, <1.75 → 2, <2.5 → 3, <3 → 4, else 5), +1 when
//   one attack can affect several mice / allies at once (area, line, bounce, aura, team buff).
//   Range and area are kept apart in the text ("Best against" and the signature line).

/** Measured Damage ratings (see the note above; verified by catOverview.test.ts). */
export const DAMAGE_RATING: Record<CatId, number> = {
  kitten: 3,
  tabby: 3,
  orange: 5,
  black: 5,
  white: 0,
  whiskers: 3,
  sable: 4,
  mallow: 0,
  pounce: 2,
  devil: 3,
};

/** 3★ / 5★ ability tags that help the whole team (a debuff on mice or a buff on allies). */
export const TEAM_TAGS: SkillTag[] = [
  "vulnerable",
  "armorShred",
  "mark",
  "damageBuff",
];

const MULTI = new Set(["slam", "pierce", "ricochet", "aura", "support"]);

export function utilityRating(cat: CatId, stars: number): number {
  const arch = CAT_CLASSES[cat].archetype;
  const base = arch === "controller" || arch === "support" ? 5 : 0;
  const extra = tagsAt(cat, stars).filter(
    (t) => t.star && t.active && TEAM_TAGS.includes(t.id),
  ).length;
  return Math.min(5, base + extra);
}

export function reachRating(cat: CatId): number {
  const tiles = CATS[cat].range / 50;
  const r =
    tiles < 1.3 ? 1 : tiles < 1.75 ? 2 : tiles < 2.5 ? 3 : tiles < 3 ? 4 : 5;
  return Math.min(5, r + (MULTI.has(CATS[cat].attack) ? 1 : 0));
}

export interface CombatOverview {
  damage: number;
  utility: number;
  reach: number;
}

/** The three meters for this cat at its permanent star rank. */
export function combatOverview(cat: CatId, stars: number): CombatOverview {
  return {
    damage: DAMAGE_RATING[cat],
    utility: utilityRating(cat, stars),
    reach: reachRating(cat),
  };
}
