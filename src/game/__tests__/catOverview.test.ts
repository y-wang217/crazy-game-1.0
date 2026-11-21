import { CATS, CAT_ORDER } from "../../config/cats";
import {
  DAMAGE_RATING,
  combatOverview,
  reachRating,
  utilityRating,
} from "../../config/catOverview";
import { en } from "../../i18n/en";
import { zh } from "../../i18n/zh";
import type { CatId } from "../types";
import { ARMOR, BIG, FAST, GROUP, SPARSE, SPREAD, run } from "./catBenchmark";

// The Encyclopedia's combat-overview meters must come from real combat data.
const avgDamage: Record<string, number> = {};
const table: string[] = [];

describe("combat overview meters (Intro tab)", () => {
  beforeAll(() => {
    for (const c of CAT_ORDER) {
      const d = [GROUP, SPREAD, FAST, ARMOR, BIG].map(
        (s) => run([c], s).damage,
      );
      avgDamage[c] = d.reduce((a, b) => a + b, 0) / d.length;
    }
    for (const c of CAT_ORDER) {
      const o = combatOverview(c, 1);
      table.push(
        `${c.padEnd(9)} avg dmg ${avgDamage[c].toFixed(0).padStart(4)} (×${(avgDamage[c] / avgDamage.kitten).toFixed(2)} Kitten) → D${o.damage} U${o.utility} R${o.reach}  (range ${(CATS[c].range / 50).toFixed(2)}t, ${CATS[c].attack})`,
      );
    }
    console.log("\n" + table.join("\n"));
  });

  it("Damage = round(3 × average benchmark damage ÷ Kitten), capped at 5 — matches the stored table", () => {
    for (const c of CAT_ORDER) {
      const measured = Math.min(
        5,
        Math.round((3 * avgDamage[c]) / avgDamage.kitten),
      );
      expect([c, DAMAGE_RATING[c]]).toEqual([c, measured]);
    }
  });

  it("reflects each cat’s real strengths", () => {
    const o = (c: CatId, s = 1) => combatOverview(c, s);
    // Noble White and Captain Mallow deal no damage but are the team-utility cats.
    for (const c of ["white", "mallow"] as CatId[]) {
      expect(o(c).damage).toBe(0);
      expect(o(c).utility).toBe(5);
    }
    // Chubby Orange: top damage, from crowds (its group result is far above every other cat).
    expect(o("orange").damage).toBe(5);
    // Black Cat: heavy hits + the longest range.
    expect(o("black").damage).toBeGreaterThanOrEqual(4);
    expect(o("black").reach).toBe(5);
    for (const c of CAT_ORDER)
      if (c !== "black") expect(o(c).reach).toBeLessThan(5);
    // Sir Sable above the Kitten (his line hits several mice); Tabby / Shadow Pounce short reach.
    expect(o("sable").damage).toBeGreaterThan(o("kitten").damage);
    expect(o("tabby").reach).toBe(1);
    expect(o("pounce").reach).toBe(1);
    // Range is not area: Orange's reach comes partly from its area slam, Black's only from range.
    expect(reachRating("orange")).toBeLessThan(reachRating("black"));
  });

  it("utility only counts unlocked team abilities", () => {
    expect(utilityRating("orange", 2)).toBe(0);
    expect(utilityRating("orange", 3)).toBe(1); // Aftershock: slammed mice take more damage
    expect(utilityRating("sable", 3)).toBe(1); // armor shred
    expect(utilityRating("devil", 4)).toBe(0);
    expect(utilityRating("devil", 5)).toBe(1); // mark: allies deal more damage
    expect(utilityRating("black", 5)).toBe(0); // armor piercing helps only itself
    for (const c of ["kitten", "tabby", "whiskers", "pounce"] as CatId[])
      expect(utilityRating(c, 5)).toBe(0);
  });

  it("the utility cats really help in the engine", () => {
    // White: more mice die inside a damage cat's zone when she slows them.
    let alone = 0;
    let withWhite = 0;
    for (const c of ["kitten", "tabby", "orange", "black"] as CatId[]) {
      alone += run([c], SPARSE).kills;
      withWhite += run([c, "white"], SPARSE).kills;
    }
    expect(withWhite).toBeGreaterThan(alone);
    // Mallow: her bell raises a teammate's damage output.
    const solo = run(["kitten"], SPREAD).damage;
    const rung = run(["kitten", "mallow"], SPREAD).damage;
    expect(rung).toBeGreaterThan(solo);
  });

  it("every cat has an intro, a best-against line and a signature line in both languages", () => {
    for (const c of CAT_ORDER)
      for (const k of [
        `cat.${c}.intro`,
        `cat.${c}.bestAt`,
        `cat.${c}.sigShort`,
      ]) {
        expect(en[k]?.length ?? 0).toBeGreaterThan(0);
        expect(zh[k]?.length ?? 0).toBeGreaterThan(0);
      }
  });
});
