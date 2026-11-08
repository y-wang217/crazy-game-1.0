// Battlefield (canvas) colors per visual theme. UI colors live in styles.css tokens.
// Keep path vs. buildable tile contrast high in every theme.

export interface BoardPalette {
  grass: string;
  grassChecker: string;
  tuft: string;
  road: string;
  roadEdge: string;
  roadDash: string;
  chevron: string;
  pebble: string;
  tileFill: string;
  /** Lighter centre of buildable tiles (a soft "spotlight" so dark cats stay readable). */
  tileGlow: string;
  tileBorder: string;
  tilePaw: string;
  lockedFill: string;
  lockedBorder: string;
  lockIcon: string;
  treeGreens: string[];
  trunk: string;
  treeHighlight: string;
  mushroomCaps: string[];
  mushroomStem: string;
  flowers: string[];
  burrowOuter: string;
  burrowInner: string;
  houseWall: string;
  houseWallEdge: string;
  houseRoof: string;
  houseRoofEdge: string;
  houseDoor: string;
  houseWindow: string;
  /** Banner behind canvas text (e.g. "First wave in 3…"). */
  bannerBg: string;
  bannerText: string;
  /** Range ring fill. */
  rangeFill: string;
  /** Optional atmosphere. */
  lanterns: boolean;
  fireflies: boolean;
  moon: boolean;
}

export const BOARD_PALETTES: Record<'light' | 'moonlit', BoardPalette> = {
  // The original cute daytime forest.
  light: {
    grass: '#c4e4a2',
    grassChecker: 'rgba(255,255,255,0.07)',
    tuft: '#acd68a',
    road: '#f0dcae',
    roadEdge: '#cfae74',
    roadDash: 'rgba(200,160,100,0.35)',
    chevron: 'rgba(170,120,60,0.4)',
    pebble: 'rgba(180,140,90,0.35)',
    tileFill: '#f5edd3',
    tileGlow: '#fbf6e6',
    tileBorder: '#d5bf8c',
    tilePaw: 'rgba(210,185,130,0.45)',
    lockedFill: 'rgba(90,110,70,0.16)',
    lockedBorder: 'rgba(90,110,70,0.45)',
    lockIcon: 'rgba(90,100,80,0.55)',
    treeGreens: ['#6ab04a', '#7cc05a', '#5a9a40'],
    trunk: '#9a6a42',
    treeHighlight: 'rgba(255,255,255,0.18)',
    mushroomCaps: ['#e85a4a', '#f0a040'],
    mushroomStem: '#f6eedc',
    flowers: ['#ffffff', '#ffd0e0', '#fff0a0', '#c8d8ff'],
    burrowOuter: '#8a6a48',
    burrowInner: '#3a2a1e',
    houseWall: '#fff4dc',
    houseWallEdge: '#a07a50',
    houseRoof: '#e8706a',
    houseRoofEdge: '#9a3a3a',
    houseDoor: '#8a5a3a',
    houseWindow: '#a8d8f0',
    bannerBg: 'rgba(60,50,40,0.6)',
    bannerText: '#ffffff',
    rangeFill: 'rgba(255,255,255,0.12)',
    lanterns: false,
    fireflies: false,
    moon: false,
  },
  // Dark cute / cozy gothic: moonlit fairy-tale forest. Midnight blue, plum, deep sage,
  // antique gold and cream — never pure black, never neon.
  moonlit: {
    grass: '#34463f',
    grassChecker: 'rgba(160,190,200,0.05)',
    tuft: '#4b6458',
    road: '#b9a684',
    roadEdge: '#7d6a4c',
    roadDash: 'rgba(90,70,45,0.35)',
    chevron: 'rgba(90,70,45,0.45)',
    pebble: 'rgba(110,90,60,0.4)',
    tileFill: '#5d5679',
    tileGlow: '#8a83a8',
    tileBorder: '#d9ad72',
    tilePaw: 'rgba(245,233,213,0.18)',
    lockedFill: 'rgba(20,18,36,0.28)',
    lockedBorder: 'rgba(180,170,210,0.3)',
    lockIcon: 'rgba(200,190,225,0.4)',
    treeGreens: ['#2f4a45', '#3a5752', '#294039'],
    trunk: '#4a3a3e',
    treeHighlight: 'rgba(210,225,255,0.14)',
    mushroomCaps: ['#b58ad6', '#7fc8c0'],
    mushroomStem: '#e8dcc8',
    flowers: ['#f5e9d5', '#c9b4e8', '#d9ad72', '#9fd0e0'],
    burrowOuter: '#4a3d4e',
    burrowInner: '#17141f',
    houseWall: '#e9dcc4',
    houseWallEdge: '#6b5a48',
    houseRoof: '#6d5590',
    houseRoofEdge: '#3e2f58',
    houseDoor: '#4a3a3e',
    houseWindow: '#ffd88a',
    bannerBg: 'rgba(37,36,57,0.82)',
    bannerText: '#f5e9d5',
    rangeFill: 'rgba(245,233,213,0.1)',
    lanterns: true,
    fireflies: true,
    moon: true,
  },
};
