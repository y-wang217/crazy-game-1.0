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

/**
 * Compact Beginner Forest (Chapter 1): 5 x 8 grid, 50px cells (250 x 400 world px).
 * About half the old footprint, so on a phone every cell, cat and mouse renders
 * ~40% larger. Same S-route concept with three passes:
 *   row 0 (left→right), down col 3, row 3 (right→left),
 *   down col 1, row 6 (left→right), down col 3 into the cat house.
 */
export const FOREST_COMPACT_MAP: MapDef = {
  id: 'forest_compact',
  name: 'Beginner Forest',
  cols: 5,
  rows: 8,
  cell: 50,
  path: [
    [-0.9, 0],
    [3, 0],
    [3, 3],
    [1, 3],
    [1, 6],
    [3, 6],
    [3, 6.75],
  ],
  base: [3, 7],
  tiles: [
    // Between the 1st and 2nd passes
    t(0, 1), t(1, 1), t(2, 1), t(4, 1),
    t(0, 2), t(1, 2), t(2, 2), t(4, 2),
    t(0, 3), t(4, 3),
    // Between the 2nd and 3rd passes
    t(0, 4), t(2, 4), t(3, 4), t(4, 4),
    t(0, 5), t(2, 5), t(3, 5), t(4, 5),
    // Beside the final stretch
    t(0, 6), t(4, 6),
    t(0, 7), t(1, 7), t(2, 7), t(4, 7),
  ],
  theme: FOREST_MAP.theme,
};

/**
 * Moonlit Mushroom Forest (Chapter 2): same 5 x 8 portrait grid, but the road
 * enters from the TOP and spirals inward to a cat house in the middle of a
 * mushroom ring:
 *   down col 0, right along row 6, up col 4, left along row 1, down col 2 to the house.
 * The inner columns (1 and 3) sit between two or three road passes, so a few
 * well-placed, well-merged cats matter more than filling every tile.
 */
export const MUSHROOM_MAP: MapDef = {
  id: 'mushroom',
  name: 'Moonlit Mushroom Forest',
  cols: 5,
  rows: 8,
  cell: 50,
  path: [
    [0, -0.9],
    [0, 6],
    [4, 6],
    [4, 1],
    [2, 1],
    [2, 3.75],
  ],
  base: [2, 4],
  environment: 'mushroom',
  tiles: [
    // Inner ring, left: between the first descent and the final approach
    t(1, 1), t(1, 2), t(1, 3), t(1, 4), t(1, 5),
    // Inner ring, right: between the final approach and the climb
    t(3, 2), t(3, 3), t(3, 4), t(3, 5),
    // Under the cat house
    t(2, 5),
    // Top edge (beside the entrance and the upper pass)
    t(1, 0), t(2, 0), t(3, 0),
    // Bottom edge (below the long bottom pass)
    t(1, 7), t(2, 7), t(3, 7),
  ],
  theme: {
    grass: '#b8dcb4',
    grassDark: '#a2cc9e',
    road: '#e8d4c0',
    roadEdge: '#bfa08a',
  },
};

export const MAPS: Record<string, MapDef> = {
  forest: FOREST_MAP,
  forest_compact: FOREST_COMPACT_MAP,
  mushroom: MUSHROOM_MAP,
};
