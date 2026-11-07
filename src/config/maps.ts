import type { MapDef, TileDef } from '../game/types';

// Tiles are identified as "col-row". Every stage in a chapter picks a subset.
const t = (c: number, r: number): TileDef => ({ id: `${c}-${r}`, c, r });

/**
 * Beginner Forest: 7 x 11 grid, 50px cells (350 x 550 world px).
 * The road snakes through the map in an S:
 *   row 1 (left→right), down col 5, row 4 (right→left),
 *   down col 1, row 7 (left→right), down col 5 into the cat house.
 */
export const FOREST_MAP: MapDef = {
  id: 'forest',
  name: 'Beginner Forest',
  cols: 7,
  rows: 11,
  cell: 50,
  path: [
    [-0.9, 1],
    [5, 1],
    [5, 4],
    [1, 4],
    [1, 7],
    [5, 7],
    [5, 9.7],
  ],
  base: [5, 10],
  tiles: [
    // Band A — between the 1st and 2nd road passes
    t(1, 2), t(2, 2), t(3, 2), t(4, 2),
    t(1, 3), t(2, 3), t(3, 3), t(4, 3),
    t(6, 2), t(6, 3),
    // Band B — between the 2nd and 3rd passes
    t(0, 5), t(0, 6),
    t(2, 5), t(3, 5), t(4, 5), t(5, 5),
    t(2, 6), t(3, 6), t(4, 6), t(5, 6),
    // Band C — beside the final stretch
    t(1, 8), t(2, 8), t(3, 8), t(4, 8),
    t(1, 9), t(2, 9), t(3, 9), t(4, 9),
    t(6, 8), t(6, 9),
  ],
  theme: {
    grass: '#c4e4a2',
    grassDark: '#acd68a',
    road: '#f0dcae',
    roadEdge: '#cfae74',
  },
};

export const MAPS: Record<string, MapDef> = {
  forest: FOREST_MAP,
};
