import type { CatId, StageDef } from '../types';

// Realistic teams for balance checks (shared by progression.sim and balance.sim).
// Sized against the coin income measured by economy.sim (~1,000 coins at the start of Chapter 2,
// ~3,000 by 2-10, ~4,700 by 2-16, ~6,300 by 2-20) and the can schedule (2 cans at 2-5, the first
// draw is guaranteed new). Recruits are never a specific cat: R1 rotates over Mr. Whiskers,
// Captain Mallow and Shadow Pounce by seed.
export const STARTERS: CatId[] = ['kitten', 'tabby', 'orange', 'black', 'white'];
const RECRUITS: CatId[] = ['whiskers', 'mallow', 'pounce'];

export type Band = 0 | 1 | 2 | 3; // 2-1…2-5, 2-6…2-10, 2-11…2-15, 2-16…2-20
export const band = (s: StageDef): Band => Math.min(3, Math.floor((s.number - 1) / 5)) as Band;

/** Team (5 species) and star ranks for a developed profile at this Chapter 2 band. */
export function developed(kind: 'average' | 'experienced', b: Band, seed: number): { roster: CatId[]; stars: Partial<Record<CatId, number>> } {
  const r1 = RECRUITS[seed % 3];
  const roster: CatId[] = b === 0 ? ['kitten', 'orange', 'black', 'white', 'sable'] : [r1, 'orange', 'black', 'white', 'sable'];
  const s = (base: number, ups: Partial<Record<CatId, number>>) => Object.fromEntries(roster.map((c) => [c, ups[c] ?? base]));
  const stars =
    kind === 'average'
      ? [s(1, { black: 2 }), s(1, { orange: 2, black: 2, sable: 2 }), s(2, { black: 3 }), s(2, { black: 3, orange: 3 })][b]
      : [s(1, { orange: 2, black: 2, sable: 2 }), s(2, { black: 3 }), s(2, { black: 3, orange: 3, sable: 3 }), s(3, { [r1]: 2 })][b];
  return { roster, stars };
}
