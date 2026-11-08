// Shared type definitions for content (config) and simulation.

export type CatId = 'kitten' | 'tabby' | 'orange' | 'black' | 'white';
export type AttackKind = 'projectile' | 'combo' | 'slam' | 'snipe' | 'aura';
export type TargetMode = 'first' | 'nearest' | 'strongest' | 'weakest' | 'treasure';
export type EnemyId = 'normal' | 'fast' | 'armored' | 'shielded' | 'boss';
export type ChestTier = 'bronze' | 'silver' | 'gold';
export type SkillId =
  | 'sharpClaws'
  | 'catnipRush'
  | 'keenEyes'
  | 'bellySlam'
  | 'flurryPaws'
  | 'armorBreak'
  | 'dazzlingGrace'
  | 'fishyFortune';

export interface CatPalette {
  body: string;
  belly: string;
  earInner: string;
  stripe: string;
  eye: string;
  outline: string;
}

export interface CatDef {
  id: CatId;
  name: string;
  title: string;
  personality: string;
  role: string;
  attack: AttackKind;
  /** Damage per hit at Lv.1 (0 for pure support). */
  damage: number;
  /** Attack range in world pixels (1 tile = 50px). */
  range: number;
  /** Seconds between attacks at Lv.1. */
  interval: number;
  comboHits?: number;
  splashRadius?: number;
  /** Fraction of damage dealt to secondary splash targets. */
  splashRatio?: number;
  slowStrength?: number;
  slowDuration?: number;
  /** Extra slow applied to the cat's focused target (white cat). */
  focusBonus?: number;
  projectileSpeed?: number;
  /** Relative sprite scale. */
  scale: number;
  palette: CatPalette;
}

export interface EnemyDef {
  id: EnemyId;
  name: string;
  hp: number;
  shield: number;
  armor: number;
  /** World pixels per second. */
  speed: number;
  /** Dried fish awarded on defeat. */
  reward: number;
  /** Base HP lost if this enemy escapes. */
  baseDamage: number;
  radius: number;
  isBoss?: boolean;
}

export interface ChestDef {
  tier: ChestTier;
  name: string;
  hp: number;
  speed: number;
  coins: [number, number];
  /** Skill-level bonus granted by choices from this chest. */
  levelsPerPick: number;
  /** Weight of 'basic' vs 'improved' skill tiers in this chest's pool. */
  tierWeights: { basic: number; improved: number };
  radius: number;
}

export interface SkillDef {
  id: SkillId;
  name: string;
  icon: string;
  tier: 'basic' | 'improved';
  maxLevel: number;
  /** Only offered if this cat is in the stage roster. */
  requiresCat?: CatId;
}

export interface TileDef {
  id: string;
  c: number;
  r: number;
}

export interface MapDef {
  id: string;
  name: string;
  cols: number;
  rows: number;
  cell: number;
  /** Path waypoints in cell units (cell centre = integer coordinate). */
  path: [number, number][];
  /** Every tile that *could* exist on this map; stages pick a subset. */
  tiles: TileDef[];
  /** Where the base/house is drawn (cell units). */
  base: [number, number];
  theme: {
    grass: string;
    grassDark: string;
    road: string;
    roadEdge: string;
  };
}

export type SpawnGroup =
  | { enemy: EnemyId; count: number; interval: number; delay?: number }
  | { chest: ChestTier; delay?: number };

export interface WaveDef {
  groups: SpawnGroup[];
}

export interface StartCat {
  type: CatId;
  level: number;
  tile: string;
}

export interface StageDef {
  id: string;
  number: number;
  /** Stage names live in the i18n dictionaries under `stage.<id>`. */
  roster: CatId[];
  tiles: string[];
  startFish: number;
  baseHp: number;
  /** Multiplier for enemy & chest HP / shield. */
  hpScale: number;
  waves: WaveDef[];
  rewards: { firstClear: number; replay: number };
  isBoss?: boolean;
  /** Cats already on the board when the stage starts (free; used by tutorials). */
  startCats?: StartCat[];
  /** Per-wave HP growth inside this stage (defaults to BALANCE.waveHpGrowth). */
  waveHpGrowth?: number;
}

export interface ChapterDef {
  id: string;
  number: number;
  name: string;
  mapId: string;
  stages: StageDef[];
}

export interface CosmeticDef {
  id: string;
  name: string;
  slot: 'hat' | 'skin';
  /** For skins: which cat it recolours. */
  cat?: CatId;
  price: number;
  description: string;
  /** For skins: palette override. */
  palette?: Partial<CatPalette>;
}

export interface CosmeticLoadout {
  hat: string | null;
  skins: Partial<Record<CatId, string>>;
}
