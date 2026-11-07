import { Battle, canMerge } from './battle';
import type { MapDef, StageDef } from './types';

/**
 * A simple autoplayer used for headless balance checks. It is deliberately naive:
 * it never repositions cats or changes targeting, so real players should do better.
 */
export function runBot(
  stage: StageDef,
  map: MapDef,
  seed: number,
  opts: { smartPlacement?: boolean } = {},
): { win: boolean; baseHp: number; time: number; summons: number; skills: number; topLevel: number } {
  const b = new Battle(stage, map, seed);
  const tick = 0.25;
  const coverage = opts.smartPlacement ? tileCoverage(b) : null;
  let guard = 0;
  while ((b.status === 'playing' || b.status === 'reward') && guard++ < 20000) {
    if (b.status === 'reward') {
      b.chooseReward(0);
      continue;
    }
    // Summon when possible; merge lowest pair when the board is full.
    if (b.emptyTiles().length === 0) mergeLowest(b);
    if (b.emptyTiles().length && b.fish >= b.summonCost) b.summon();
    else if (!b.emptyTiles().length && b.fish >= b.skillCost) b.buySkill();
    else if (b.fish >= b.skillCost + b.summonCost * 2) b.buySkill();
    if (coverage) relocateBest(b, coverage);
    b.update(tick);
  }
  return {
    win: b.status === 'victory',
    baseHp: b.baseHp,
    time: b.time,
    summons: b.summons,
    skills: Object.values(b.skills).reduce((a, v) => a + (v ?? 0), 0),
    topLevel: Math.max(0, ...b.cats.map((c) => c.level)),
  };
}

function mergeLowest(b: Battle): boolean {
  const cats = [...b.cats].sort((x, y) => x.level - y.level);
  for (let i = 0; i < cats.length; i++) {
    for (let j = i + 1; j < cats.length; j++) {
      if (canMerge(cats[i], cats[j])) {
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

/** Move the highest-level cat into the best empty tile if it improves coverage. */
function relocateBest(b: Battle, cov: Map<string, number>): void {
  const empty = b.emptyTiles().sort((x, y) => (cov.get(y.id) ?? 0) - (cov.get(x.id) ?? 0));
  if (!empty.length) return;
  const cats = [...b.cats].sort((x, y) => y.level - x.level);
  for (const c of cats) {
    if ((cov.get(empty[0].id) ?? 0) > (cov.get(c.tileId) ?? 0) + 20) {
      b.dropCat(c.uid, empty[0].id);
      return;
    }
  }
}
