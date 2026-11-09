import type { Tuning } from '../config/debug';
import { Battle, canMerge } from './battle';
import { Rng } from './rng';
import type { CatId, MapDef, SkinBonus, StageDef } from './types';

export interface BotResult {
  win: boolean;
  baseHp: number;
  time: number;
  summons: number;
  merges: number;
  skills: number;
  cats: number;
  topLevel: number;
  waveReached: number;
  chestsOpened: number;
  chestsMissed: number;
  /** Persistent fish coins from chests this battle (kept even on defeat). */
  chestCoins: number;
}

/**
 * A simple autoplayer used for headless balance checks. The naive version never
 * repositions cats or changes targeting, so real players should do better.
 * `smart` moves its strongest cats onto the tiles that cover the most road.
 */
export function runBot(
  stage: StageDef,
  map: MapDef,
  seed: number,
  opts: {
    smart?: boolean;
    tuning?: Partial<Tuning>;
    stars?: Partial<Record<CatId, number>>;
    roster?: CatId[];
    skinBonus?: Partial<Record<CatId, SkinBonus>>;
    /** Never merge above this level (measures how much a stage depends on reaching Lv.5). */
    levelCap?: number;
  } = {},
): BotResult {
  const cap = opts.levelCap ?? 99;
  const b = new Battle(stage, map, {
    seed,
    tuning: opts.tuning as Tuning | undefined,
    stars: opts.stars,
    roster: opts.roster,
    skinBonus: opts.skinBonus,
  });
  const tick = 0.25;
  const coverage = opts.smart ? tileCoverage(b) : null;
  // Preparation: summon what we can afford, then start right away.
  while (b.emptyTiles().length && b.fish >= b.summonCost) b.summon();
  b.startBattle();
  let guard = 0;
  while ((b.status === 'playing' || b.status === 'reward') && guard++ < 40000) {
    if (b.status === 'reward') {
      b.chooseReward(0);
      continue;
    }
    if (b.emptyTiles().length === 0) mergeLowest(b, cap);
    else if (opts.smart && b.emptyTiles().length <= 2) mergeLowest(b, cap);
    if (b.emptyTiles().length && b.fish >= b.summonCost) b.summon();
    else if (b.skillShopUnlocked && b.fish >= b.skillCost && (!b.emptyTiles().length || b.fish >= b.skillCost + b.summonCost)) b.buySkill();
    if (coverage) relocateBest(b, coverage);
    b.update(tick);
  }
  return {
    win: b.status === 'victory',
    baseHp: b.baseHp,
    time: b.time,
    summons: b.stats.summons,
    merges: b.stats.merges,
    skills: Object.values(b.skills).reduce((a, v) => a + (v ?? 0), 0),
    cats: b.cats.length,
    topLevel: Math.max(0, ...b.cats.map((c) => c.level)),
    waveReached: b.waveIndex + 1,
    chestsOpened: b.stats.chestsOpened,
    chestsMissed: b.stats.chestsMissed,
    chestCoins: b.chestCoins,
  };
}

function mergeLowest(b: Battle, cap = 99): boolean {
  const cats = [...b.cats].sort((x, y) => x.level - y.level);
  for (let i = 0; i < cats.length; i++) {
    for (let j = i + 1; j < cats.length; j++) {
      if (canMerge(cats[i], cats[j]) && cats[i].level < cap) {
        b.dropCat(cats[i].uid, cats[j].tileId);
        return true;
      }
    }
  }
  return false;
}

/** Path length (px) within ~80px of each tile: a proxy for how valuable a spot is. */
function tileCoverage(b: Battle): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of b.tiles) {
    let n = 0;
    for (let d = 0; d < b.path.length; d += 5) {
      const p = b.path.pointAt(d);
      if (Math.hypot(p.x - t.x, p.y - t.y) < 80) n += 5;
    }
    m.set(t.id, n);
  }
  return m;
}

/** Swap the strongest cat onto the best-covering tile it isn't on yet. */
function relocateBest(b: Battle, cov: Map<string, number>): void {
  const tiles = b.tiles.filter((t) => t.unlocked).sort((x, y) => (cov.get(y.id) ?? 0) - (cov.get(x.id) ?? 0));
  const cats = [...b.cats].sort((x, y) => y.level - x.level || (x.type === 'white' ? 1 : -1));
  for (let i = 0; i < Math.min(cats.length, tiles.length); i++) {
    const c = cats[i];
    const want = tiles[i];
    if (c.tileId === want.id) continue;
    const occ = b.catAt(want.id);
    if (occ && occ.level >= c.level) continue;
    b.dropCat(c.uid, want.id);
    return;
  }
}

/**
 * A FIRST-TIME player, for checking beginner stages (much weaker than runBot):
 * - slow: one decision every 1.5–3.5 s of game time (≈ real seconds at 1× speed);
 * - summons when it can, but often forgets to merge (only notices a pair ~35% of the time,
 *   ~65% when the board is full and the game says so), and merges a random pair, not the best;
 * - never repositions cats, never changes targeting, ignores tap-to-focus;
 * - picks chest rewards at random and rarely buys skills;
 * - spends only part of its starting fish during the preparation phase.
 * Everything random comes from `seed`, so "unlucky summon" runs are part of the sample.
 */
export function runBeginnerBot(
  stage: StageDef,
  map: MapDef,
  seed: number,
  opts: {
    roster?: CatId[];
    tuning?: Partial<Tuning>;
    stars?: Partial<Record<CatId, number>>;
    /** A struggling player: slower (2.5–5 s per decision) and merges even less. */
    struggling?: boolean;
  } = {},
): BotResult {
  const b = new Battle(stage, map, { seed, tuning: opts.tuning as Tuning | undefined, roster: opts.roster, stars: opts.stars });
  const [react, spread, mergeP, mergeFullP] = opts.struggling ? [2.5, 2.5, 0.2, 0.45] : [1.5, 2, 0.35, 0.65];
  const r = new Rng(seed * 7919 + 17);
  const mergeRandom = () => {
    const pairs: [number, string][] = [];
    for (const x of b.cats) for (const y of b.cats) if (x.uid < y.uid && canMerge(x, y)) pairs.push([x.uid, y.tileId]);
    if (!pairs.length) return false;
    const [uid, tile] = r.pick(pairs);
    b.dropCat(uid, tile);
    return true;
  };
  // Preparation: a few summons (not necessarily all the fish), then start.
  const prepSummons = r.int(3, 6);
  for (let i = 0; i < prepSummons && b.emptyTiles().length && b.fish >= b.summonCost; i++) b.summon();
  b.startBattle();
  let next = r.next() * 2;
  let guard = 0;
  while ((b.status === 'playing' || b.status === 'reward') && guard++ < 60000) {
    if (b.status === 'reward') {
      b.chooseReward(r.int(0, 2));
      continue;
    }
    if (b.time >= next) {
      next = b.time + react + r.next() * spread;
      const full = b.emptyTiles().length === 0;
      if (r.next() < (full ? mergeFullP : mergeP)) mergeRandom();
      if (b.emptyTiles().length && b.fish >= b.summonCost && r.next() < 0.8) b.summon();
      else if (b.skillShopUnlocked && b.fish >= b.skillCost + b.summonCost && r.next() < 0.25) b.buySkill();
    }
    b.update(0.1);
  }
  return {
    win: b.status === 'victory',
    baseHp: b.baseHp,
    time: b.time,
    summons: b.stats.summons,
    merges: b.stats.merges,
    skills: Object.values(b.skills).reduce((a, v) => a + (v ?? 0), 0),
    cats: b.cats.length,
    topLevel: Math.max(0, ...b.cats.map((c) => c.level)),
    waveReached: b.waveIndex + 1,
    chestsOpened: b.stats.chestsOpened,
    chestsMissed: b.stats.chestsMissed,
    chestCoins: b.chestCoins,
  };
}
