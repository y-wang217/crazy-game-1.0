// Shared type definitions for content (config) and simulation.

export type CatId =
  // the original five (owned from the start)
  | 'kitten'
  | 'tabby'
  | 'orange'
  | 'black'
  | 'white'
  // recruitable / chapter-reward cats
  | 'whiskers'
  | 'sable'
  | 'mallow'
  | 'pounce'
  | 'devil';
export type AttackKind = 'projectile' | 'combo' | 'slam' | 'snipe' | 'aura' | 'ricochet' | 'pierce' | 'support' | 'execute' | 'poison';
export type TargetMode = 'first' | 'nearest' | 'strongest' | 'weakest' | 'treasure';
export type EnemyId = 'normal' | 'fast' | 'armored' | 'shielded' | 'boss' | 'mushroomKing' | 'moonEmperor' | 'brute' | 'ironclad' | 'thief' | 'captain';

/** Elite enemy roles: rare, visually distinct, each a focused tactical threat. */
export type EliteRole = 'hp' | 'armor' | 'fast' | 'escort';
export type ChestTier = 'bronze' | 'silver' | 'gold';
export type SkillId =
  // general
  | 'sharpClaws'
  | 'catnipRush'
  | 'armorBreak'
  | 'fishyFortune'
  // kitten
  | 'bravePaws'
  | 'explorerEyes'
  | 'zoomies'
  // tabby
  | 'flurryPaws'
  | 'quickJabs'
  | 'championPunch'
  // orange
  | 'bigBelly'
  | 'bellySlam'
  | 'aftershock'
  // black
  | 'steadyAim'
  | 'deadeye'
  | 'longScope'
  // white
  | 'dazzlingGrace'
  | 'lingeringCharm'
  | 'radiantBeauty'
  // whiskers
  | 'encore'
  | 'stageMagic'
  // sable
  | 'keenEdge'
  | 'swiftDraw'
  // mallow
  | 'warmHeart'
  | 'biggerBell'
  // pounce
  | 'sharpInstinct'
  | 'rooftopSprint'
  // devil
  | 'potentBrew'
  | 'lingeringVenom';

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
  /** Seconds between the individual punches of a combo (real hit timing). */
  comboGap?: number;
  /**
   * Seconds of wind-up / aiming before the hit lands (Orange slam, Black Cat shot).
   * Damage happens at the end, so the animation and the mechanic match.
   */
  windup?: number;
  splashRadius?: number;
  /** Fraction of damage dealt to secondary splash targets. */
  splashRatio?: number;
  slowStrength?: number;
  slowDuration?: number;
  /** Extra slow applied to the cat's focused target (white cat). */
  focusBonus?: number;
  projectileSpeed?: number;
  // ---- Ricochet (Mr. Whiskers) ----
  /** Extra enemies the projectile jumps to after the first hit. */
  bounces?: number;
  /** Max distance (px) from one bounce target to the next. */
  bounceRange?: number;
  /** Damage multiplier applied on every bounce (0.7 = −30% per jump). */
  bounceFalloff?: number;
  // ---- Pierce (Sir Sable) ----
  /** Half-width (px) of the straight sword wave. */
  pierceWidth?: number;
  /** Wave length as a multiple of range. */
  pierceLength?: number;
  // ---- Support (Captain Mallow) ----
  /** Attack-speed buff given to allies in range (0.2 = +20%). */
  buffSpeed?: number;
  buffDuration?: number;
  // ---- Execute (Shadow Pounce) ----
  /** HP fraction below which hits are empowered. */
  executeThreshold?: number;
  executeMult?: number;
  // ---- Poison (Silver Devil) ----
  /** Poison damage per second at Lv.1 (scales with level like damage). */
  poisonDps?: number;
  poisonDuration?: number;
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
  /** Elite enemy (gold crown + ring). The role says what makes it a threat. */
  elite?: EliteRole;
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

/** Per-level skill effect (fractions are additive per level, e.g. dmg 0.25 = +25%/level). */
export interface SkillEffect {
  dmg?: number;
  speed?: number;
  range?: number;
  combo?: number;
  splash?: number;
  splashRatio?: number;
  slow?: number;
  slowDur?: number;
  armor?: number;
  fish?: number;
  /** Extra ricochet bounces (flat). */
  bounce?: number;
  /** Support buff strength (fraction, additive). */
  buff?: number;
  /** Execute threshold (fraction, additive). */
  execute?: number;
  /** Poison damage (fraction). */
  poison?: number;
  /** Poison duration (seconds). */
  poisonDur?: number;
}

export interface SkillDef {
  id: SkillId;
  icon: string;
  tier: 'basic' | 'improved';
  maxLevel: number;
  /** Effect per level. */
  per: SkillEffect;
  /** If set, only this cat type benefits (and it is only offered if the cat is in the roster). */
  cat?: CatId;
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
  /** Visual environment (palette overrides + decorations). Defaults to 'forest'. */
  environment?: 'forest' | 'mushroom';
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
  /** A mini-boss stage (a boss mid-chapter that is not the chapter finale). */
  miniBoss?: boolean;
  /** Cats already on the board when the stage starts (free; used by tutorials). */
  startCats?: StartCat[];
  /** Per-wave HP growth inside this stage (defaults to BALANCE.waveHpGrowth). */
  waveHpGrowth?: number;
  /** 1-based position across ALL chapters (filled in by chapters.ts). Drives unlocks & chest scaling. */
  order?: number;
  /** Flat armor added to every mouse that already has armor (later chapters). */
  armorBonus?: number;
  /** Chest HP multiplier; defaults to 1 + BALANCE.chest.hpPerStage × (order − 1). */
  chestHpScale?: number;
  /**
   * Tutorial stages (1-1 … 1-6) introduce cats in a set order and always use `roster`.
   * Every other stage summons from the player's selected battle team instead.
   */
  fixedRoster?: boolean;
}

export interface ChapterDef {
  id: string;
  number: number;
  name: string;
  mapId: string;
  stages: StageDef[];
}

/** Combat bonus of a Special Skin (one stat, a few percent). */
export interface SkinBonus {
  stat: 'damage' | 'attackSpeed' | 'range';
  /** Percent, e.g. 3 = +3%. */
  pct: number;
}

export interface CosmeticDef {
  id: string;
  name: string;
  slot: 'hat' | 'skin';
  /**
   * Skins only. 'regular' (普通造型) = looks only, no stats — every hat and every skin sold
   * before V1.4 is regular and stays that way. 'special' (特殊造型) = looks + `bonus`.
   */
  kind?: 'regular' | 'special';
  /** Special skins: the exact combat bonus for that cat species. */
  bonus?: SkinBonus;
  /** Special skins: sparkle colour drawn on the cat so it reads as special. */
  glint?: string;
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
