import { BALANCE, skillRollCost, summonCost } from '../config/balance';
import { CATS, TARGET_MODES } from '../config/cats';
import { ABILITIES, POISON_BOSS_MULT, STARS, ULTIMATE } from '../config/collection';
import { NEUTRAL_TUNING, type Tuning } from '../config/debug';
import { CHESTS, ENEMIES } from '../config/enemies';
import { SKILLS, SKILL_ORDER, SKILL_WEIGHTS } from '../config/skills';
import { applyDamageToPools, applySkinBonus, computeDamage, computeSkillMods, getCatStats, type CatStats, type SkillMods } from './combat';
import { PathGeom, cellCenter } from './path';
import { Rng } from './rng';
import { nextTargetMode, selectTarget, type TargetCandidate } from './targeting';
import type { CatId, ChestTier, EnemyId, MapDef, SkillId, SkinBonus, SpawnGroup, StageDef, TargetMode } from './types';

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

export interface CatUnit {
  uid: number;
  type: CatId;
  level: number;
  tileId: string;
  x: number;
  y: number;
  mode: TargetMode;
  cooldown: number;
  // Visual timestamps on the visual clock (battle.vtime); renderer derives animation from these.
  spawnAt: number;
  mergeAt: number;
  attackAt: number;
  modeAt: number;
  movedAt: number;
  /** Last time a skill upgrade affected this cat (visual). */
  buffAt: number;
  /** Wind-up in progress (sim time): Orange slam or Black Cat aim. */
  windup: { start: number; fireAt: number; targetUid: number; x: number; y: number } | null;
  /** Pending combo punches (sim time). */
  comboQueue: { at: number; targetUid: number; mult?: number }[];
  /** Counts punches (alternates paws in the animation). */
  comboIndex: number;
  aimX: number;
  aimY: number;
  /** Attacks made (drives "every Nth attack" specials). */
  attackCount: number;
  /** Timed actions: ultimate volleys / strikes / telegraphed slashes (sim time). */
  queue: CatAction[];
  /** Attack-speed and damage buffs from Captain Mallow (sim time; never stack, the stronger wins). */
  buffSpeed: number;
  buffSpeedUntil: number;
  buffDmg: number;
  buffDmgUntil: number;
  /** Shadow Pounce 3★: next strike empowered; cooldown until. */
  empowered: boolean;
  specialReadyAt: number;
  /** Silver Devil 3★: last mouse this cat poisoned (consecutive hits stack). */
  lastHitUid: number;
  /** Visual: last time this cat performed its ultimate. */
  ultAt: number;
}

export type CatAction =
  | { at: number; kind: 'shot'; mult: number }
  | { at: number; kind: 'strike'; mult: number; hpBelow: number }
  | { at: number; kind: 'slash'; dx: number; dy: number; mult: number; length: number; width: number }
  | { at: number; kind: 'bigSlam'; x: number; y: number; targetUid: number }
  | { at: number; kind: 'bigShot'; targetUid: number };

export interface Foe extends TargetCandidate {
  defId: EnemyId | ChestTier;
  maxHp: number;
  maxShield: number;
  armor: number;
  speed: number;
  reward: number;
  baseDamage: number;
  radius: number;
  isBoss: boolean;
  wave: number;
  slowT: number;
  slowStrength: number;
  hitAt: number;
  dirX: number;
  bornAt: number;
  rewarded: boolean;
  /** Walk-cycle phase; advances with actual movement so slowed mice visibly walk slower. */
  walk: number;
  /** Last time Noble White charmed this foe (visual). */
  charmedAt: number;
  /** Poison (Silver Devil): damage per second per stack, expiry, stack count. */
  poisonDps: number;
  poisonUntil: number;
  poisonStacks: number;
  /** Poison damage not yet shown as a number. */
  poisonShown: number;
  /** Devil's Pact mark (sim time). */
  markUntil: number;
  /** Sir Sable 3★: temporary armor reduction. */
  shred: number;
  shredUntil: number;
  /** Chubby Orange 3★: takes extra damage. */
  vulnerable: number;
  vulnUntil: number;
  /** Moonshadow Emperor: its veil already regrew (the second phase happens once). */
  phased?: boolean;
}

export interface Projectile {
  uid: number;
  x: number;
  y: number;
  targetUid: number;
  tx: number;
  ty: number;
  damage: number;
  speed: number;
  style: 'yarn' | 'bullet' | 'magic' | 'venom';
  done: boolean;
  /** Visual size multiplier (empowered / ultimate shots). */
  size?: number;
  /** Permanent star rank of the shooter (attack effects evolve with stars). */
  star?: number;
  /** Ricochet: remaining jumps, falloff, max jump distance and mice already hit. */
  bounce?: { left: number; falloff: number; range: number; hit: number[] };
  /** Poison applied on hit. */
  poison?: { dps: number; dur: number; maxStacks: number; srcUid: number };
  /** Fraction of armor ignored (Black Cat 3★). */
  armorIgnore?: number;
}

export type Effect =
  | { kind: 'ring'; x: number; y: number; r0: number; r1: number; color: string; born: number; dur: number; width?: number }
  | {
      kind: 'text';
      x: number;
      y: number;
      text: string;
      color: string;
      size: number;
      born: number;
      dur: number;
      stroke?: string;
      /** If set, the renderer shows the localized label for this target mode instead of `text`. */
      mode?: TargetMode;
      /** If set, the renderer shows this cat's localized ultimate name instead of `text`. */
      ult?: CatId;
    }
  | { kind: 'slash'; x1: number; y1: number; x2: number; y2: number; width: number; color: string; born: number; dur: number; star: number }
  | { kind: 'telegraph'; x1: number; y1: number; x2: number; y2: number; width: number; color: string; born: number; dur: number }
  | { kind: 'claw'; x: number; y: number; rot: number; color: string; born: number; dur: number; big?: boolean }
  | { kind: 'bell'; x: number; y: number; born: number; dur: number; big?: boolean }
  | {
      kind: 'particles';
      x: number;
      y: number;
      parts: { vx: number; vy: number; color: string; size: number }[];
      born: number;
      dur: number;
      gravity?: number;
    }
  | { kind: 'pow'; x: number; y: number; rot: number; born: number; dur: number }
  | { kind: 'hearts'; x: number; y: number; born: number; dur: number }
  | { kind: 'beam'; x: number; y: number; born: number; dur: number; color: string }
  | { kind: 'shake'; x: number; y: number; born: number; dur: number; amp: number }
  | { kind: 'sparkle'; x: number; y: number; born: number; dur: number };

export type BattleStatus = 'playing' | 'paused' | 'reward' | 'victory' | 'defeat';

export interface SkillChoice {
  skillId: SkillId;
  levels: number;
}

export interface RewardOffer {
  id: number;
  tier: ChestTier;
  coins: number;
  choices: SkillChoice[];
}

/** Events are data only; the UI decides how (and in which language) to present them. */
export type BattleEvent =
  | { type: 'coins'; amount: number; tier: ChestTier }
  | { type: 'skill'; skillId: SkillId; level: number; isNew: boolean; source: 'shop' | 'chest' }
  | { type: 'wave'; wave: number; total: number }
  | { type: 'waveCleared'; wave: number; bonus: number }
  | { type: 'chestAppeared'; tier: ChestTier }
  | { type: 'chestEscaped' }
  | { type: 'bossAppeared'; enemy: EnemyId }
  | { type: 'eliteAppeared'; enemy: EnemyId }
  | { type: 'bossPhase'; enemy: EnemyId }
  | { type: 'bossDefeated'; enemy: EnemyId }
  | { type: 'maxedChestFish'; fish: number }
  | { type: 'ultimate'; cat: CatId }
  | { type: 'victory' }
  | { type: 'defeat' };

/** Error reasons are i18n keys under `err.*`. */
export type ActionError = 'notNow' | 'boardFull' | 'noFish' | 'skillsMaxed' | 'skillLocked' | 'locked' | 'maxLevel';

export interface TileState {
  id: string;
  c: number;
  r: number;
  x: number;
  y: number;
  unlocked: boolean;
}

export type ActionResult = { ok: true } | { ok: false; reason: ActionError };
export type DropKind = 'moved' | 'swapped' | 'merged' | 'cancel';
export type DropResult = { result: DropKind; reason?: ActionError };

export interface BattleStats {
  summons: number;
  merges: number;
  swaps: number;
  moves: number;
  targetChanges: number;
  skillsBought: number;
  skillsFromChests: number;
  fishEarned: number;
  fishSpent: number;
  kills: number;
  escaped: number;
  chestsOpened: number;
  chestsMissed: number;
  /** Total mice hit by Orange slams (shows area value in debug stats). */
  slamHits: number;
  /** Damage actually removed from enemies/chests (excludes overkill). */
  damageDealt: number;
  sells: number;
  /** Times the player used Tactical Pause (the menu doesn't count). */
  tacticalPauses: number;
}

export interface BattleOptions {
  seed?: number;
  tuning?: Tuning;
  /**
   * Cat species random summons pick from. Defaults to the stage roster; the UI passes the
   * player's battle team (except on fixed-roster tutorial stages).
   */
  roster?: CatId[];
  /** Permanent star rank per species (default 1★). */
  stars?: Partial<Record<CatId, number>>;
  /** Encyclopedia demo: no waves, no win/lose. */
  sandbox?: boolean;
  /** Scales the ultimate cooldown (demo only). */
  ultCooldownMult?: number;
  /** Equipped special skins: one small bonus per species (see config/cosmetics skinBonusesFor). */
  skinBonus?: Partial<Record<CatId, SkinBonus>>;
}

/** Pure merge rule, exported for tests and UI highlighting. */
export function canMerge(a: Pick<CatUnit, 'uid' | 'type' | 'level'>, b: Pick<CatUnit, 'uid' | 'type' | 'level'>): boolean {
  return a.uid !== b.uid && a.type === b.type && a.level === b.level && a.level < BALANCE.levels.maxLevel;
}

const STEP = 1 / 60;

/** Bump when the snapshot layout changes; older snapshots are then discarded, never misread. */
export const SNAPSHOT_VERSION = 1;

export interface BattleSnapshot {
  v: typeof SNAPSHOT_VERSION;
  stageId: string;
  waves: number;
  opts: {
    tuning: Tuning;
    roster: CatId[];
    stars: Partial<Record<CatId, number>>;
    ultCooldownMult: number;
    /** Added in V1.4 (absent in older snapshots = no skin bonuses). */
    skinBonus?: Partial<Record<CatId, SkinBonus>>;
  };
  state: Record<string, unknown>;
}

/** Battle fields saved in a snapshot (all plain data). Visual-only state is left out. */
const SNAPSHOT_FIELDS = [
  'nextUid',
  'nextOfferId',
  'status',
  'time',
  'vtime',
  'fish',
  'baseHp',
  'cats',
  'foes',
  'projectiles',
  'skills',
  'summons',
  'skillRolls',
  'chestCoins',
  'stats',
  'waveIndex',
  'preparing',
  'prepLeft',
  'waveTimer',
  'gapTimer',
  'clearTimer',
  'spawnQueue',
  'spawnPtr',
  'waveSpawnDone',
  'waveBonusGiven',
  'rewardQueue',
  'focusUid',
  'ultCharge',
  'teamBuff',
  'mallowSpecialReadyAt',
] as const;

const structuredCloneJson = <T>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isArr = Array.isArray;

/** Strict sanity check of a stored snapshot against the current stage and map. */
export function validateSnapshot(snap: unknown, stage: StageDef, map: MapDef): snap is BattleSnapshot {
  const s = snap as BattleSnapshot | null;
  if (!s || typeof s !== 'object' || s.v !== SNAPSHOT_VERSION || s.stageId !== stage.id || s.waves !== stage.waves.length) return false;
  const o = s.opts;
  if (!o || !isArr(o.roster) || !o.roster.length || !o.roster.every((c) => c in CATS) || typeof o.stars !== 'object' || !isNum(o.ultCooldownMult))
    return false;
  if (o.skinBonus !== undefined) {
    if (!o.skinBonus || typeof o.skinBonus !== 'object') return false;
    for (const [cat, sb] of Object.entries(o.skinBonus)) {
      if (!(cat in CATS) || !sb || !['damage', 'attackSpeed', 'range'].includes(sb.stat) || !isNum(sb.pct) || sb.pct < 0 || sb.pct > 10) return false;
    }
  }
  const st = s.state as Record<string, unknown>;
  if (!st || typeof st !== 'object') return false;
  for (const k of SNAPSHOT_FIELDS) if (!(k in st)) return false;
  for (const k of [
    'nextUid',
    'nextOfferId',
    'time',
    'vtime',
    'fish',
    'baseHp',
    'summons',
    'skillRolls',
    'chestCoins',
    'waveIndex',
    'prepLeft',
    'waveTimer',
    'gapTimer',
    'clearTimer',
    'spawnPtr',
    'mallowSpecialReadyAt',
    'rng',
  ])
    if (!isNum(st[k])) return false;
  if (!['playing', 'paused', 'reward'].includes(st.status as string)) return false; // finished battles are never restored
  const wave = st.waveIndex as number;
  if (wave < -1 || wave >= stage.waves.length || (st.baseHp as number) <= 0 || (st.fish as number) < 0) return false;
  if (!isArr(st.spawnQueue) || (st.spawnPtr as number) > st.spawnQueue.length) return false;
  if (!isArr(st.waveSpawnDone) || st.waveSpawnDone.length !== stage.waves.length || !isArr(st.waveBonusGiven)) return false;
  if (!isArr(st.unlocked) || !isArr(st.cats) || !isArr(st.foes) || !isArr(st.projectiles) || !isArr(st.rewardQueue)) return false;
  // Cats: known species, valid level, on distinct unlocked tiles that exist on this map.
  const tileIds = new Set(map.tiles.map((t) => t.id));
  const unlocked = new Set(st.unlocked as string[]);
  if (![...unlocked].every((id) => tileIds.has(id))) return false;
  const used = new Set<string>();
  const uids = new Set<number>();
  for (const c of st.cats as CatUnit[]) {
    if (!c || !(c.type in CATS) || !isNum(c.level) || c.level < 1 || c.level > BALANCE.levels.maxLevel) return false;
    if (!unlocked.has(c.tileId) || used.has(c.tileId) || !isNum(c.x) || !isNum(c.y) || !isNum(c.cooldown) || uids.has(c.uid)) return false;
    used.add(c.tileId);
    uids.add(c.uid);
  }
  for (const f of st.foes as Foe[]) {
    if (
      !f ||
      !(f.defId in ENEMIES || f.defId in CHESTS) ||
      !isNum(f.hp) ||
      !isNum(f.dist) ||
      !isNum(f.x) ||
      !isNum(f.y) ||
      !isNum(f.speed) ||
      uids.has(f.uid)
    )
      return false;
    uids.add(f.uid);
  }
  for (const p of st.projectiles as Projectile[]) if (!p || !isNum(p.x) || !isNum(p.y) || !isNum(p.damage)) return false;
  if ((st.nextUid as number) <= Math.max(0, ...uids)) return false;
  return true;
}
const MAX_EFFECTS = 280;

// ---------------------------------------------------------------------------
// Battle simulation
// ---------------------------------------------------------------------------

export class Battle {
  readonly stage: StageDef;
  readonly map: MapDef;
  readonly path: PathGeom;
  readonly tiles: TileState[];
  readonly tuning: Tuning;
  /** Species random summons choose from (team, or the stage roster on tutorial stages). */
  readonly roster: CatId[];
  /** Permanent star ranks (1★–5★) per species. */
  readonly stars: Partial<Record<CatId, number>>;
  /** Special-skin bonus per species (fixed for the whole battle). */
  readonly skinBonus: Partial<Record<CatId, SkinBonus>>;
  readonly sandbox: boolean;
  private readonly ultCooldown: number;
  private rng: Rng;
  private nextUid = 1;
  private nextOfferId = 1;

  status: BattleStatus = 'playing';
  /**
   * Set by the tutorial layer. While frozen, nothing in the simulation advances
   * (movement, attacks, spawning, wave timers), but the player may still act.
   */
  frozen = false;
  /** Simulation clock (only advances while running). */
  time = 0;
  /** Visual clock: advances every frame so idle/summon animations play even while frozen or paused. */
  vtime = 0;
  fish: number;
  baseHp: number;
  readonly maxBaseHp: number;

  cats: CatUnit[] = [];
  foes: Foe[] = [];
  projectiles: Projectile[] = [];
  effects: Effect[] = [];
  events: BattleEvent[] = [];

  skills: Partial<Record<SkillId, number>> = {};
  mods: SkillMods = computeSkillMods({});
  summons = 0;
  skillRolls = 0;
  chestCoins = 0;
  stats: BattleStats = {
    summons: 0,
    merges: 0,
    swaps: 0,
    moves: 0,
    targetChanges: 0,
    skillsBought: 0,
    skillsFromChests: 0,
    fishEarned: 0,
    fishSpent: 0,
    kills: 0,
    escaped: 0,
    chestsOpened: 0,
    chestsMissed: 0,
    slamHits: 0,
    damageDealt: 0,
    sells: 0,
    tacticalPauses: 0,
  };

  /** -1 while waiting for the first wave. */
  waveIndex = -1;
  /**
   * Preparation phase: true until the battle starts (button or countdown). Nothing in the
   * simulation runs while preparing, but every player action works.
   */
  preparing = true;
  /** Real seconds left in the preparation countdown (driven by the UI via tickPrep). */
  prepLeft: number = BALANCE.prepSeconds;
  private waveTimer = 0;
  private gapTimer = 0;
  /** Seconds the field has been clear of mice during the current between-wave gap. */
  private clearTimer = 0;
  private spawnQueue: { time: number; group: SpawnGroup }[] = [];
  private spawnPtr = 0;
  private waveSpawnDone: boolean[];
  private waveBonusGiven: boolean[];
  rewardQueue: RewardOffer[] = [];
  /** Tap-to-focus: the mouse/chest every cat that can reach it should attack (null = none). */
  focusUid: number | null = null;
  /** Ultimate charge (seconds) per species with a 5★ ultimate in this battle. */
  ultCharge: Partial<Record<CatId, number>> = {};
  /** Captain Mallow's 5★ team buff (never stacks: a new one replaces it). */
  teamBuff = { speed: 0, dmg: 0, until: -1 };
  private mallowSpecialReadyAt = 0;

  constructor(stage: StageDef, map: MapDef, opts: number | BattleOptions = {}) {
    const o: BattleOptions = typeof opts === 'number' ? { seed: opts } : opts;
    this.stage = stage;
    this.map = map;
    this.tuning = { ...NEUTRAL_TUNING, ...(o.tuning ?? {}) };
    this.roster = o.roster?.length ? [...o.roster] : [...stage.roster];
    this.stars = { ...(o.stars ?? {}) };
    this.skinBonus = { ...(o.skinBonus ?? {}) };
    this.sandbox = !!o.sandbox;
    this.ultCooldown = ULTIMATE.cooldown * (o.ultCooldownMult ?? 1);
    for (const c of this.roster) if (this.hasUltimate(c)) this.ultCharge[c] = this.ultCooldown * ULTIMATE.startCharge;
    this.path = PathGeom.fromMap(map);
    this.rng = new Rng(o.seed ?? Date.now());
    this.fish = this.tuning.startFish ?? stage.startFish;
    this.baseHp = stage.baseHp;
    this.maxBaseHp = stage.baseHp;
    const unlocked = new Set(stage.tiles);
    this.tiles = map.tiles.map((t) => {
      const p = cellCenter(map, t.c, t.r);
      return { id: t.id, c: t.c, r: t.r, x: p.x, y: p.y, unlocked: unlocked.has(t.id) };
    });
    this.waveSpawnDone = stage.waves.map(() => false);
    this.waveBonusGiven = stage.waves.map(() => false);
    for (const sc of stage.startCats ?? []) this.placeCat(sc.type, sc.level, sc.tile);
  }

  // ---------------- Save / restore (battle recovery) ----------------

  /**
   * Everything needed to rebuild this battle exactly (versioned, JSON-safe). Leaves out
   * purely visual state (effects, pending UI events). Used to recover a battle after the
   * page is closed, refreshed or navigated away from.
   */
  snapshot(): BattleSnapshot {
    const state: Record<string, unknown> = {};
    for (const k of SNAPSHOT_FIELDS) state[k] = (this as unknown as Record<string, unknown>)[k];
    state.rng = this.rng.state;
    state.unlocked = this.tiles.filter((t) => t.unlocked).map((t) => t.id);
    return JSON.parse(
      JSON.stringify({
        v: SNAPSHOT_VERSION,
        stageId: this.stage.id,
        waves: this.stage.waves.length,
        opts: {
          tuning: this.tuning,
          roster: this.roster,
          stars: this.stars,
          ultCooldownMult: this.ultCooldown / ULTIMATE.cooldown,
          skinBonus: this.skinBonus,
        },
        state,
      }),
    ) as BattleSnapshot;
  }

  /**
   * Rebuild a battle from snapshot(). Returns null if the snapshot is malformed or doesn't
   * fit this stage/map (corrupted storage, or a game update changed the stage) — callers
   * then discard it instead of starting a broken battle. With `paused`, an in-progress
   * battle comes back paused so the player can look before resuming.
   */
  static restore(stage: StageDef, map: MapDef, snap: unknown, paused = true): Battle | null {
    try {
      if (!validateSnapshot(snap, stage, map)) return null;
      const b = new Battle(stage, map, {
        seed: 1,
        tuning: snap.opts.tuning,
        roster: snap.opts.roster,
        stars: snap.opts.stars,
        ultCooldownMult: snap.opts.ultCooldownMult,
        skinBonus: snap.opts.skinBonus,
      });
      const st = snap.state as Record<string, unknown>;
      const self = b as unknown as Record<string, unknown>;
      for (const k of SNAPSHOT_FIELDS) self[k] = structuredCloneJson(st[k]);
      b.rng = Rng.fromState(st.rng as number);
      const unlocked = new Set(st.unlocked as string[]);
      for (const t of b.tiles) t.unlocked = unlocked.has(t.id);
      b.mods = computeSkillMods(b.skills);
      b.frozen = false;
      b.effects = [];
      b.events = [];
      if (paused && b.status === 'playing') b.status = 'paused';
      return b;
    } catch {
      return null;
    }
  }

  // ---------------- Queries ----------------

  /** Permanent star rank of a species in this battle (1–5). */
  starOf(type: CatId): number {
    return Math.max(1, Math.min(STARS.max, Math.round(this.stars[type] ?? 1)));
  }
  hasSpecial(type: CatId): boolean {
    return this.starOf(type) >= STARS.specialAt;
  }
  hasUltimate(type: CatId): boolean {
    return this.starOf(type) >= STARS.ultimateAt;
  }
  /** 0..1 readiness of a species' ultimate (undefined if it has none). */
  ultReadiness(type: CatId): number | undefined {
    const c = this.ultCharge[type];
    return c === undefined ? undefined : Math.min(1, c / this.ultCooldown);
  }

  /** Stats for a unit on the board: level × star × skills × active buffs. */
  unitStats(cat: CatUnit): CatStats {
    const st = applySkinBonus(getCatStats(CATS[cat.type], cat.level, this.mods, this.starOf(cat.type)), this.skinBonus[cat.type]);
    let speed = 1;
    let dmg = 1;
    if (cat.buffSpeedUntil > this.time) speed = Math.max(speed, 1 + cat.buffSpeed);
    if (this.teamBuff.until > this.time) {
      speed = Math.max(speed, 1 + this.teamBuff.speed);
      dmg = Math.max(dmg, 1 + this.teamBuff.dmg);
    }
    if (cat.buffDmgUntil > this.time) dmg = Math.max(dmg, 1 + cat.buffDmg);
    if (speed === 1 && dmg === 1) return st;
    return { ...st, interval: st.interval / speed, damage: st.damage * dmg, poisonDps: st.poisonDps * dmg };
  }

  /** Tap-to-focus: tap a mouse/chest to focus it, tap it again (or pass null) to cancel. */
  setFocus(uid: number | null): number | null {
    if (uid === null || uid === this.focusUid) this.focusUid = null;
    else if (this.foes.some((f) => f.uid === uid && f.alive)) this.focusUid = uid;
    return this.focusUid;
  }

  /** The focused foe if this cat can legally reach it, otherwise the cat's own targeting mode. */
  private pickTarget(cat: CatUnit, range: number): Foe | null {
    if (this.focusUid !== null) {
      const f = this.foes.find((x) => x.uid === this.focusUid && x.alive);
      if (f && (f.x - cat.x) ** 2 + (f.y - cat.y) ** 2 <= range * range) return f;
    }
    return selectTarget(cat.x, cat.y, range, cat.mode, this.foes);
  }

  get summonCost(): number {
    return summonCost(this.summons, this.tuning.summonCostMult);
  }
  get skillCost(): number {
    return skillRollCost(this.skillRolls);
  }
  get skillShopUnlocked(): boolean {
    return (this.stage.order ?? this.stage.number) >= BALANCE.unlocks.skillShopFromStage;
  }
  get totalWaves(): number {
    return this.stage.waves.length;
  }
  /** True while the simulation is actually advancing. */
  get running(): boolean {
    return this.status === 'playing' && !this.frozen && !this.preparing;
  }
  /**
   * Game seconds until the next wave starts, while between waves (all of the current wave has
   * spawned and it isn't the last one); null otherwise. Drives the HUD countdown.
   */
  get nextWaveIn(): number | null {
    if (this.preparing || this.sandbox || this.waveIndex < 0 || this.waveIndex >= this.stage.waves.length - 1) return null;
    if (this.spawnPtr < this.spawnQueue.length) return null;
    // Only during the calm after a cleared field (while mice remain, the wave banner/label is enough).
    if (this.foes.some((f) => f.alive && f.kind === 'enemy')) return null;
    const until = (BALANCE.clearedWaveGap + BALANCE.waveBreather) * this.tuning.waveIntervalMult;
    return Math.max(0, until - this.clearTimer);
  }
  /** Seconds left in the preparation phase. */
  get prepRemaining(): number {
    return this.preparing ? Math.max(0, this.prepLeft) : 0;
  }

  /** Start combat now (Start Battle button / countdown reached zero). Safe to call twice. */
  startBattle(): boolean {
    if (!this.preparing) return false;
    this.preparing = false;
    this.prepLeft = 0;
    if (!this.sandbox) this.startWave(0);
    return true;
  }

  /**
   * Advance the preparation countdown by REAL seconds (not scaled by game speed).
   * The UI only calls this while no tutorial / modal / pause is open.
   */
  tickPrep(realDt: number): void {
    if (!this.preparing || this.status !== 'playing' || this.frozen) return;
    this.prepLeft -= Math.min(realDt, 0.25);
    if (this.prepLeft <= 0) this.startBattle();
  }
  catAt(tileId: string): CatUnit | undefined {
    return this.cats.find((c) => c.tileId === tileId);
  }
  catByUid(uid: number): CatUnit | undefined {
    return this.cats.find((c) => c.uid === uid);
  }
  tileById(id: string): TileState | undefined {
    return this.tiles.find((t) => t.id === id);
  }
  emptyTiles(): TileState[] {
    return this.tiles.filter((t) => t.unlocked && !this.catAt(t.id));
  }
  availableSkills(): SkillId[] {
    return SKILL_ORDER.filter((id) => {
      const def = SKILLS[id];
      if ((this.skills[id] ?? 0) >= def.maxLevel) return false;
      if (def.cat && !this.roster.includes(def.cat)) return false;
      return true;
    });
  }

  /** Is this skill useful for the current formation? (general, or its cat is on the board) */
  isRelevantSkill(id: SkillId): boolean {
    const cat = SKILLS[id].cat;
    return !cat || this.cats.some((c) => c.type === cat);
  }

  /** Offer weight: favour skills for cats on the board, keep some variety. */
  skillWeight(id: SkillId): number {
    const cat = SKILLS[id].cat;
    const W = SKILL_WEIGHTS;
    if (!cat) return W.general;
    const n = this.cats.filter((c) => c.type === cat).length;
    if (n === 0) return W.catInRosterOnly;
    return W.catOnBoard + W.perExtraCat * Math.min(W.perExtraCatCap, n - 1);
  }
  get currentReward(): RewardOffer | null {
    return this.rewardQueue[0] ?? null;
  }

  /** What would happen if `uid` were dropped on `tileId` (no side effects). */
  previewDrop(uid: number, tileId: string | null): DropResult {
    if (this.status === 'victory' || this.status === 'defeat' || this.status === 'reward') return { result: 'cancel' };
    const cat = this.catByUid(uid);
    if (!cat || !tileId || tileId === cat.tileId) return { result: 'cancel' };
    const tile = this.tileById(tileId);
    if (!tile) return { result: 'cancel' };
    if (!tile.unlocked) return { result: 'cancel', reason: 'locked' };
    const occupant = this.catAt(tileId);
    if (!occupant) return { result: 'moved' };
    if (canMerge(cat, occupant)) return { result: 'merged' };
    if (occupant.type === cat.type && occupant.level === cat.level) return { result: 'cancel', reason: 'maxLevel' };
    return { result: 'swapped' };
  }

  // ---------------- Player actions ----------------

  /**
   * Freeze the battle. While 'paused' nothing in the simulation advances (update() is a no-op:
   * movement, spawns, wave timers, cooldowns, wind-ups, projectiles, statuses and ultimate
   * charge all use the sim clock), but the formation can still be edited: move / swap / merge
   * (dropCat), target modes (cycleTarget), details and selling. Summoning and buying skills
   * need a running battle. `tactical` marks the in-battle Tactical Pause (vs. the menu).
   */
  pause(tactical = false): boolean {
    if (this.status !== 'playing') return false;
    this.status = 'paused';
    if (tactical) this.stats.tacticalPauses++;
    return true;
  }
  resume(): void {
    if (this.status === 'paused') this.status = 'playing';
  }

  summon(): ActionResult & { uid?: number } {
    if (this.status !== 'playing') return { ok: false, reason: 'notNow' };
    const empty = this.emptyTiles();
    if (!empty.length) return { ok: false, reason: 'boardFull' };
    const cost = this.summonCost;
    if (this.fish < cost) return { ok: false, reason: 'noFish' };
    this.spend(cost);
    this.summons++;
    this.stats.summons++;
    const type = this.rng.pick(this.roster);
    const tile = this.rng.pick(empty);
    const cat = this.placeCat(type, 1, tile.id)!;
    this.addEffect({ kind: 'beam', x: tile.x, y: tile.y, born: this.vtime, dur: 0.5, color: '#fff3b0' });
    this.addEffect({ kind: 'ring', x: tile.x, y: tile.y, r0: 4, r1: 30, color: '#ffd86b', born: this.vtime, dur: 0.4 });
    this.burst(tile.x, tile.y, ['#fff6c8', '#ffd86b', '#ffffff', '#ffc2dc'], 16, 85);
    return { ok: true, uid: cat.uid };
  }

  /** Put a cat on a tile directly (stage start cats, tutorials). Does not cost fish. */
  placeCat(type: CatId, level: number, tileId: string): CatUnit | null {
    const tile = this.tileById(tileId);
    if (!tile || !tile.unlocked || this.catAt(tileId)) return null;
    const cat: CatUnit = {
      uid: this.nextUid++,
      type,
      level: Math.max(1, Math.min(BALANCE.levels.maxLevel, level)),
      tileId: tile.id,
      x: tile.x,
      y: tile.y,
      mode: 'first',
      cooldown: 0.3,
      spawnAt: this.vtime,
      mergeAt: -99,
      attackAt: -99,
      modeAt: -99,
      movedAt: -99,
      buffAt: -99,
      windup: null,
      comboQueue: [],
      comboIndex: 0,
      aimX: tile.x + 1,
      aimY: tile.y,
      attackCount: 0,
      queue: [],
      buffSpeed: 0,
      buffSpeedUntil: -1,
      buffDmg: 0,
      buffDmgUntil: -1,
      empowered: false,
      specialReadyAt: 0,
      lastHitUid: -1,
      ultAt: -99,
    };
    this.cats.push(cat);
    if (this.hasUltimate(type) && this.ultCharge[type] === undefined) this.ultCharge[type] = this.ultCooldown * ULTIMATE.startCharge;
    return cat;
  }

  buySkill(): ActionResult & { skillId?: SkillId } {
    if (this.status !== 'playing') return { ok: false, reason: 'notNow' };
    if (!this.skillShopUnlocked) return { ok: false, reason: 'skillLocked' };
    const pool = this.availableSkills();
    if (!pool.length) return { ok: false, reason: 'skillsMaxed' };
    const cost = this.skillCost;
    if (this.fish < cost) return { ok: false, reason: 'noFish' };
    this.spend(cost);
    this.skillRolls++;
    this.stats.skillsBought++;
    const id = pool[this.rng.weighted(pool.map((x) => this.skillWeight(x)))];
    this.grantSkill(id, 1, 'shop');
    return { ok: true, skillId: id };
  }

  /** Drop a dragged cat on a tile: move to empty, merge with identical, swap with any other cat. */
  dropCat(uid: number, tileId: string | null): DropResult {
    const preview = this.previewDrop(uid, tileId);
    if (preview.result === 'cancel') return preview;
    const cat = this.catByUid(uid)!;
    const tile = this.tileById(tileId!)!;
    const occupant = this.catAt(tile.id);

    if (preview.result === 'moved') {
      this.setTile(cat, tile);
      this.stats.moves++;
      return preview;
    }
    if (preview.result === 'swapped' && occupant) {
      const from = this.tileById(cat.tileId)!;
      this.setTile(occupant, from);
      this.setTile(cat, tile);
      this.stats.swaps++;
      return preview;
    }
    // merge
    const target = occupant!;
    target.level += 1;
    target.mergeAt = this.vtime;
    target.cooldown = Math.min(target.cooldown, 0.2);
    this.cats = this.cats.filter((c) => c.uid !== cat.uid);
    this.stats.merges++;
    this.burst(target.x, target.y, ['#ffe066', '#ffffff', '#ffb3d1', '#a8e6ff'], 28, 125);
    this.addEffect({ kind: 'ring', x: target.x, y: target.y, r0: 8, r1: 38, color: '#ffe066', born: this.vtime, dur: 0.38, width: 5 });
    this.addEffect({ kind: 'beam', x: target.x, y: target.y, born: this.vtime, dur: 0.45, color: '#fff6a0' });
    this.addText(target.x, target.y - 28, `Lv.${target.level}!`, '#ff9f1c', 17, 1.0);
    this.mallowTeamwork(target);
    return preview;
  }

  cycleTarget(uid: number): TargetMode | null {
    const cat = this.catByUid(uid);
    if (!cat) return null;
    cat.mode = nextTargetMode(cat.mode, TARGET_MODES);
    cat.modeAt = this.vtime;
    this.stats.targetChanges++;
    this.addEffect({ kind: 'text', x: cat.x, y: cat.y - 30, text: cat.mode, mode: cat.mode, color: '#ffffff', size: 13, born: this.vtime, dur: 0.9 });
    return cat.mode;
  }

  /** Dried fish a cat would sell for right now. */
  sellValue(uid: number): number {
    const cat = this.catByUid(uid);
    if (!cat) return 0;
    const r = BALANCE.sell.refund;
    return r[Math.max(0, Math.min(r.length - 1, cat.level - 1))] ?? 0;
  }

  /**
   * Sell a cat: removes it, frees its tile and refunds a little dried fish. During an active
   * battle, the preparation phase or Tactical Pause (same refund either way). Never touches permanent progress (stars,
   * fragments, collection) — those live in the save, not in the battle.
   */
  sellCat(uid: number): ActionResult & { refund?: number } {
    if (this.status !== 'playing' && this.status !== 'paused') return { ok: false, reason: 'notNow' };
    const cat = this.catByUid(uid);
    if (!cat) return { ok: false, reason: 'notNow' };
    const refund = this.sellValue(uid);
    this.cats = this.cats.filter((c) => c.uid !== uid);
    this.earn(refund);
    this.stats.sells++;
    this.addEffect({ kind: 'ring', x: cat.x, y: cat.y, r0: 20, r1: 4, color: '#ffffff', born: this.vtime, dur: 0.35, width: 3 });
    this.burst(cat.x, cat.y, ['#ffffff', '#e8e0f0', '#ffd36a'], 12, 70);
    this.addText(cat.x, cat.y - 16, `+${refund}`, '#ffd36a', 14, 0.9);
    return { ok: true, refund };
  }

  chooseReward(index: number): ActionResult {
    if (this.status !== 'reward') return { ok: false, reason: 'notNow' };
    const offer = this.rewardQueue[0];
    const choice = offer?.choices[index];
    if (!choice) return { ok: false, reason: 'notNow' };
    this.grantSkill(choice.skillId, choice.levels, 'chest');
    this.stats.skillsFromChests++;
    this.rewardQueue.shift();
    if (!this.rewardQueue.length) this.status = 'playing';
    return { ok: true };
  }

  // ---------------- Simulation ----------------

  update(dt: number): void {
    let remaining = Math.min(dt, 0.5);
    while (remaining > 1e-9 && this.running) {
      const h = Math.min(STEP, remaining);
      this.step(h);
      remaining -= h;
    }
  }

  /** Advance only visual animations (used while paused / frozen / choosing a reward). */
  tickVisual(dt: number): void {
    this.vtime += Math.min(dt, 0.1);
    this.cleanupEffects();
  }

  private step(dt: number): void {
    this.time += dt;
    this.vtime += dt;
    this.updateWaves(dt);
    this.updateFoes(dt);
    this.updateUltimates(dt);
    this.updateCats(dt);
    this.updateProjectiles(dt);
    this.foes = this.foes.filter((f) => f.alive);
    // Focus clears itself when the target is defeated or escapes.
    if (this.focusUid !== null && !this.foes.some((f) => f.uid === this.focusUid)) this.focusUid = null;
    this.cleanupEffects();
    this.checkEnd();
  }

  private cleanupEffects(): void {
    if (this.effects.length) this.effects = this.effects.filter((e) => this.vtime - e.born < e.dur);
  }

  private updateWaves(dt: number): void {
    const waves = this.stage.waves;
    if (this.waveIndex === -1 || this.sandbox) return; // still preparing (or encyclopedia demo)
    this.waveTimer += dt;
    while (this.spawnPtr < this.spawnQueue.length && this.spawnQueue[this.spawnPtr].time <= this.waveTimer) {
      this.spawn(this.spawnQueue[this.spawnPtr].group);
      this.spawnPtr++;
    }
    if (this.spawnPtr >= this.spawnQueue.length) {
      this.waveSpawnDone[this.waveIndex] = true;
      if (this.waveIndex < waves.length - 1) {
        this.gapTimer += dt;
        const hostile = this.foes.some((f) => f.alive && f.kind === 'enemy');
        const gapMult = this.tuning.waveIntervalMult;
        this.clearTimer = hostile ? 0 : this.clearTimer + dt;
        // Cleared field: a full calm breather. Mice still alive: the usual pressure cap.
        const calm = !hostile && this.clearTimer >= (BALANCE.clearedWaveGap + BALANCE.waveBreather) * gapMult;
        const cap = hostile && this.gapTimer >= (BALANCE.waveGap + BALANCE.waveBreatherHostile) * gapMult;
        if (calm || cap) {
          this.startWave(this.waveIndex + 1);
        }
      }
    }
    // Wave-clear bonuses
    for (let w = 0; w <= this.waveIndex; w++) {
      if (!this.waveSpawnDone[w] || this.waveBonusGiven[w]) continue;
      if (this.foes.some((f) => f.alive && f.kind === 'enemy' && f.wave === w)) continue;
      this.waveBonusGiven[w] = true;
      if (w < waves.length - 1 && BALANCE.waveClearBonus > 0) {
        this.earn(BALANCE.waveClearBonus);
        this.events.push({ type: 'waveCleared', wave: w + 1, bonus: BALANCE.waveClearBonus });
      }
    }
  }

  private startWave(i: number): void {
    this.waveIndex = i;
    this.waveTimer = 0;
    this.gapTimer = 0;
    this.clearTimer = 0;
    this.spawnPtr = 0;
    const T = this.tuning;
    const q: { time: number; group: SpawnGroup }[] = [];
    for (const g of this.stage.waves[i].groups) {
      const delay = (g.delay ?? 0) * T.waveIntervalMult;
      if ('chest' in g) {
        q.push({ time: delay, group: g });
      } else {
        const count = Math.max(1, Math.round(g.count * T.enemyCountMult));
        const interval = (g.interval * T.waveIntervalMult) / Math.max(0.25, T.enemyCountMult);
        for (let k = 0; k < count; k++) q.push({ time: delay + k * interval, group: g });
      }
    }
    q.sort((a, b) => a.time - b.time);
    this.spawnQueue = q;
    this.events.push({ type: 'wave', wave: i + 1, total: this.stage.waves.length });
  }

  /** Toughness multiplier for the current wave (stage scale × in-stage ramp × debug). */
  /** Current enemy HP multiplier (stage hpScale × per-wave growth). */
  toughness(): number {
    const growth = this.stage.waveHpGrowth ?? BALANCE.waveHpGrowth;
    return this.stage.hpScale * (1 + growth * Math.pow(Math.max(0, this.waveIndex), BALANCE.waveHpCurve));
  }

  /** Spawn a group's unit immediately (exposed for tests/tools). */
  spawn(g: SpawnGroup): Foe {
    const p = this.path.pointAt(0);
    const tough = this.toughness();
    const hpMult = tough * this.tuning.enemyHpMult;
    const base = {
      uid: this.nextUid++,
      x: p.x,
      y: p.y,
      dist: 0,
      alive: true,
      wave: this.waveIndex,
      slowT: 0,
      slowStrength: 0,
      hitAt: -99,
      dirX: 1,
      bornAt: this.vtime,
      rewarded: false,
      walk: 0,
      charmedAt: -99,
      poisonDps: 0,
      poisonUntil: -1,
      poisonStacks: 0,
      poisonShown: 0,
      markUntil: -1,
      shred: 0,
      shredUntil: -1,
      vulnerable: 0,
      vulnUntil: -1,
    };
    let foe: Foe;
    if ('chest' in g) {
      const def = CHESTS[g.chest];
      const chestScale = this.stage.chestHpScale ?? 1 + BALANCE.chest.hpPerStage * ((this.stage.order ?? this.stage.number) - 1);
      const hp = Math.round(def.hp * chestScale * this.tuning.enemyHpMult);
      foe = {
        ...base,
        kind: 'chest',
        defId: def.tier,
        hp,
        maxHp: hp,
        shield: 0,
        maxShield: 0,
        armor: 0,
        speed: def.speed * this.tuning.enemySpeedMult,
        reward: 0,
        baseDamage: 0,
        radius: def.radius,
        isBoss: false,
      };
      this.events.push({ type: 'chestAppeared', tier: def.tier });
    } else {
      const def = ENEMIES[g.enemy];
      const hp = Math.round(def.hp * hpMult);
      const shield = Math.round(def.shield * hpMult);
      foe = {
        ...base,
        kind: 'enemy',
        defId: def.id,
        hp,
        maxHp: hp,
        shield,
        maxShield: shield,
        armor: def.armor > 0 ? def.armor + (this.stage.armorBonus ?? 0) : 0,
        speed: def.speed * this.tuning.enemySpeedMult,
        reward: Math.max(1, Math.round(def.reward * Math.pow(tough, BALANCE.rewardScaleExponent) * BALANCE.waves.fishMult)),
        baseDamage: def.baseDamage,
        radius: def.radius,
        isBoss: !!def.isBoss,
      };
      if (def.isBoss) this.events.push({ type: 'bossAppeared', enemy: def.id });
      if (def.elite) this.events.push({ type: 'eliteAppeared', enemy: def.id });
    }
    this.foes.push(foe);
    return foe;
  }

  private updateFoes(dt: number): void {
    const end = this.path.length;
    for (const f of this.foes) {
      if (!f.alive) continue;
      if (f.poisonUntil > this.time) {
        this.poisonTick(f, dt);
        if (!f.alive) continue;
      } else if (f.poisonStacks) {
        f.poisonStacks = 0;
        f.poisonDps = 0;
      }
      if (f.slowT > 0) {
        f.slowT -= dt;
        if (f.slowT <= 0) f.slowStrength = 0;
      }
      const mult = 1 - f.slowStrength;
      f.dist += f.speed * mult * dt;
      f.walk += dt * mult;
      const p = this.path.pointAt(f.dist);
      f.x = p.x;
      f.y = p.y;
      if (Math.abs(p.dx) > 0.1) f.dirX = p.dx > 0 ? 1 : -1;
      if (f.dist >= end) {
        f.alive = false;
        if (f.kind === 'enemy') {
          this.baseHp = Math.max(0, this.baseHp - f.baseDamage);
          this.stats.escaped++;
          this.addText(f.x, f.y - 20, `-${f.baseDamage} ♥`, '#e04848', 16, 1.0);
        } else {
          this.stats.chestsMissed++;
          this.events.push({ type: 'chestEscaped' });
        }
      }
    }
  }

  private updateCats(dt: number): void {
    for (const cat of this.cats) {
      const def = CATS[cat.type];
      const st = this.unitStats(cat);
      const dmg = st.damage * this.tuning.catDamageMult;

      // 0) Queued ultimate actions (volleys, strikes, telegraphed slashes).
      if (cat.queue.length) this.runQueue(cat, st, dmg);

      // 1) Combo punches land one after another (real timing).
      if (cat.comboQueue.length) this.runCombo(cat, st, dmg);

      // 2) A wind-up (Orange slam / Black Cat aim) resolves when it ends.
      if (cat.windup) {
        if (this.time < cat.windup.fireAt) {
          cat.cooldown -= dt;
          continue;
        }
        const w = cat.windup;
        cat.windup = null;
        cat.attackAt = this.vtime;
        if (def.attack === 'slam') this.slam(cat, w.x, w.y, w.targetUid, st, dmg);
        else this.fireShot(cat, w.targetUid, st, dmg);
      }

      cat.cooldown -= dt;
      if (cat.cooldown > 0) continue;

      // Captain Mallow needs no target: she rings her bell for nearby allies while mice are around.
      if (def.attack === 'support') {
        if (!this.foes.some((f) => f.alive)) {
          cat.cooldown = 0;
          continue;
        }
        cat.cooldown = st.interval;
        cat.attackAt = this.vtime;
        cat.attackCount++;
        this.ringBell(cat, st);
        continue;
      }

      const target = this.pickTarget(cat, st.range);
      if (!target) {
        cat.cooldown = 0;
        continue;
      }
      cat.cooldown = st.interval;
      cat.aimX = target.x;
      cat.aimY = target.y;
      cat.attackCount++;
      const special = this.hasSpecial(cat.type);

      if (def.windup) {
        // Commit now, hit later. The slam lands where the target WAS when the wind-up began.
        const len = Math.min(def.windup, st.interval * 0.8);
        cat.windup = { start: this.time, fireAt: this.time + len, targetUid: target.uid, x: target.x, y: target.y };
        continue;
      }

      cat.attackAt = this.vtime;
      switch (def.attack) {
        case 'projectile': {
          // Kitten 3★: every Nth yarn ball is a big empowered one.
          const A = ABILITIES.kitten.special;
          const big = special && cat.attackCount % A.every === 0;
          this.launch(cat, target, dmg * (big ? A.mult : 1), def.projectileSpeed ?? 400, 'yarn', { size: big ? 1.8 : 1 });
          break;
        }
        case 'combo': {
          const gap = (def.comboGap ?? 0.08) / Math.max(1, st.comboHits / 3);
          for (let i = 0; i < st.comboHits; i++) cat.comboQueue.push({ at: this.time + i * gap, targetUid: target.uid });
          this.runCombo(cat, st, dmg);
          break;
        }
        case 'aura':
          this.charm(cat, target, st);
          break;
        case 'ricochet': {
          // Mr. Whiskers 3★: every Nth yarn ball gets an extra bounce.
          const A = ABILITIES.whiskers.special;
          const extra = special && cat.attackCount % A.every === 0 ? A.extraBounces : 0;
          this.launch(cat, target, dmg, def.projectileSpeed ?? 330, 'magic', {
            size: extra ? 1.3 : 1,
            bounce: { left: st.bounces + extra, falloff: st.bounceFalloff, range: st.bounceRange, hit: [] },
          });
          break;
        }
        case 'pierce':
          this.swordWave(cat, target.x - cat.x, target.y - cat.y, dmg, st.pierceLength, st.pierceWidth, false);
          break;
        case 'execute':
          this.claw(cat, target, st, dmg, 1);
          break;
        case 'poison':
          this.launch(cat, target, dmg, def.projectileSpeed ?? 300, 'venom', {
            poison: {
              dps: st.poisonDps * this.tuning.catDamageMult,
              dur: st.poisonDuration,
              maxStacks: special ? ABILITIES.devil.special.maxStacks : 1,
              srcUid: cat.uid,
            },
          });
          break;
        default:
          break;
      }
    }
  }

  private launch(cat: CatUnit, target: Foe, damage: number, speed: number, style: Projectile['style'], extra: Partial<Projectile> = {}): void {
    this.projectiles.push({
      uid: this.nextUid++,
      x: cat.x,
      y: cat.y - 4,
      targetUid: target.uid,
      tx: target.x,
      ty: target.y,
      damage,
      speed,
      style,
      done: false,
      star: this.starOf(cat.type),
      ...extra,
    });
  }

  // ---------------- Ultimates (5★) ----------------
  // One automatic, shared cooldown per species: the highest-level copy that can act performs it.

  private updateUltimates(dt: number): void {
    for (const type of Object.keys(this.ultCharge) as CatId[]) {
      const charge = Math.min(this.ultCooldown, (this.ultCharge[type] ?? 0) + dt);
      this.ultCharge[type] = charge;
      if (charge < this.ultCooldown) continue;
      const performers = this.cats.filter((c) => c.type === type).sort((x, y) => y.level - x.level);
      for (const cat of performers) {
        if (this.performUltimate(cat)) {
          this.ultCharge[type] = 0;
          cat.ultAt = this.vtime;
          cat.attackAt = this.vtime;
          this.events.push({ type: 'ultimate', cat: type });
          this.addEffect({ kind: 'text', x: cat.x, y: cat.y - 34, text: '!', ult: type, color: '#ffe08a', size: 13, born: this.vtime, dur: 1.2 });
          this.addEffect({ kind: 'ring', x: cat.x, y: cat.y, r0: 6, r1: 34, color: '#ffd36a', born: this.vtime, dur: 0.5, width: 4 });
          break;
        }
      }
    }
  }

  /** Try to perform this cat's ultimate now. Returns false if it has nothing valid to do yet. */
  private performUltimate(cat: CatUnit): boolean {
    const st = this.unitStats(cat);
    const dmg = st.damage * this.tuning.catDamageMult;
    const t = this.time;
    switch (cat.type) {
      case 'kitten': {
        if (!this.pickTarget(cat, st.range)) return false;
        const A = ABILITIES.kitten.ultimate;
        for (let i = 0; i < A.shots; i++) cat.queue.push({ at: t + i * A.gap, kind: 'shot', mult: A.mult });
        return true;
      }
      case 'tabby': {
        const target = this.pickTarget(cat, st.range);
        if (!target) return false;
        const A = ABILITIES.tabby.ultimate;
        const gap = 0.05;
        cat.comboQueue = [];
        for (let i = 0; i < A.punches; i++) cat.comboQueue.push({ at: t + i * gap, targetUid: target.uid, mult: A.mult });
        return true;
      }
      case 'orange': {
        const target = this.pickTarget(cat, st.range);
        if (!target) return false;
        const A = ABILITIES.orange.ultimate;
        const r = st.splashRadius * A.radiusMult;
        this.addEffect({ kind: 'ring', x: target.x, y: target.y, r0: r, r1: r * 0.96, color: '#ffb35a', born: this.vtime, dur: 0.55, width: 2 });
        cat.queue.push({ at: t + 0.5, kind: 'bigSlam', x: target.x, y: target.y, targetUid: target.uid });
        cat.windup = null;
        return true;
      }
      case 'black': {
        const A = ABILITIES.black.ultimate;
        const target = selectTarget(cat.x, cat.y, st.range * A.rangeMult, 'strongest', this.foes);
        if (!target) return false;
        this.addEffect({
          kind: 'telegraph',
          x1: cat.x,
          y1: cat.y,
          x2: target.x,
          y2: target.y,
          width: 2,
          color: '#ff6a6a',
          born: this.vtime,
          dur: 0.5,
        });
        cat.queue.push({ at: t + 0.5, kind: 'bigShot', targetUid: target.uid });
        return true;
      }
      case 'white': {
        const A = ABILITIES.white.ultimate;
        const r = st.range * A.radiusMult;
        const hit = this.foes.filter((f) => f.alive && (f.x - cat.x) ** 2 + (f.y - cat.y) ** 2 <= r * r);
        if (!hit.length) return false;
        for (const f of hit) {
          f.slowStrength = Math.max(f.slowT > 0 ? f.slowStrength : 0, Math.min(BALANCE.slowCap, A.slow));
          f.slowT = Math.max(f.slowT, A.duration);
          f.charmedAt = this.vtime;
          this.addEffect({ kind: 'hearts', x: f.x, y: f.y - f.radius, born: this.vtime, dur: 1.1 });
        }
        this.addEffect({ kind: 'ring', x: cat.x, y: cat.y, r0: 10, r1: r, color: '#ff8fc0', born: this.vtime, dur: 1.0, width: 6 });
        this.addEffect({ kind: 'sparkle', x: cat.x, y: cat.y - 14, born: this.vtime, dur: 1.2 });
        return true;
      }
      case 'whiskers': {
        const target = this.pickTarget(cat, st.range);
        if (!target) return false;
        const A = ABILITIES.whiskers.ultimate;
        this.launch(cat, target, dmg * A.dmgMult, 360, 'magic', {
          size: 2.4,
          bounce: { left: A.bounces, falloff: A.falloff, range: st.bounceRange * A.bounceRangeMult, hit: [] },
        });
        return true;
      }
      case 'sable': {
        const target = this.pickTarget(cat, st.range);
        if (!target) return false;
        const A = ABILITIES.sable.ultimate;
        const dx = target.x - cat.x;
        const dy = target.y - cat.y;
        const d = Math.hypot(dx, dy) || 1;
        const len = st.range * A.lengthMult;
        this.addEffect({
          kind: 'telegraph',
          x1: cat.x,
          y1: cat.y,
          x2: cat.x + (dx / d) * len,
          y2: cat.y + (dy / d) * len,
          width: A.width,
          color: '#bfe0ff',
          born: this.vtime,
          dur: A.telegraph,
        });
        cat.queue.push({ at: t + A.telegraph, kind: 'slash', dx, dy, mult: A.dmgMult, length: len, width: A.width });
        return true;
      }
      case 'mallow': {
        if (!this.foes.some((f) => f.alive)) return false;
        const A = ABILITIES.mallow.ultimate;
        this.teamBuff = { speed: A.speedBuff, dmg: A.dmgBuff, until: t + A.duration };
        for (const c of this.cats) {
          c.buffAt = this.vtime;
          this.addEffect({ kind: 'ring', x: c.x, y: c.y, r0: 4, r1: 26, color: '#ffd36a', born: this.vtime, dur: 0.6, width: 3 });
        }
        this.addEffect({ kind: 'bell', x: cat.x, y: cat.y - 20, born: this.vtime, dur: 1.2, big: true });
        return true;
      }
      case 'pounce': {
        const A = ABILITIES.pounce.ultimate;
        if (!this.woundedInRange(cat, st.range, A.hpBelow)) return false;
        for (let i = 0; i < A.strikes; i++) cat.queue.push({ at: t + i * A.gap, kind: 'strike', mult: A.mult, hpBelow: A.hpBelow });
        return true;
      }
      case 'devil': {
        const target = selectTarget(cat.x, cat.y, st.range, 'strongest', this.foes);
        if (!target || target.kind !== 'enemy') return false;
        const A = ABILITIES.devil.ultimate;
        target.markUntil = t + A.duration;
        // The pact also delivers a full dose of poison right away.
        this.applyPoison(target, st.poisonDps * this.tuning.catDamageMult, st.poisonDuration, ABILITIES.devil.special.maxStacks, cat, true);
        this.addEffect({ kind: 'ring', x: target.x, y: target.y, r0: 30, r1: 10, color: '#b58ad6', born: this.vtime, dur: 0.6, width: 4 });
        return true;
      }
    }
    return false;
  }

  /** Lowest-HP wounded mouse in range (below `hpBelow` of its max), for Shadow Pounce. */
  private woundedInRange(cat: CatUnit, range: number, hpBelow: number): Foe | null {
    let best: Foe | null = null;
    let bestFrac = hpBelow;
    for (const f of this.foes) {
      if (!f.alive || f.kind !== 'enemy') continue;
      if ((f.x - cat.x) ** 2 + (f.y - cat.y) ** 2 > range * range) continue;
      const frac = (f.hp + f.shield) / Math.max(1, f.maxHp + f.maxShield);
      if (frac < bestFrac) {
        best = f;
        bestFrac = frac;
      }
    }
    return best;
  }

  private runQueue(cat: CatUnit, st: CatStats, dmg: number): void {
    while (cat.queue.length && cat.queue[0].at <= this.time + 1e-9) {
      const a = cat.queue.shift()!;
      switch (a.kind) {
        case 'shot': {
          const target = this.pickTarget(cat, st.range);
          if (!target) break;
          cat.attackAt = this.vtime;
          cat.aimX = target.x;
          cat.aimY = target.y;
          this.launch(cat, target, dmg * a.mult, (CATS[cat.type].projectileSpeed ?? 400) * 1.2, 'yarn', { size: 1.6 });
          break;
        }
        case 'strike': {
          const target = this.woundedInRange(cat, st.range, a.hpBelow);
          if (!target) {
            cat.queue = cat.queue.filter((q) => q.kind !== 'strike');
            break;
          }
          // Bosses take a normal strike: the ultimate can't shred them.
          this.claw(cat, target, st, dmg, target.isBoss ? 1 : a.mult, true);
          break;
        }
        case 'slash':
          cat.attackAt = this.vtime;
          this.swordWave(cat, a.dx, a.dy, dmg * a.mult, a.length, a.width, true);
          break;
        case 'bigSlam': {
          const A = ABILITIES.orange.ultimate;
          cat.attackAt = this.vtime;
          this.slam(cat, a.x, a.y, a.targetUid, { ...st, splashRadius: st.splashRadius * A.radiusMult, splashRatio: 1 }, dmg * A.dmgMult, true);
          break;
        }
        case 'bigShot': {
          const f = this.foes.find((x) => x.uid === a.targetUid && x.alive);
          if (!f) break;
          cat.attackAt = this.vtime;
          cat.aimX = f.x;
          cat.aimY = f.y;
          this.launch(cat, f, dmg * ABILITIES.black.ultimate.dmgMult, 1400, 'bullet', {
            size: 2,
            armorIgnore: this.hasSpecial('black') ? ABILITIES.black.special.armorIgnore : 0,
          });
          break;
        }
      }
    }
  }

  /** Deliver due combo punches; if the target drops, the rest go to the next mouse in reach. */
  private runCombo(cat: CatUnit, st: CatStats, dmg: number): void {
    while (cat.comboQueue.length && cat.comboQueue[0].at <= this.time + 1e-9) {
      const h = cat.comboQueue.shift()!;
      let f = this.foes.find((x) => x.uid === h.targetUid && x.alive);
      const reach2 = (st.range * 1.2) ** 2;
      if (!f || (f.x - cat.x) ** 2 + (f.y - cat.y) ** 2 > reach2) {
        f = this.pickTarget(cat, st.range) ?? undefined;
        if (!f) {
          cat.comboQueue = [];
          return;
        }
        for (const q of cat.comboQueue) q.targetUid = f.uid;
      }
      cat.comboIndex++;
      cat.attackAt = this.vtime;
      cat.aimX = f.x;
      cat.aimY = f.y;
      // Tabby 3★: the last punch of a normal combo is a finisher.
      const finisher = !h.mult && cat.comboQueue.length === 0 && this.hasSpecial(cat.type);
      const mult = (h.mult ?? 1) * (finisher ? ABILITIES.tabby.special.finisherMult : 1);
      this.hit(f, dmg * mult, finisher, { src: cat });
      this.addEffect({
        kind: 'pow',
        x: f.x + (this.vrand() - 0.5) * 12,
        y: f.y - 4 + (this.vrand() - 0.5) * 10,
        rot: this.vrand() * Math.PI,
        born: this.vtime,
        dur: finisher || h.mult ? 0.28 : 0.2,
      });
    }
  }

  /** Orange belly slam: everything near the impact point is hit at the same moment. */
  private slam(cat: CatUnit, x: number, y: number, targetUid: number, st: CatStats, dmg: number, ultimate = false): void {
    const r2 = st.splashRadius * st.splashRadius;
    const hitList = this.foes.filter((f) => f.alive && (f.x - x) ** 2 + (f.y - y) ** 2 <= r2);
    const S = ABILITIES.orange.special;
    const weaken = this.hasSpecial('orange');
    for (const f of hitList) {
      this.hit(f, f.uid === targetUid ? dmg : dmg * st.splashRatio, true, { src: cat });
      // Orange 3★: slammed mice take extra damage from everyone for a moment.
      if (weaken && f.alive) {
        f.vulnerable = S.vulnerable;
        f.vulnUntil = this.time + S.duration;
      }
    }
    this.stats.slamHits += hitList.length;
    const star = this.starOf(cat.type);
    this.addEffect({
      kind: 'ring',
      x,
      y,
      r0: 8,
      r1: st.splashRadius,
      color: star >= 4 ? '#ffb35a' : '#e0883a',
      born: this.vtime,
      dur: 0.5,
      width: ultimate ? 10 : 7,
    });
    this.addEffect({ kind: 'ring', x, y, r0: 4, r1: st.splashRadius * 0.6, color: '#fff2c0', born: this.vtime, dur: 0.35, width: 5 });
    this.burst(x, y, ['#c8a070', '#e8d0a8', '#a07850', ...(star >= 2 ? ['#ffd36a'] : [])], ultimate ? 30 : 18 + star * 2, ultimate ? 170 : 120);
    // (No board/screen shake: the impact stays local — shockwave, dust and hit reactions.)
    this.addEffect({
      kind: 'ring',
      x,
      y,
      r0: st.splashRadius * 0.85,
      r1: st.splashRadius * 1.05,
      color: '#c8a070',
      born: this.vtime + 0.05,
      dur: 0.3,
      width: 3,
    });
    if (!hitList.length) this.addText(x, y - 14, '…', '#ffffff', 14, 0.6);
    cat.aimX = x;
    cat.aimY = y;
  }

  /** Black Cat: after aiming, one heavy shot (re-acquires if the aimed target is gone). */
  private fireShot(cat: CatUnit, targetUid: number, st: CatStats, dmg: number): void {
    const reach2 = (st.range * 1.15) ** 2;
    let f = this.foes.find((x) => x.uid === targetUid && x.alive && (x.x - cat.x) ** 2 + (x.y - cat.y) ** 2 <= reach2);
    if (!f) f = this.pickTarget(cat, st.range) ?? undefined;
    if (!f) return;
    cat.aimX = f.x;
    cat.aimY = f.y;
    // Black Cat 3★: every Nth shot is armor-piercing.
    const S = ABILITIES.black.special;
    const pierce = this.hasSpecial('black') && cat.attackCount % S.every === 0;
    const a = Math.atan2(f.y - cat.y, f.x - cat.x);
    this.projectiles.push({
      uid: this.nextUid++,
      x: cat.x + Math.cos(a) * 26,
      y: cat.y + 4 + Math.sin(a) * 26,
      targetUid: f.uid,
      tx: f.x,
      ty: f.y,
      damage: dmg,
      speed: CATS[cat.type].projectileSpeed ?? 900,
      style: 'bullet',
      done: false,
      star: this.starOf(cat.type),
      size: pierce ? 1.4 : 1,
      armorIgnore: pierce ? S.armorIgnore : 0,
    });
  }

  /** Noble White: every mouse in range is distracted; her focus target even more. */
  private charm(cat: CatUnit, target: Foe, st: CatStats): void {
    const r2 = st.range * st.range;
    // White 3★: every Nth charm lasts longer.
    const S = ABILITIES.white.special;
    const long = this.hasSpecial('white') && cat.attackCount % S.every === 0;
    const dur = st.slowDuration * (long ? S.durationMult : 1);
    for (const f of this.foes) {
      if (!f.alive || (f.x - cat.x) ** 2 + (f.y - cat.y) ** 2 > r2) continue;
      const s = Math.min(BALANCE.slowCap, st.slowStrength + (f === target ? st.focusBonus : 0));
      f.slowStrength = f.slowT > 0 ? Math.max(f.slowStrength, s) : s;
      f.slowT = Math.max(f.slowT, dur);
      f.charmedAt = this.vtime;
      this.addEffect({ kind: 'hearts', x: f.x, y: f.y - f.radius, born: this.vtime, dur: 0.9 });
    }
    this.addEffect({
      kind: 'ring',
      x: cat.x,
      y: cat.y,
      r0: 10,
      r1: st.range,
      color: long ? '#ffb0d8' : '#ff8fc0',
      born: this.vtime,
      dur: 0.8,
      width: long ? 7 : 5,
    });
    this.addEffect({ kind: 'sparkle', x: cat.x, y: cat.y - 12, born: this.vtime, dur: 0.8 });
  }

  /**
   * Sir Sable: a straight sword wave from the cat toward (dx, dy). Every mouse whose body
   * touches the line segment is hit — so lining the wave up with the road matters.
   */
  private swordWave(cat: CatUnit, dx: number, dy: number, dmg: number, length: number, width: number, ultimate: boolean): Foe[] {
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d;
    const uy = dy / d;
    const hits = this.foesOnLine(cat.x, cat.y, ux, uy, length, width);
    const S = ABILITIES.sable.special;
    const shred = this.hasSpecial('sable');
    for (const f of hits) {
      this.hit(f, dmg, true, { src: cat });
      // Sable 3★: armor-piercing form.
      if (shred && f.alive && f.armor > 0) {
        f.shred = Math.max(f.shred, S.armorShred);
        f.shredUntil = this.time + S.duration;
      }
    }
    cat.aimX = cat.x + ux * 20;
    cat.aimY = cat.y + uy * 20;
    const star = this.starOf(cat.type);
    this.addEffect({
      kind: 'slash',
      x1: cat.x + ux * 10,
      y1: cat.y + uy * 10,
      x2: cat.x + ux * length,
      y2: cat.y + uy * length,
      width: ultimate ? width * 1.4 : width,
      color: ultimate ? '#e8f4ff' : '#bfe0ff',
      born: this.vtime,
      dur: ultimate ? 0.45 : 0.28,
      star,
    });
    return hits;
  }

  /** Mice whose bodies touch a segment from (x, y) along unit (ux, uy). Exported logic for tests. */
  foesOnLine(x: number, y: number, ux: number, uy: number, length: number, width: number): Foe[] {
    return this.foes.filter((f) => {
      if (!f.alive) return false;
      const px = f.x - x;
      const py = f.y - y;
      const along = px * ux + py * uy;
      if (along < -f.radius || along > length + f.radius) return false;
      const perp = Math.abs(px * uy - py * ux);
      return perp <= width + f.radius;
    });
  }

  /** Shadow Pounce: a quick claw; wounded mice take execute damage. */
  private claw(cat: CatUnit, target: Foe, st: CatStats, dmg: number, mult: number, ultimate = false): void {
    const frac = (target.hp + target.shield) / Math.max(1, target.maxHp + target.maxShield);
    const execute = frac < st.executeThreshold;
    let m = mult * (execute ? st.executeMult : 1);
    // Pounce 3★: the strike after a kill is empowered.
    const S = ABILITIES.pounce.special;
    const empowered = cat.empowered;
    if (empowered) {
      m *= S.mult;
      cat.empowered = false;
    }
    cat.attackAt = this.vtime;
    cat.aimX = target.x;
    cat.aimY = target.y;
    const killed = this.hit(target, dmg * m, execute || empowered || ultimate, { src: cat });
    if (killed && this.hasSpecial(cat.type) && this.time >= cat.specialReadyAt) {
      cat.empowered = true;
      cat.specialReadyAt = this.time + S.cooldown;
    }
    const star = this.starOf(cat.type);
    this.addEffect({
      kind: 'claw',
      x: target.x,
      y: target.y - 4,
      rot: Math.atan2(target.y - cat.y, target.x - cat.x) + (this.vrand() - 0.5) * 0.6,
      color: execute || ultimate ? '#9fe0d0' : star >= 4 ? '#c8f0e4' : '#ffffff',
      born: this.vtime,
      dur: ultimate ? 0.3 : 0.2,
      big: execute || empowered || ultimate,
    });
  }

  /** Captain Mallow: allies in range attack faster for a few seconds (never stacks). */
  private ringBell(cat: CatUnit, st: CatStats): void {
    const r2 = st.range * st.range;
    for (const c of this.cats) {
      if (c === cat || (c.x - cat.x) ** 2 + (c.y - cat.y) ** 2 > r2) continue;
      if (c.buffSpeedUntil <= this.time || c.buffSpeed <= st.buffSpeed) {
        c.buffSpeed = st.buffSpeed;
        c.buffSpeedUntil = this.time + st.buffDuration;
      }
      c.buffAt = this.vtime;
    }
    this.addEffect({ kind: 'ring', x: cat.x, y: cat.y, r0: 10, r1: st.range, color: '#ffd36a', born: this.vtime, dur: 0.7, width: 3 });
    this.addEffect({ kind: 'bell', x: cat.x + 10, y: cat.y - 18, born: this.vtime, dur: 0.6 });
  }

  /** Captain Mallow 3★: a nearby merge inspires nearby allies (limited by its own cooldown). */
  private mallowTeamwork(merged: CatUnit): void {
    if (!this.hasSpecial('mallow') || this.time < this.mallowSpecialReadyAt) return;
    const S = ABILITIES.mallow.special;
    const captains = this.cats.filter((m) => m.type === 'mallow');
    for (const m of captains) {
      const st = this.unitStats(m);
      if ((m.x - merged.x) ** 2 + (m.y - merged.y) ** 2 > st.range * st.range) continue;
      for (const c of this.cats) {
        if ((c.x - m.x) ** 2 + (c.y - m.y) ** 2 > st.range * st.range) continue;
        c.buffDmg = Math.max(c.buffDmgUntil > this.time ? c.buffDmg : 0, S.dmgBuff);
        c.buffDmgUntil = this.time + S.duration;
        c.buffAt = this.vtime;
      }
      this.addEffect({ kind: 'bell', x: m.x + 10, y: m.y - 18, born: this.vtime, dur: 0.8, big: true });
      this.mallowSpecialReadyAt = this.time + S.cooldown;
      return;
    }
  }

  /** Silver Devil: poison refreshes its duration; consecutive hits on the same mouse can stack. */
  private applyPoison(f: Foe, dps: number, dur: number, maxStacks: number, src: CatUnit, forceMax = false): void {
    if (!f.alive || dps <= 0) return;
    const active = f.poisonUntil > this.time;
    let stacks = active ? f.poisonStacks : 0;
    if (forceMax) stacks = maxStacks;
    else if (active && src.lastHitUid === f.uid) stacks = Math.min(maxStacks, stacks + 1);
    else stacks = Math.max(stacks, 1);
    f.poisonStacks = Math.max(1, Math.min(Math.max(maxStacks, active ? f.poisonStacks : 1), stacks));
    f.poisonDps = Math.max(active ? f.poisonDps : 0, dps);
    f.poisonUntil = this.time + dur;
    src.lastHitUid = f.uid;
  }

  private poisonTick(f: Foe, dt: number): void {
    const P = ABILITIES.devil.ultimate;
    const marked = f.markUntil > this.time;
    const markMult = marked ? (f.isBoss ? P.bossPoisonMult : P.poisonMult) : 1;
    const bossMult = f.isBoss ? POISON_BOSS_MULT : 1;
    const dmg = f.poisonDps * f.poisonStacks * markMult * bossMult * dt;
    const r = applyDamageToPools(f.hp, f.shield, dmg);
    this.stats.damageDealt += Math.min(dmg, f.hp + f.shield);
    f.hp = r.hp;
    f.shield = r.shield;
    f.poisonShown += dmg;
    if (f.poisonShown >= 8) {
      this.addText(f.x + (this.vrand() - 0.5) * 10, f.y - f.radius - 4, String(Math.round(f.poisonShown)), '#b8f0a8', 10, 0.6);
      f.poisonShown = 0;
    }
    if (f.hp <= 0) this.kill(f);
    else this.checkBossPhase(f);
  }

  private updateProjectiles(dt: number): void {
    const spawned: Projectile[] = [];
    for (const p of this.projectiles) {
      const target = this.foes.find((f) => f.uid === p.targetUid);
      if (target && target.alive) {
        p.tx = target.x;
        p.ty = target.y;
      }
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const d = Math.hypot(dx, dy);
      const move = p.speed * dt;
      if (d <= move + 4) {
        p.done = true;
        if (target && target.alive) {
          const src = p.poison ? this.catByUid(p.poison.srcUid) : undefined;
          this.hit(target, p.damage, p.style === 'bullet' || (p.size ?? 1) > 1.2, { armorIgnore: p.armorIgnore });
          if (p.poison && src) this.applyPoison(target, p.poison.dps, p.poison.dur, p.poison.maxStacks, src);
          if (p.bounce && p.bounce.left > 0) {
            const next = this.bounceTarget(target, p.bounce.range, [...p.bounce.hit, target.uid]);
            if (next) {
              spawned.push({
                ...p,
                uid: this.nextUid++,
                x: target.x,
                y: target.y - 4,
                targetUid: next.uid,
                tx: next.x,
                ty: next.y,
                damage: p.damage * p.bounce.falloff,
                done: false,
                bounce: { ...p.bounce, left: p.bounce.left - 1, hit: [...p.bounce.hit, target.uid] },
              });
            }
          }
          if (p.style === 'magic')
            this.burst(p.tx, p.ty, ['#c89aff', '#ffd36a', ...((p.star ?? 1) >= 4 ? ['#ffffff'] : [])], 4 + (p.star ?? 1) * 2, 60);
          if (p.style === 'venom') this.burst(p.tx, p.ty, ['#b58ad6', '#9fd0a8'], 3 + (p.star ?? 1), 40);
        } else this.burst(p.tx, p.ty, ['#dddddd'], 3, 30);
      } else {
        p.x += (dx / d) * move;
        p.y += (dy / d) * move;
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.done).concat(spawned);
  }

  /** Mr. Whiskers: next ricochet target — the nearest mouse within jump range not hit yet. */
  bounceTarget(from: { x: number; y: number }, range: number, exclude: number[]): Foe | null {
    let best: Foe | null = null;
    let bestScore = Infinity;
    for (const f of this.foes) {
      if (!f.alive || exclude.includes(f.uid)) continue;
      const d2 = (f.x - from.x) ** 2 + (f.y - from.y) ** 2;
      if (d2 > range * range) continue;
      const score = d2 + (f.kind === 'chest' ? range * range : 0); // mice before chests
      if (score < bestScore) {
        best = f;
        bestScore = score;
      }
    }
    return best;
  }

  /** Apply one hit. Returns true if it defeated the foe. */
  private hit(f: Foe, raw: number, showNumber: boolean, opts: { armorIgnore?: number; src?: CatUnit } = {}): boolean {
    if (!f.alive) return false;
    const shred = f.shredUntil > this.time ? f.shred : 0;
    const armor = Math.max(0, f.armor - shred) * (1 - (opts.armorIgnore ?? 0));
    let dmg = computeDamage(raw, armor, this.mods.armorReduce);
    if (f.vulnUntil > this.time) dmg *= 1 + f.vulnerable;
    // Mouse Captain's guard: escorts near a living Captain take less damage from hits.
    if (f.kind === 'enemy' && f.defId !== 'captain' && this.isGuarded(f)) dmg *= 1 - BALANCE.elite.guardReduction;
    // Devil's Pact: allies' hits on the marked mouse deal a little bonus poison damage.
    if (f.markUntil > this.time && raw > 0) {
      const U = ABILITIES.devil.ultimate;
      dmg += raw * (f.isBoss ? U.bossAllyBonus : U.allyBonus);
    }
    const r = applyDamageToPools(f.hp, f.shield, dmg);
    this.stats.damageDealt += Math.min(dmg, f.hp + f.shield);
    f.hp = r.hp;
    f.shield = r.shield;
    f.hitAt = this.vtime;
    if (showNumber) this.addText(f.x + (this.vrand() - 0.5) * 10, f.y - f.radius - 6, String(Math.round(dmg)), '#ffffff', 12, 0.6);
    if (f.hp <= 0) {
      this.kill(f);
      return true;
    }
    this.checkBossPhase(f);
    return false;
  }

  /** Moonshadow Emperor's second phase: at half HP its veil regrows once and guards arrive. */
  private checkBossPhase(f: Foe): void {
    if (f.defId !== 'moonEmperor' || f.phased || !f.alive || f.hp > f.maxHp * BALANCE.boss.regrowAt) return;
    f.phased = true;
    f.shield = Math.max(f.shield, Math.round(f.maxShield * BALANCE.boss.regrowShield));
    for (let i = 0; i < BALANCE.boss.regrowGuards; i++) {
      const g = this.spawn({ enemy: 'normal', count: 1, interval: 1 });
      const d = Math.max(0, f.dist - 18 - i * 16);
      const p = this.path.pointAt(d);
      Object.assign(g, { dist: d, x: p.x, y: p.y });
    }
    this.addEffect({ kind: 'ring', x: f.x, y: f.y, r0: 10, r1: 60, color: '#b8a8ff', born: this.vtime, dur: 0.6, width: 5 });
    this.events.push({ type: 'bossPhase', enemy: f.defId as EnemyId });
  }

  /** Is this mouse inside a living Mouse Captain's guard aura? */
  isGuarded(f: Foe): boolean {
    const r2 = BALANCE.elite.guardRadius ** 2;
    for (const c of this.foes) if (c !== f && c.alive && c.defId === 'captain' && (c.x - f.x) ** 2 + (c.y - f.y) ** 2 <= r2) return true;
    return false;
  }

  private kill(f: Foe): void {
    f.alive = false;
    if (f.kind === 'enemy') {
      this.stats.kills++;
      const gain = Math.max(1, Math.round(f.reward * this.mods.fishMult));
      this.earn(gain);
      this.burst(f.x, f.y, ['#ffffff', '#e8e0f0', '#c8c0d8'], f.isBoss ? 40 : 9, f.isBoss ? 160 : 70);
      this.addText(f.x, f.y - 12, `+${gain}`, '#ff9f1c', f.isBoss ? 20 : 12, 0.8);
      if (f.isBoss) this.events.push({ type: 'bossDefeated', enemy: f.defId as EnemyId });
      return;
    }
    // Treasure chest
    if (f.rewarded) return;
    f.rewarded = true;
    this.stats.chestsOpened++;
    const tier = f.defId as ChestTier;
    const def = CHESTS[tier];
    const coins = this.rng.int(def.coins[0], def.coins[1]);
    this.chestCoins += coins;
    this.events.push({ type: 'coins', amount: coins, tier });
    const colors =
      tier === 'gold' ? ['#ffd700', '#fff2a0', '#ffffff'] : tier === 'silver' ? ['#dfe6ee', '#ffffff', '#a8c0d8'] : ['#d89a5a', '#ffd8a8', '#ffffff'];
    this.burst(f.x, f.y, colors, 34, 150);
    this.burst(f.x, f.y, ['#ffd040', '#ffe680'], 14, 110, -160);
    this.addEffect({ kind: 'ring', x: f.x, y: f.y, r0: 6, r1: 46, color: '#ffe066', born: this.vtime, dur: 0.5, width: 6 });
    const choices = this.rollChestChoices(tier);
    if (choices.length) {
      this.rewardQueue.push({ id: this.nextOfferId++, tier, coins, choices });
      this.status = 'reward';
    } else {
      this.earn(BALANCE.maxedChestFish);
      this.events.push({ type: 'maxedChestFish', fish: BALANCE.maxedChestFish });
    }
  }

  /**
   * Up to 3 distinct skills. Weighted by chest tier (basic vs improved) and by
   * relevance to the current formation; the first `chestRelevantMin` picks are
   * drawn only from relevant skills when enough exist.
   */
  rollChestChoices(tier: ChestTier): SkillChoice[] {
    const def = CHESTS[tier];
    const pool = this.availableSkills();
    const out: SkillChoice[] = [];
    const weightOf = (id: SkillId) => (SKILLS[id].tier === 'basic' ? def.tierWeights.basic : def.tierWeights.improved) * this.skillWeight(id);
    while (out.length < 3 && pool.length) {
      const needRelevant = out.length < SKILL_WEIGHTS.chestRelevantMin;
      const relevant = pool.filter((id) => this.isRelevantSkill(id));
      const from = needRelevant && relevant.length ? relevant : pool;
      const pick = from[this.rng.weighted(from.map(weightOf))];
      out.push({ skillId: pick, levels: def.levelsPerPick });
      pool.splice(pool.indexOf(pick), 1);
    }
    return out;
  }

  private grantSkill(id: SkillId, levels: number, source: 'shop' | 'chest'): void {
    const cur = this.skills[id] ?? 0;
    const next = Math.min(SKILLS[id].maxLevel, cur + levels);
    this.skills[id] = next;
    this.mods = computeSkillMods(this.skills);
    this.events.push({ type: 'skill', skillId: id, level: next, isNew: cur === 0, source });
    // The cats that benefit sparkle, so the upgrade feels tangible.
    const cat = SKILLS[id].cat;
    for (const c of this.cats) {
      if (cat && c.type !== cat) continue;
      c.buffAt = this.vtime;
      this.addEffect({ kind: 'ring', x: c.x, y: c.y, r0: 4, r1: 28, color: cat ? '#ffd84a' : '#c89aff', born: this.vtime, dur: 0.5, width: 4 });
      this.addEffect({ kind: 'text', x: c.x, y: c.y - 30, text: SKILLS[id].icon + '↑', color: '#ffffff', size: 13, born: this.vtime, dur: 0.9 });
    }
  }

  private earn(n: number): void {
    this.fish += n;
    this.stats.fishEarned += n;
  }

  private spend(n: number): void {
    this.fish -= n;
    this.stats.fishSpent += n;
  }

  private setTile(cat: CatUnit, tile: TileState): void {
    cat.tileId = tile.id;
    cat.x = tile.x;
    cat.y = tile.y;
    cat.movedAt = this.vtime;
    // Moving interrupts a wind-up / combo (it restarts from the new tile).
    cat.windup = null;
    cat.comboQueue = [];
  }

  private checkEnd(): void {
    if (this.sandbox) return;
    if (this.status !== 'playing' && this.status !== 'reward') return;
    if (this.baseHp <= 0) {
      this.status = 'defeat';
      this.rewardQueue = [];
      this.events.push({ type: 'defeat' });
      return;
    }
    if (this.status !== 'playing') return;
    const last = this.stage.waves.length - 1;
    if (this.waveIndex === last && this.spawnPtr >= this.spawnQueue.length && this.foes.length === 0 && this.rewardQueue.length === 0) {
      this.status = 'victory';
      this.events.push({ type: 'victory' });
    }
  }

  // ---------------- Visual helpers (do not touch game RNG) ----------------

  private vrand(): number {
    return Math.random();
  }

  private addEffect(e: Effect): void {
    if (this.effects.length >= MAX_EFFECTS) this.effects.shift();
    this.effects.push(e);
  }

  private addText(x: number, y: number, text: string, color: string, size: number, dur: number): void {
    this.addEffect({ kind: 'text', x, y, text, color, size, born: this.vtime, dur });
  }

  private burst(x: number, y: number, colors: string[], n: number, speed: number, lift = 0): void {
    const parts = [];
    for (let i = 0; i < n; i++) {
      const a = this.vrand() * Math.PI * 2;
      const s = speed * (0.4 + this.vrand() * 0.6);
      parts.push({ vx: Math.cos(a) * s, vy: Math.sin(a) * s + lift, color: colors[i % colors.length], size: 2 + this.vrand() * 2.5 });
    }
    this.addEffect({ kind: 'particles', x, y, parts, born: this.vtime, dur: lift ? 0.9 : 0.55, gravity: lift ? 260 : 40 });
  }

  /** Drain pending events (UI calls this once per frame). */
  drainEvents(): BattleEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }
}
