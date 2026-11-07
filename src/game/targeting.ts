import type { TargetMode } from './types';

export interface TargetCandidate {
  uid: number;
  kind: 'enemy' | 'chest';
  x: number;
  y: number;
  hp: number;
  shield: number;
  /** Distance travelled along the path (higher = closer to the exit). */
  dist: number;
  alive: boolean;
}

/**
 * Pick a target within range according to the cat's priority.
 * - Non-treasure modes prefer enemies; chests are only hit when no enemy is in range.
 * - Treasure prefers chests (furthest along first); falls back to First.
 */
export function selectTarget<T extends TargetCandidate>(
  cx: number,
  cy: number,
  range: number,
  mode: TargetMode,
  candidates: readonly T[],
): T | null {
  const r2 = range * range;
  const enemies: T[] = [];
  const chests: T[] = [];
  for (const c of candidates) {
    if (!c.alive) continue;
    const dx = c.x - cx;
    const dy = c.y - cy;
    if (dx * dx + dy * dy > r2) continue;
    (c.kind === 'chest' ? chests : enemies).push(c);
  }

  if (mode === 'treasure') {
    if (chests.length) return pickBy(chests, 'first', cx, cy);
    mode = 'first';
  }
  const pool = enemies.length ? enemies : chests;
  if (!pool.length) return null;
  return pickBy(pool, mode, cx, cy);
}

function pickBy<T extends TargetCandidate>(pool: T[], mode: TargetMode, cx: number, cy: number): T {
  let best = pool[0];
  let bestScore = score(best, mode, cx, cy);
  for (let i = 1; i < pool.length; i++) {
    const s = score(pool[i], mode, cx, cy);
    if (s > bestScore) {
      best = pool[i];
      bestScore = s;
    }
  }
  return best;
}

/** Higher score wins. Ties are broken by path progress. */
function score(c: TargetCandidate, mode: TargetMode, cx: number, cy: number): number {
  const tiebreak = c.dist * 1e-6;
  switch (mode) {
    case 'first':
    case 'treasure':
      return c.dist;
    case 'nearest':
      return -Math.hypot(c.x - cx, c.y - cy) + tiebreak;
    case 'strongest':
      return c.hp + c.shield + tiebreak;
    case 'weakest':
      return -(c.hp + c.shield) + tiebreak;
  }
}

export function nextTargetMode(mode: TargetMode, order: readonly TargetMode[]): TargetMode {
  const i = order.indexOf(mode);
  return order[(i + 1) % order.length];
}
