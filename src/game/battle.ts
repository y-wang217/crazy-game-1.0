import { BALANCE, skillRollCost, summonCost } from '../config/balance';
import { CATS, TARGET_MODES } from '../config/cats';
import { NEUTRAL_TUNING, type Tuning } from '../config/debug';
import { CHESTS, ENEMIES } from '../config/enemies';
import { SKILLS, SKILL_ORDER, SKILL_WEIGHTS } from '../config/skills';
import { applyDamageToPools, computeDamage, computeSkillMods, getCatStats, type SkillMods } from './combat';
import { PathGeom, cellCenter } from './path';
import { Rng } from './rng';
import { nextTargetMode, selectTarget, type TargetCandidate } from './targeting';
import type {
  CatId,
  ChestTier,
  EnemyId,
  MapDef,
  SkillId,
  SpawnGroup,
  StageDef,
  TargetMode,
} from './types';

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
  comboQueue: { at: number; targetUid: number }[];
  /** Counts punches (alternates paws in the animation). */
  comboIndex: number;
  aimX: number;
  aimY: number;
}

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
  style: 'yarn' | 'bullet';
  done: boolean;
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
    }
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
  | { type: 'bossAppeared' }
  | { type: 'bossDefeated' }
  | { type: 'maxedChestFish'; fish: number }
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
}

export interface BattleOptions {
  seed?: number;
  tuning?: Tuning;
}

/** Pure merge rule, exported for tests and UI highlighting. */
export function canMerge(a: Pick<CatUnit, 'uid' | 'type' | 'level'>, b: Pick<CatUnit, 'uid' | 'type' | 'level'>): boolean {
  return a.uid !== b.uid && a.type === b.type && a.level === b.level && a.level < BALANCE.levels.maxLevel;
}

const STEP = 1 / 60;
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
  private spawnQueue: { time: number; group: SpawnGroup }[] = [];
  private spawnPtr = 0;
  private waveSpawnDone: boolean[];
  private waveBonusGiven: boolean[];
  rewardQueue: RewardOffer[] = [];

  constructor(stage: StageDef, map: MapDef, opts: number | BattleOptions = {}) {
    const o: BattleOptions = typeof opts === 'number' ? { seed: opts } : opts;
    this.stage = stage;
    this.map = map;
    this.tuning = { ...NEUTRAL_TUNING, ...(o.tuning ?? {}) };
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

  // ---------------- Queries ----------------

  get summonCost(): number {
    return summonCost(this.summons, this.tuning.summonCostMult);
  }
  get skillCost(): number {
    return skillRollCost(this.skillRolls);
  }
  get skillShopUnlocked(): boolean {
    return this.stage.number >= BALANCE.unlocks.skillShopFromStage;
  }
  get totalWaves(): number {
    return this.stage.waves.length;
  }
  /** True while the simulation is actually advancing. */
  get running(): boolean {
    return this.status === 'playing' && !this.frozen && !this.preparing;
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
    this.startWave(0);
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
      if (def.cat && !this.stage.roster.includes(def.cat)) return false;
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

  pause(): void {
    if (this.status === 'playing') this.status = 'paused';
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
    const type = this.rng.pick(this.stage.roster);
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
    };
    this.cats.push(cat);
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
    this.updateCats(dt);
    this.updateProjectiles(dt);
    this.foes = this.foes.filter((f) => f.alive);
    this.cleanupEffects();
    this.checkEnd();
  }

  private cleanupEffects(): void {
    if (this.effects.length) this.effects = this.effects.filter((e) => this.vtime - e.born < e.dur);
  }

  private updateWaves(dt: number): void {
    const waves = this.stage.waves;
    if (this.waveIndex === -1) return; // still preparing
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
        if ((!hostile && this.gapTimer >= BALANCE.clearedWaveGap * gapMult) || this.gapTimer >= BALANCE.waveGap * gapMult) {
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
    this.spawnPtr = 0;
    const T = this.tuning;
    const q: { time: number; group: SpawnGroup }[] = [];
    for (const g of this.stage.waves[i].groups) {
      const delay = (g.delay ?? 0) * T.waveIntervalMult;
      if ('chest' in g) {
        q.push({ time: delay, group: g });
      } else {
        const count = Math.max(1, Math.round(g.count * T.enemyCountMult));
        const interval = g.interval * T.waveIntervalMult / Math.max(0.25, T.enemyCountMult);
        for (let k = 0; k < count; k++) q.push({ time: delay + k * interval, group: g });
      }
    }
    q.sort((a, b) => a.time - b.time);
    this.spawnQueue = q;
    this.events.push({ type: 'wave', wave: i + 1, total: this.stage.waves.length });
  }

  /** Toughness multiplier for the current wave (stage scale × in-stage ramp × debug). */
  private toughness(): number {
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
    };
    let foe: Foe;
    if ('chest' in g) {
      const def = CHESTS[g.chest];
      const chestScale = 1 + BALANCE.chest.hpPerStage * (this.stage.number - 1);
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
        armor: def.armor,
        speed: def.speed * this.tuning.enemySpeedMult,
        reward: Math.max(1, Math.round(def.reward * Math.pow(tough, BALANCE.rewardScaleExponent))),
        baseDamage: def.baseDamage,
        radius: def.radius,
        isBoss: !!def.isBoss,
      };
      if (def.isBoss) this.events.push({ type: 'bossAppeared' });
    }
    this.foes.push(foe);
    return foe;
  }

  private updateFoes(dt: number): void {
    const end = this.path.length;
    for (const f of this.foes) {
      if (!f.alive) continue;
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
      const st = getCatStats(def, cat.level, this.mods);
      const dmg = st.damage * this.tuning.catDamageMult;

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
      const target = selectTarget(cat.x, cat.y, st.range, cat.mode, this.foes);
      if (!target) {
        cat.cooldown = 0;
        continue;
      }
      cat.cooldown = st.interval;
      cat.aimX = target.x;
      cat.aimY = target.y;

      if (def.windup) {
        // Commit now, hit later. The slam lands where the target WAS when the wind-up began.
        const len = Math.min(def.windup, st.interval * 0.8);
        cat.windup = { start: this.time, fireAt: this.time + len, targetUid: target.uid, x: target.x, y: target.y };
        continue;
      }

      cat.attackAt = this.vtime;
      switch (def.attack) {
        case 'projectile':
          this.projectiles.push({
            uid: this.nextUid++,
            x: cat.x,
            y: cat.y - 4,
            targetUid: target.uid,
            tx: target.x,
            ty: target.y,
            damage: dmg,
            speed: def.projectileSpeed ?? 400,
            style: 'yarn',
            done: false,
          });
          break;
        case 'combo': {
          const gap = (def.comboGap ?? 0.08) / Math.max(1, st.comboHits / 3);
          for (let i = 0; i < st.comboHits; i++) cat.comboQueue.push({ at: this.time + i * gap, targetUid: target.uid });
          this.runCombo(cat, st, dmg);
          break;
        }
        case 'aura':
          this.charm(cat, target, st);
          break;
        default:
          break;
      }
    }
  }

  /** Deliver due combo punches; if the target drops, the rest go to the next mouse in reach. */
  private runCombo(cat: CatUnit, st: ReturnType<typeof getCatStats>, dmg: number): void {
    while (cat.comboQueue.length && cat.comboQueue[0].at <= this.time + 1e-9) {
      const h = cat.comboQueue.shift()!;
      let f = this.foes.find((x) => x.uid === h.targetUid && x.alive);
      const reach2 = (st.range * 1.2) ** 2;
      if (!f || (f.x - cat.x) ** 2 + (f.y - cat.y) ** 2 > reach2) {
        f = selectTarget(cat.x, cat.y, st.range, cat.mode, this.foes) ?? undefined;
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
      this.hit(f, dmg, false);
      this.addEffect({
        kind: 'pow',
        x: f.x + (this.vrand() - 0.5) * 12,
        y: f.y - 4 + (this.vrand() - 0.5) * 10,
        rot: this.vrand() * Math.PI,
        born: this.vtime,
        dur: 0.2,
      });
    }
  }

  /** Orange belly slam: everything near the impact point is hit at the same moment. */
  private slam(cat: CatUnit, x: number, y: number, targetUid: number, st: ReturnType<typeof getCatStats>, dmg: number): void {
    const r2 = st.splashRadius * st.splashRadius;
    const hitList = this.foes.filter((f) => f.alive && (f.x - x) ** 2 + (f.y - y) ** 2 <= r2);
    for (const f of hitList) this.hit(f, f.uid === targetUid ? dmg : dmg * st.splashRatio, true);
    this.stats.slamHits += hitList.length;
    this.addEffect({ kind: 'ring', x, y, r0: 8, r1: st.splashRadius, color: '#e0883a', born: this.vtime, dur: 0.5, width: 7 });
    this.addEffect({ kind: 'ring', x, y, r0: 4, r1: st.splashRadius * 0.6, color: '#fff2c0', born: this.vtime, dur: 0.35, width: 5 });
    this.burst(x, y, ['#c8a070', '#e8d0a8', '#a07850'], 18, 120);
    // (No board/screen shake: the impact stays local — shockwave, dust and hit reactions.)
    this.addEffect({ kind: 'ring', x, y, r0: st.splashRadius * 0.85, r1: st.splashRadius * 1.05, color: '#c8a070', born: this.vtime + 0.05, dur: 0.3, width: 3 });
    if (!hitList.length) this.addText(x, y - 14, '…', '#ffffff', 14, 0.6);
    cat.aimX = x;
    cat.aimY = y;
  }

  /** Black Cat: after aiming, one heavy shot (re-acquires if the aimed target is gone). */
  private fireShot(cat: CatUnit, targetUid: number, st: ReturnType<typeof getCatStats>, dmg: number): void {
    const reach2 = (st.range * 1.15) ** 2;
    let f = this.foes.find((x) => x.uid === targetUid && x.alive && (x.x - cat.x) ** 2 + (x.y - cat.y) ** 2 <= reach2);
    if (!f) f = selectTarget(cat.x, cat.y, st.range, cat.mode, this.foes) ?? undefined;
    if (!f) return;
    cat.aimX = f.x;
    cat.aimY = f.y;
    this.projectiles.push({
      uid: this.nextUid++,
      x: cat.x + Math.cos(Math.atan2(f.y - cat.y, f.x - cat.x)) * 26,
      y: cat.y + 4 + Math.sin(Math.atan2(f.y - cat.y, f.x - cat.x)) * 26,
      targetUid: f.uid,
      tx: f.x,
      ty: f.y,
      damage: dmg,
      speed: CATS[cat.type].projectileSpeed ?? 900,
      style: 'bullet',
      done: false,
    });
  }

  /** Noble White: every mouse in range is distracted; her focus target even more. */
  private charm(cat: CatUnit, target: Foe, st: ReturnType<typeof getCatStats>): void {
    const r2 = st.range * st.range;
    for (const f of this.foes) {
      if (!f.alive || (f.x - cat.x) ** 2 + (f.y - cat.y) ** 2 > r2) continue;
      const s = Math.min(BALANCE.slowCap, st.slowStrength + (f === target ? st.focusBonus : 0));
      f.slowStrength = f.slowT > 0 ? Math.max(f.slowStrength, s) : s;
      f.slowT = Math.max(f.slowT, st.slowDuration);
      f.charmedAt = this.vtime;
      this.addEffect({ kind: 'hearts', x: f.x, y: f.y - f.radius, born: this.vtime, dur: 0.9 });
    }
    this.addEffect({ kind: 'ring', x: cat.x, y: cat.y, r0: 10, r1: st.range, color: '#ff8fc0', born: this.vtime, dur: 0.8, width: 5 });
    this.addEffect({ kind: 'sparkle', x: cat.x, y: cat.y - 12, born: this.vtime, dur: 0.8 });
  }

  private updateProjectiles(dt: number): void {
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
        if (target && target.alive) this.hit(target, p.damage, p.style === 'bullet');
        else this.burst(p.tx, p.ty, ['#dddddd'], 3, 30);
      } else {
        p.x += (dx / d) * move;
        p.y += (dy / d) * move;
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.done);
  }

  private hit(f: Foe, raw: number, showNumber: boolean): void {
    if (!f.alive) return;
    const dmg = computeDamage(raw, f.armor, this.mods.armorReduce);
    const r = applyDamageToPools(f.hp, f.shield, dmg);
    this.stats.damageDealt += Math.min(dmg, f.hp + f.shield);
    f.hp = r.hp;
    f.shield = r.shield;
    f.hitAt = this.vtime;
    if (showNumber) this.addText(f.x + (this.vrand() - 0.5) * 10, f.y - f.radius - 6, String(Math.round(dmg)), '#ffffff', 12, 0.6);
    if (f.hp <= 0) this.kill(f);
  }

  private kill(f: Foe): void {
    f.alive = false;
    if (f.kind === 'enemy') {
      this.stats.kills++;
      const gain = Math.max(1, Math.round(f.reward * this.mods.fishMult));
      this.earn(gain);
      this.burst(f.x, f.y, ['#ffffff', '#e8e0f0', '#c8c0d8'], f.isBoss ? 40 : 9, f.isBoss ? 160 : 70);
      this.addText(f.x, f.y - 12, `+${gain}`, '#ff9f1c', f.isBoss ? 20 : 12, 0.8);
      if (f.isBoss) this.events.push({ type: 'bossDefeated' });
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
    const weightOf = (id: SkillId) =>
      (SKILLS[id].tier === 'basic' ? def.tierWeights.basic : def.tierWeights.improved) * this.skillWeight(id);
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
