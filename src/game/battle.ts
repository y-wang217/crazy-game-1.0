import { BALANCE, skillRollCost, summonCost } from '../config/balance';
import { CATS, TARGET_MODES, TARGET_MODE_INFO } from '../config/cats';
import { CHESTS, ENEMIES } from '../config/enemies';
import { SKILLS, SKILL_ORDER } from '../config/skills';
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
  // Visual timestamps (battle.time); renderer derives animation from these.
  spawnAt: number;
  mergeAt: number;
  attackAt: number;
  modeAt: number;
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
  | { kind: 'ring'; x: number; y: number; r0: number; r1: number; color: string; born: number; dur: number }
  | { kind: 'text'; x: number; y: number; text: string; color: string; size: number; born: number; dur: number; stroke?: string }
  | {
      kind: 'particles';
      x: number;
      y: number;
      parts: { vx: number; vy: number; color: string; size: number }[];
      born: number;
      dur: number;
    }
  | { kind: 'pow'; x: number; y: number; rot: number; born: number; dur: number }
  | { kind: 'hearts'; x: number; y: number; born: number; dur: number };

export type BattleStatus = 'playing' | 'paused' | 'reward' | 'victory' | 'defeat';

export interface SkillChoice {
  skillId: SkillId;
  levels: number;
}

export interface RewardOffer {
  tier: ChestTier;
  coins: number;
  choices: SkillChoice[];
}

export type BattleEvent =
  | { type: 'toast'; text: string; tone: 'info' | 'warn' | 'good' }
  | { type: 'coins'; amount: number; tier: ChestTier }
  | { type: 'skill'; skillId: SkillId; level: number; isNew: boolean }
  | { type: 'wave'; wave: number; total: number }
  | { type: 'victory' }
  | { type: 'defeat' };

export interface TileState {
  id: string;
  c: number;
  r: number;
  x: number;
  y: number;
  unlocked: boolean;
}

export type ActionResult = { ok: true } | { ok: false; reason: string };
export type DropResult = { result: 'moved' | 'merged' | 'cancel'; reason?: string };

/** Pure merge rule, exported for tests and UI highlighting. */
export function canMerge(a: Pick<CatUnit, 'uid' | 'type' | 'level'>, b: Pick<CatUnit, 'uid' | 'type' | 'level'>): boolean {
  return a.uid !== b.uid && a.type === b.type && a.level === b.level && a.level < BALANCE.levels.maxLevel;
}

const STEP = 1 / 60;
const MAX_EFFECTS = 260;

// ---------------------------------------------------------------------------
// Battle simulation
// ---------------------------------------------------------------------------

export class Battle {
  readonly stage: StageDef;
  readonly map: MapDef;
  readonly path: PathGeom;
  readonly tiles: TileState[];
  private rng: Rng;
  private nextUid = 1;

  status: BattleStatus = 'playing';
  time = 0;
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
  kills = 0;
  chestCoins = 0;

  /** -1 while waiting for the first wave. */
  waveIndex = -1;
  private prepTimer: number = BALANCE.firstWaveDelay;
  private waveTimer = 0;
  private gapTimer = 0;
  private spawnQueue: { time: number; group: SpawnGroup }[] = [];
  private spawnPtr = 0;
  private waveSpawnDone: boolean[];
  private waveBonusGiven: boolean[];
  rewardQueue: RewardOffer[] = [];

  constructor(stage: StageDef, map: MapDef, seed: number = Date.now()) {
    this.stage = stage;
    this.map = map;
    this.path = PathGeom.fromMap(map);
    this.rng = new Rng(seed);
    this.fish = stage.startFish;
    this.baseHp = stage.baseHp;
    this.maxBaseHp = stage.baseHp;
    const unlocked = new Set(stage.tiles);
    this.tiles = map.tiles.map((t) => {
      const p = cellCenter(map, t.c, t.r);
      return { id: t.id, c: t.c, r: t.r, x: p.x, y: p.y, unlocked: unlocked.has(t.id) };
    });
    this.waveSpawnDone = stage.waves.map(() => false);
    this.waveBonusGiven = stage.waves.map(() => false);
  }

  // ---------------- Queries ----------------

  get summonCost(): number {
    return summonCost(this.summons);
  }
  get skillCost(): number {
    return skillRollCost(this.skillRolls);
  }
  get totalWaves(): number {
    return this.stage.waves.length;
  }
  /** Seconds until wave 1 (only meaningful while waveIndex === -1). */
  get prepRemaining(): number {
    return Math.max(0, this.prepTimer);
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
      if (def.requiresCat && !this.stage.roster.includes(def.requiresCat)) return false;
      return true;
    });
  }
  get currentReward(): RewardOffer | null {
    return this.rewardQueue[0] ?? null;
  }

  // ---------------- Player actions ----------------

  pause(): void {
    if (this.status === 'playing') this.status = 'paused';
  }
  resume(): void {
    if (this.status === 'paused') this.status = 'playing';
  }

  summon(): ActionResult {
    if (this.status !== 'playing') return { ok: false, reason: 'Not now!' };
    const empty = this.emptyTiles();
    if (!empty.length) return { ok: false, reason: 'Board is full — merge cats to make room!' };
    const cost = this.summonCost;
    if (this.fish < cost) return { ok: false, reason: 'Not enough dried fish!' };
    this.fish -= cost;
    this.summons++;
    const type = this.rng.pick(this.stage.roster);
    const tile = this.rng.pick(empty);
    const cat: CatUnit = {
      uid: this.nextUid++,
      type,
      level: 1,
      tileId: tile.id,
      x: tile.x,
      y: tile.y,
      mode: 'first',
      cooldown: 0.3,
      spawnAt: this.time,
      mergeAt: -99,
      attackAt: -99,
      modeAt: -99,
      aimX: tile.x + 1,
      aimY: tile.y,
    };
    this.cats.push(cat);
    this.burst(tile.x, tile.y, ['#fff6c8', '#ffd86b', '#ffffff'], 12, 70);
    return { ok: true };
  }

  buySkill(): ActionResult & { skillId?: SkillId } {
    if (this.status !== 'playing') return { ok: false, reason: 'Not now!' };
    const pool = this.availableSkills();
    if (!pool.length) return { ok: false, reason: 'All skills are maxed!' };
    const cost = this.skillCost;
    if (this.fish < cost) return { ok: false, reason: 'Not enough dried fish!' };
    this.fish -= cost;
    this.skillRolls++;
    const id = this.rng.pick(pool);
    this.grantSkill(id, 1);
    return { ok: true, skillId: id };
  }

  /** Drop a dragged cat on a tile: move to empty, merge with compatible, otherwise cancel. */
  dropCat(uid: number, tileId: string | null): DropResult {
    if (this.status === 'victory' || this.status === 'defeat' || this.status === 'reward') {
      return { result: 'cancel' };
    }
    const cat = this.catByUid(uid);
    if (!cat || !tileId || tileId === cat.tileId) return { result: 'cancel' };
    const tile = this.tileById(tileId);
    if (!tile || !tile.unlocked) return { result: 'cancel', reason: tile ? 'That spot is locked.' : undefined };
    const occupant = this.catAt(tileId);
    if (!occupant) {
      cat.tileId = tile.id;
      cat.x = tile.x;
      cat.y = tile.y;
      return { result: 'moved' };
    }
    if (canMerge(cat, occupant)) {
      occupant.level += 1;
      occupant.mergeAt = this.time;
      occupant.cooldown = Math.min(occupant.cooldown, 0.2);
      this.cats = this.cats.filter((c) => c.uid !== cat.uid);
      this.burst(occupant.x, occupant.y, ['#ffe066', '#ffffff', '#ffb3d1', '#a8e6ff'], 22, 110);
      this.addEffect({ kind: 'ring', x: occupant.x, y: occupant.y, r0: 8, r1: 34, color: '#ffe066', born: this.time, dur: 0.45 });
      this.addText(occupant.x, occupant.y - 26, `Lv.${occupant.level}!`, '#ff9f1c', 15, 0.9);
      return { result: 'merged' };
    }
    if (occupant.type === cat.type && occupant.level === cat.level) {
      return { result: 'cancel', reason: 'Already max level!' };
    }
    return { result: 'cancel', reason: 'Only identical cats of the same level can merge.' };
  }

  cycleTarget(uid: number): TargetMode | null {
    const cat = this.catByUid(uid);
    if (!cat) return null;
    cat.mode = nextTargetMode(cat.mode, TARGET_MODES);
    cat.modeAt = this.time;
    const info = TARGET_MODE_INFO[cat.mode];
    this.addEffect({ kind: 'text', x: cat.x, y: cat.y - 30, text: info.label, color: '#ffffff', stroke: info.color, size: 13, born: this.time, dur: 0.9 });
    return cat.mode;
  }

  chooseReward(index: number): ActionResult {
    if (this.status !== 'reward') return { ok: false, reason: 'No reward pending.' };
    const offer = this.rewardQueue[0];
    const choice = offer?.choices[index];
    if (!choice) return { ok: false, reason: 'Invalid choice.' };
    this.grantSkill(choice.skillId, choice.levels);
    this.rewardQueue.shift();
    if (!this.rewardQueue.length) this.status = 'playing';
    return { ok: true };
  }

  // ---------------- Simulation ----------------

  update(dt: number): void {
    let remaining = Math.min(dt, 0.5);
    while (remaining > 1e-9 && this.status === 'playing') {
      const h = Math.min(STEP, remaining);
      this.step(h);
      remaining -= h;
    }
  }

  private step(dt: number): void {
    this.time += dt;
    this.updateWaves(dt);
    this.updateFoes(dt);
    this.updateCats(dt);
    this.updateProjectiles(dt);
    this.foes = this.foes.filter((f) => f.alive);
    if (this.effects.length) this.effects = this.effects.filter((e) => this.time - e.born < e.dur);
    this.checkEnd();
  }

  private updateWaves(dt: number): void {
    const waves = this.stage.waves;
    if (this.waveIndex === -1) {
      this.prepTimer -= dt;
      if (this.prepTimer <= 0) this.startWave(0);
      return;
    }
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
        if ((!hostile && this.gapTimer >= BALANCE.clearedWaveGap) || this.gapTimer >= BALANCE.waveGap) {
          this.startWave(this.waveIndex + 1);
        }
      }
    }
    // Wave-clear bonuses
    for (let w = 0; w <= this.waveIndex; w++) {
      if (!this.waveSpawnDone[w] || this.waveBonusGiven[w]) continue;
      if (this.foes.some((f) => f.alive && f.kind === 'enemy' && f.wave === w)) continue;
      this.waveBonusGiven[w] = true;
      if (w < waves.length - 1) {
        this.fish += BALANCE.waveClearBonus;
        this.events.push({ type: 'toast', text: `Wave ${w + 1} cleared! +${BALANCE.waveClearBonus} fish`, tone: 'good' });
      }
    }
  }

  private startWave(i: number): void {
    this.waveIndex = i;
    this.waveTimer = 0;
    this.gapTimer = 0;
    this.spawnPtr = 0;
    const q: { time: number; group: SpawnGroup }[] = [];
    for (const g of this.stage.waves[i].groups) {
      const delay = g.delay ?? 0;
      if ('chest' in g) {
        q.push({ time: delay, group: g });
      } else {
        for (let k = 0; k < g.count; k++) q.push({ time: delay + k * g.interval, group: g });
      }
    }
    q.sort((a, b) => a.time - b.time);
    this.spawnQueue = q;
    this.events.push({ type: 'wave', wave: i + 1, total: this.stage.waves.length });
  }

  private spawn(g: SpawnGroup): void {
    const p = this.path.pointAt(0);
    const scale = this.stage.hpScale;
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
      bornAt: this.time,
      rewarded: false,
    };
    if ('chest' in g) {
      const def = CHESTS[g.chest];
      const hp = Math.round(def.hp * scale);
      this.foes.push({
        ...base,
        kind: 'chest',
        defId: def.tier,
        hp,
        maxHp: hp,
        shield: 0,
        maxShield: 0,
        armor: 0,
        speed: def.speed,
        reward: 0,
        baseDamage: 0,
        radius: def.radius,
        isBoss: false,
      });
      this.events.push({ type: 'toast', text: `A ${def.name} appeared!`, tone: 'good' });
    } else {
      const def = ENEMIES[g.enemy];
      const hp = Math.round(def.hp * scale);
      const shield = Math.round(def.shield * scale);
      this.foes.push({
        ...base,
        kind: 'enemy',
        defId: def.id,
        hp,
        maxHp: hp,
        shield,
        maxShield: shield,
        armor: def.armor,
        speed: def.speed,
        reward: Math.round(def.reward * Math.pow(scale, BALANCE.rewardScaleExponent)),
        baseDamage: def.baseDamage,
        radius: def.radius,
        isBoss: !!def.isBoss,
      });
      if (def.isBoss) this.events.push({ type: 'toast', text: `${def.name} approaches!`, tone: 'warn' });
    }
  }

  private updateFoes(dt: number): void {
    const end = this.path.length;
    for (const f of this.foes) {
      if (!f.alive) continue;
      if (f.slowT > 0) {
        f.slowT -= dt;
        if (f.slowT <= 0) f.slowStrength = 0;
      }
      f.dist += f.speed * (1 - f.slowStrength) * dt;
      const p = this.path.pointAt(f.dist);
      f.x = p.x;
      f.y = p.y;
      if (Math.abs(p.dx) > 0.1) f.dirX = p.dx > 0 ? 1 : -1;
      if (f.dist >= end) {
        f.alive = false;
        if (f.kind === 'enemy') {
          this.baseHp = Math.max(0, this.baseHp - f.baseDamage);
          this.addText(f.x, f.y - 20, `-${f.baseDamage} ♥`, '#e04848', 16, 1.0);
        } else {
          this.events.push({ type: 'toast', text: 'A treasure chest got away…', tone: 'warn' });
        }
      }
    }
  }

  private updateCats(dt: number): void {
    for (const cat of this.cats) {
      cat.cooldown -= dt;
      if (cat.cooldown > 0) continue;
      const def = CATS[cat.type];
      const st = getCatStats(def, cat.level, this.mods);
      const target = selectTarget(cat.x, cat.y, st.range, cat.mode, this.foes);
      if (!target) {
        cat.cooldown = 0;
        continue;
      }
      cat.cooldown = st.interval;
      cat.attackAt = this.time;
      cat.aimX = target.x;
      cat.aimY = target.y;

      switch (def.attack) {
        case 'projectile':
        case 'snipe':
          this.projectiles.push({
            uid: this.nextUid++,
            x: cat.x,
            y: cat.y - 4,
            targetUid: target.uid,
            tx: target.x,
            ty: target.y,
            damage: st.damage,
            speed: def.projectileSpeed ?? 400,
            style: def.attack === 'snipe' ? 'bullet' : 'yarn',
            done: false,
          });
          break;
        case 'combo': {
          for (let i = 0; i < st.comboHits && target.alive; i++) this.hit(target, st.damage, false);
          for (let i = 0; i < Math.min(st.comboHits, 6); i++) {
            this.addEffect({
              kind: 'pow',
              x: target.x + (this.vrand() - 0.5) * 14,
              y: target.y + (this.vrand() - 0.5) * 12,
              rot: this.vrand() * Math.PI,
              born: this.time + i * 0.07,
              dur: 0.22,
            });
          }
          break;
        }
        case 'slam': {
          const tx = target.x;
          const ty = target.y;
          const r2 = st.splashRadius * st.splashRadius;
          const others = this.foes.filter(
            (f) => f.alive && f !== target && (f.x - tx) ** 2 + (f.y - ty) ** 2 <= r2,
          );
          this.hit(target, st.damage, true);
          for (const f of others) this.hit(f, st.damage * st.splashRatio, true);
          this.addEffect({ kind: 'ring', x: tx, y: ty, r0: 6, r1: st.splashRadius, color: '#c87a3a', born: this.time + 0.18, dur: 0.55 });
          break;
        }
        case 'aura': {
          const r2 = st.range * st.range;
          for (const f of this.foes) {
            if (!f.alive || (f.x - cat.x) ** 2 + (f.y - cat.y) ** 2 > r2) continue;
            const s = Math.min(BALANCE.slowCap, st.slowStrength + (f === target ? st.focusBonus : 0));
            f.slowStrength = f.slowT > 0 ? Math.max(f.slowStrength, s) : s;
            f.slowT = Math.max(f.slowT, st.slowDuration);
            this.addEffect({ kind: 'hearts', x: f.x, y: f.y - f.radius, born: this.time, dur: 0.9 });
          }
          this.addEffect({ kind: 'ring', x: cat.x, y: cat.y, r0: 10, r1: st.range, color: '#ff8fc0', born: this.time, dur: 0.7 });
          break;
        }
      }
    }
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
    f.hp = r.hp;
    f.shield = r.shield;
    f.hitAt = this.time;
    if (showNumber) this.addText(f.x + (this.vrand() - 0.5) * 10, f.y - f.radius - 6, String(Math.round(dmg)), '#ffffff', 12, 0.6);
    if (f.hp <= 0) this.kill(f);
  }

  private kill(f: Foe): void {
    f.alive = false;
    if (f.kind === 'enemy') {
      this.kills++;
      const gain = Math.round(f.reward * this.mods.fishMult);
      this.fish += gain;
      this.burst(f.x, f.y, ['#ffffff', '#e8e0f0', '#c8c0d8'], f.isBoss ? 40 : 9, f.isBoss ? 160 : 70);
      this.addText(f.x, f.y - 12, `+${gain}`, '#ff9f1c', f.isBoss ? 20 : 12, 0.8);
      if (f.isBoss) this.events.push({ type: 'toast', text: 'The Big Cheese King is defeated!', tone: 'good' });
      return;
    }
    // Treasure chest
    if (f.rewarded) return;
    f.rewarded = true;
    const tier = f.defId as ChestTier;
    const def = CHESTS[tier];
    const coins = this.rng.int(def.coins[0], def.coins[1]);
    this.chestCoins += coins;
    this.events.push({ type: 'coins', amount: coins, tier });
    const colors = tier === 'gold' ? ['#ffd700', '#fff2a0', '#ffffff'] : tier === 'silver' ? ['#dfe6ee', '#ffffff', '#a8c0d8'] : ['#d89a5a', '#ffd8a8', '#ffffff'];
    this.burst(f.x, f.y, colors, 26, 130);
    const choices = this.rollChestChoices(tier);
    if (choices.length) {
      this.rewardQueue.push({ tier, coins, choices });
      this.status = 'reward';
    } else {
      this.fish += 30;
      this.events.push({ type: 'toast', text: 'All skills maxed — +30 dried fish instead!', tone: 'good' });
    }
  }

  /** Up to 3 distinct skills, weighted by chest tier. */
  rollChestChoices(tier: ChestTier): SkillChoice[] {
    const def = CHESTS[tier];
    const pool = this.availableSkills();
    const out: SkillChoice[] = [];
    while (out.length < 3 && pool.length) {
      const weights = pool.map((id) => (SKILLS[id].tier === 'basic' ? def.tierWeights.basic : def.tierWeights.improved));
      const i = this.rng.weighted(weights);
      out.push({ skillId: pool[i], levels: def.levelsPerPick });
      pool.splice(i, 1);
    }
    return out;
  }

  private grantSkill(id: SkillId, levels: number): void {
    const cur = this.skills[id] ?? 0;
    const next = Math.min(SKILLS[id].maxLevel, cur + levels);
    this.skills[id] = next;
    this.mods = computeSkillMods(this.skills);
    this.events.push({ type: 'skill', skillId: id, level: next, isNew: cur === 0 });
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
    if (
      this.waveIndex === last &&
      this.spawnPtr >= this.spawnQueue.length &&
      this.foes.length === 0 &&
      this.rewardQueue.length === 0
    ) {
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
    this.addEffect({ kind: 'text', x, y, text, color, size, born: this.time, dur });
  }

  private burst(x: number, y: number, colors: string[], n: number, speed: number): void {
    const parts = [];
    for (let i = 0; i < n; i++) {
      const a = this.vrand() * Math.PI * 2;
      const s = speed * (0.4 + this.vrand() * 0.6);
      parts.push({ vx: Math.cos(a) * s, vy: Math.sin(a) * s, color: colors[i % colors.length], size: 2 + this.vrand() * 2.5 });
    }
    this.addEffect({ kind: 'particles', x, y, parts, born: this.time, dur: 0.55 });
  }

  /** Drain pending events (UI calls this once per frame). */
  drainEvents(): BattleEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }
}
