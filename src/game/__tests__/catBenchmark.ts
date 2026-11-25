import { CHAPTERS } from "../../config/chapters";
import { MAPS } from "../../config/maps";
import { Battle } from "../battle";
import type { CatId, EnemyId, StageDef } from "../types";

// Shared Lv.1 benchmark (used by catIdentity.test.ts and introStats.test.ts): each cat alone (or
// paired) on the same tile against identical scripted waves, in the real battle engine.
const map = MAPS[CHAPTERS[0].mapId];
const TILE = "2-2"; // covers the first two road passes

export function scenario(
  enemy: EnemyId,
  count: number,
  interval: number,
  hpScale = 1,
): StageDef {
  return {
    ...CHAPTERS[0].stages[0],
    id: "test",
    tiles: map.tiles.map((t) => t.id),
    roster: ["kitten"],
    hpScale,
    waveHpGrowth: 0,
    waves: [{ groups: [{ enemy, count, interval }] }],
  };
}

export interface Run {
  kills: number;
  escaped: number;
  damage: number;
  attacks: number;
  slamHits: number;
}

export function run(cats: CatId[], s: StageDef): Run {
  const b = new Battle(s, map, 1);
  b.startBattle();
  const tiles = [TILE, "2-1", "1-2"];
  cats.forEach((c, i) => b.placeCat(c, 1, tiles[i]));
  let attacks = 0;
  for (let i = 0; i < 4000 && b.status === "playing"; i++) {
    const before = b.cats.map((c) => c.attackAt);
    b.update(0.05);
    b.cats.forEach((c, k) => {
      if (c.attackAt !== before[k]) attacks++;
    });
  }
  return {
    kills: b.stats.kills,
    escaped: b.stats.escaped,
    damage: b.stats.damageDealt,
    attacks,
    slamHits: b.stats.slamHits,
  };
}

export const GROUP = scenario("normal", 12, 0.25, 2.5); // a tight pack of tough mice
export const SPREAD = scenario("normal", 10, 2.5, 1.5); // ordinary mice arriving one by one
export const FAST = scenario("fast", 12, 1.2, 2); // spread-out runners
export const ARMOR = scenario("armored", 8, 1.5, 1); // armored knights
export const BIG = scenario("normal", 1, 1, 15); // one very high-HP mouse
export const SPARSE = scenario("normal", 8, 10, 2.2); // mice far apart: each must die inside the cat's zone
