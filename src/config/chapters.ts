import { BALANCE } from './balance';
import type { ChapterDef, ChestTier, EnemyId, SpawnGroup, StageDef, WaveDef } from '../game/types';

// ---------------------------------------------------------------------------
// Wave builder
// ---------------------------------------------------------------------------
// Each stage describes its waves with a few numbers instead of hand-writing 15
// waves. Tweak `count`, `growth`, `interval` and `mix` to rebalance a stage.

type Mix = Partial<Record<Exclude<EnemyId, 'boss'>, number>>;

interface WavePlan {
  /** Number of waves. */
  waves: number;
  /** Enemies in wave 1, and extra enemies per following wave. */
  count: number;
  growth: number;
  /** Seconds between spawns in the first and last wave (interpolated). */
  interval: [number, number];
  /** Enemy composition by wave index (weights). */
  mix: (wave: number) => Mix;
  /** Chests by wave number (1-based) → tier, spawned a few seconds into that wave. */
  chests?: Record<number, ChestTier>;
  /** Extra hand-made groups for specific waves (1-based), e.g. the boss. */
  extra?: Record<number, SpawnGroup[]>;
  /**
   * Elite enemies by original wave number (1-based, same numbering as `chests`). Each appears
   * once, part-way into its wave; a Mouse Captain always brings an escort of regular mice.
   */
  elites?: Record<number, EliteId>;
}

type EliteId = 'brute' | 'ironclad' | 'thief' | 'captain';

/** Spawn groups for one elite: it walks in ~40% into the wave (Captain + 4-mouse escort). */
function eliteGroups(id: EliteId, span: number): SpawnGroup[] {
  const delay = Math.max(2, span * 0.4);
  const g: SpawnGroup[] = [{ enemy: id, count: 1, interval: 1, delay }];
  if (id === 'captain') g.push({ enemy: 'normal', count: 4, interval: 0.55, delay: delay + 0.5 });
  return g;
}

/** Built waves; `progressScale` = how many original waves one played wave spans. */
export type BuiltWaves = WaveDef[] & { progressScale?: number };

function buildWaves(p: WavePlan): BuiltWaves {
  // Fewer waves (BALANCE.waves.countScale), same arc: wave sizes, mix and timing follow the
  // original plan's progress, so wave 1 and the final wave look like the original ones.
  const n = Math.max(3, Math.round(p.waves * BALANCE.waves.countScale));
  const stretch = n > 1 ? (p.waves - 1) / (n - 1) : 1;
  const toNew = (k: number) => Math.max(1, Math.min(n, k >= p.waves ? n : Math.round((k - 1) / stretch) + 1));
  const out: BuiltWaves = [];
  for (let w = 0; w < n; w++) {
    const t = n > 1 ? w / (n - 1) : 0;
    const wo = w * stretch; // position in the original plan
    const total = Math.round(p.count + p.growth * wo);
    const interval = p.interval[0] + (p.interval[1] - p.interval[0]) * t;
    const span = total * interval;
    const mix = Object.entries(p.mix(Math.round(wo))).filter(([, v]) => (v ?? 0) > 0) as [EnemyId, number][];
    const weightSum = mix.reduce((a, [, v]) => a + v, 0);
    const groups: SpawnGroup[] = [];
    let assigned = 0;
    mix.forEach(([enemy, weight], i) => {
      const cnt = i === mix.length - 1 ? total - assigned : Math.max(1, Math.round((total * weight) / weightSum));
      assigned += cnt;
      if (cnt <= 0) return;
      // Spread each type across the whole wave so types interleave.
      groups.push({ enemy, count: cnt, interval: span / cnt, delay: (i * interval) / Math.max(1, mix.length) });
    });
    out.push({ groups });
  }
  // Every chest of the original plan is kept (never fewer skill chances); two landing in the
  // same wave are spaced out.
  for (const [k, tier] of Object.entries(p.chests ?? {})) {
    const wave = out[toNew(Number(k)) - 1];
    const already = wave.groups.filter((g) => 'chest' in g).length;
    const span = wave.groups.reduce((m, g) => Math.max(m, 'count' in g ? g.count * g.interval : 0), 0);
    wave.groups.push({ chest: tier, delay: Math.min(5, span * 0.3) + already * 4 });
  }
  for (const [k, groups] of Object.entries(p.extra ?? {})) out[toNew(Number(k)) - 1].groups.push(...groups);
  for (const [k, id] of Object.entries(p.elites ?? {})) {
    const wave = out[toNew(Number(k)) - 1];
    const span = wave.groups.reduce((m, g) => Math.max(m, 'count' in g ? g.count * g.interval + (g.delay ?? 0) : 0), 0);
    wave.groups.push(...eliteGroups(id, span));
  }
  out.progressScale = stretch;
  return out;
}

// ---- Placement tile sets (ids are "col-row" on the compact map, see maps.ts) ----
// The core eight tiles sit between the road passes, so each covers two stretches of road.
const CORE = ['1-1', '2-1', '1-2', '2-2', '2-4', '3-4', '2-5', '3-5'];

const STAGES: StageDef[] = [
  {
    id: '1-1',
    number: 1,
    roster: ['kitten', 'tabby'],
    fixedRoster: true,
    tiles: [...CORE],
    startFish: 12,
    baseHp: 10,
    hpScale: 1.6,
    waveHpGrowth: 0.03,
    waves: buildWaves({ waves: 6, count: 5, growth: 1.2, interval: [1.7, 1.2], mix: () => ({ normal: 1 }) }),
    rewards: { firstClear: 30, replay: 10 },
  },
  {
    id: '1-2',
    number: 2,
    roster: ['kitten', 'tabby'],
    fixedRoster: true,
    tiles: [...CORE, '4-1', '4-2', '0-4', '0-5'],
    startFish: 14,
    baseHp: 10,
    hpScale: 2.0,
    waveHpGrowth: 0.12,
    waves: buildWaves({ waves: 9, count: 7, growth: 1.3, interval: [1.4, 0.95], mix: () => ({ normal: 1 }) }),
    rewards: { firstClear: 35, replay: 12 },
  },
  {
    id: '1-3',
    number: 3,
    roster: ['kitten', 'tabby', 'orange'],
    fixedRoster: true,
    tiles: [...CORE, '4-1', '4-2', '0-4', '0-5', '1-7', '2-7'],
    startFish: 12,
    baseHp: 10,
    hpScale: 4.3,
    waveHpGrowth: 0.12,
    waves: buildWaves({
      waves: 10,
      count: 8,
      growth: 1.4,
      interval: [1.3, 0.85],
      mix: () => ({ normal: 1 }),
      chests: { 3: 'bronze', 6: 'bronze', 9: 'bronze' },
    }),
    rewards: { firstClear: 40, replay: 14 },
  },
  {
    id: '1-4',
    number: 4,
    roster: ['kitten', 'tabby', 'orange'],
    fixedRoster: true,
    tiles: [...CORE, '4-1', '4-2', '0-4', '0-5', '1-7', '2-7', '0-2'],
    startFish: 12,
    baseHp: 10,
    hpScale: 4.5,
    waveHpGrowth: 0.083,
    waves: buildWaves({
      waves: 14,
      count: 9,
      growth: 1.4,
      interval: [1.2, 0.75],
      mix: (w) => (w < 1 ? { normal: 1 } : { normal: 3, fast: Math.min(1.6, 0.5 + w * 0.12) }),
      chests: { 4: 'bronze', 8: 'bronze', 11: 'bronze' },
    }),
    rewards: { firstClear: 45, replay: 15 },
  },
  {
    id: '1-5',
    number: 5,
    roster: ['kitten', 'tabby', 'orange', 'black'],
    fixedRoster: true,
    tiles: [...CORE, '4-1', '4-2', '0-4', '0-5', '1-7', '2-7', '0-2', '4-6'],
    startFish: 12,
    baseHp: 10,
    hpScale: 4.6,
    waveHpGrowth: 0.08,
    waves: buildWaves({
      waves: 14,
      count: 10,
      growth: 1.5,
      interval: [1.15, 0.7],
      mix: (w) => ({ normal: 3, fast: w > 0 ? 1.5 : 0 }),
      chests: { 3: 'bronze', 7: 'silver', 11: 'bronze' },
      elites: { 9: 'brute' },
    }),
    rewards: { firstClear: 50, replay: 16 },
  },
  {
    id: '1-6',
    number: 6,
    roster: ['kitten', 'tabby', 'orange', 'black'],
    fixedRoster: true,
    tiles: [...CORE, '4-1', '4-2', '0-4', '0-5', '1-7', '2-7', '0-2', '4-6', '4-4'],
    startFish: 12,
    baseHp: 10,
    hpScale: 4.7,
    waveHpGrowth: 0.055,
    waves: buildWaves({
      waves: 15,
      count: 10,
      growth: 1.5,
      interval: [1.15, 0.7],
      mix: (w) => (w === 1 ? { normal: 4, armored: 1 } : { normal: 3, fast: 1, armored: w > 1 ? 0.4 + w * 0.07 : 0 }),
      chests: { 3: 'bronze', 7: 'silver', 11: 'bronze' },
      elites: { 6: 'brute', 12: 'thief' },
    }),
    rewards: { firstClear: 55, replay: 18 },
  },
  {
    id: '1-7',
    number: 7,
    roster: ['kitten', 'tabby', 'orange', 'black', 'white'],
    tiles: [...CORE, '4-1', '4-2', '0-4', '0-5', '1-7', '2-7', '0-2', '4-6', '4-4', '0-1'],
    startFish: 12,
    baseHp: 10,
    hpScale: 3.68,
    waveHpGrowth: 0.0981,
    waves: buildWaves({
      waves: 17,
      count: 11,
      growth: 1.6,
      interval: [1.1, 0.65],
      mix: (w) => (w < 2 ? { normal: 3, fast: 0.8 } : { normal: 3, fast: 1.2, armored: 0.3 + w * 0.075 }),
      chests: { 3: 'bronze', 6: 'silver', 10: 'bronze', 13: 'silver' },
      elites: { 5: 'thief', 10: 'brute', 15: 'ironclad' },
    }),
    rewards: { firstClear: 60, replay: 20 },
  },
  {
    id: '1-8',
    number: 8,
    roster: ['kitten', 'tabby', 'orange', 'black', 'white'],
    tiles: [...CORE, '4-1', '4-2', '0-4', '0-5', '1-7', '2-7', '0-2', '4-6', '4-4', '0-1', '4-7'],
    startFish: 12,
    baseHp: 10,
    hpScale: 2.88,
    waveHpGrowth: 0.0852,
    waves: buildWaves({
      waves: 17,
      count: 11,
      growth: 1.7,
      interval: [1.1, 0.62],
      mix: (w) => (w === 1 ? { normal: 3, shielded: 1 } : { normal: 3, fast: 1, armored: 0.8, shielded: w > 1 ? 1 + w * 0.05 : 0 }),
      chests: { 3: 'bronze', 6: 'silver', 10: 'bronze', 13: 'silver' },
      elites: { 6: 'ironclad', 10: 'captain', 15: 'brute' },
    }),
    rewards: { firstClear: 70, replay: 22 },
  },
  {
    id: '1-9',
    number: 9,
    roster: ['kitten', 'tabby', 'orange', 'black', 'white'],
    tiles: [...CORE, '4-1', '4-2', '0-4', '0-5', '1-7', '2-7', '0-2', '4-6', '4-4', '0-1', '4-7', '0-3', '0-6'],
    startFish: 12,
    baseHp: 10,
    hpScale: 2.8,
    waveHpGrowth: 0.0943,
    waves: buildWaves({
      waves: 18,
      count: 12,
      growth: 1.8,
      interval: [1.05, 0.58],
      mix: (w) => ({ normal: 3, fast: 1.5, armored: 1 + w * 0.05, shielded: 1 + w * 0.05 }),
      chests: { 3: 'bronze', 6: 'silver', 9: 'bronze', 12: 'silver', 14: 'bronze' },
      elites: { 5: 'thief', 9: 'captain', 13: 'ironclad', 17: 'brute' },
    }),
    rewards: { firstClear: 80, replay: 25 },
  },
  {
    id: '1-10',
    number: 10,
    roster: ['kitten', 'tabby', 'orange', 'black', 'white'],
    tiles: [...CORE, '4-1', '4-2', '0-4', '0-5', '1-7', '2-7', '0-2', '4-6', '4-4', '0-1', '4-7', '0-3', '4-5', '0-6', '4-3', '0-7'], // every Chapter 1 tile is open by the finale
    startFish: 12,
    baseHp: 10,
    hpScale: 2.76,
    waveHpGrowth: 0.0696,
    isBoss: true,
    waves: buildWaves({
      waves: 21,
      count: 12,
      growth: 1.8,
      interval: [1.05, 0.6],
      mix: (w) => (w === 20 ? { normal: 2, shielded: 1 } : { normal: 3, fast: 1.5, armored: 1 + w * 0.05, shielded: 1 + w * 0.05 }),
      chests: { 3: 'bronze', 7: 'silver', 11: 'gold', 15: 'silver', 19: 'bronze' },
      extra: { 21: [{ enemy: 'boss', count: 1, interval: 1, delay: 3 }] },
      elites: { 4: 'brute', 8: 'thief', 12: 'captain', 16: 'ironclad', 19: 'brute' },
    }),
    rewards: { firstClear: 150, replay: 40 },
  },
];

// ---------------------------------------------------------------------------
// Chapter 2 — Moonlit Mushroom Forest (spiral road, cat house in the middle)
// ---------------------------------------------------------------------------
// Same enemies and systems as Chapter 1; difficulty comes from bigger, mixed waves,
// tougher HP/armor, more speed variety and fewer (but better-covering) tiles, so
// positioning and merging matter more. Tile ids refer to MUSHROOM_MAP.
const ALL_CATS: StageDef['roster'] = ['kitten', 'tabby', 'orange', 'black', 'white'];
const RING = ['1-1', '1-2', '1-3', '1-4', '1-5', '2-1', '2-2', '2-3', '2-4', '2-5', '4-2', '4-3', '4-4', '4-5', '3-5'];
/** Extra tiles in the order they open across Chapter 2. */
const RING_EXTRA = ['2-0', '2-7', '3-0', '3-7', '1-0', '1-7', '4-0', '4-7'];
const ring = (extra: number) => [...RING, ...RING_EXTRA.slice(0, extra)];

const CH2_STAGES: StageDef[] = [
  {
    id: '2-1',
    number: 1,
    roster: ALL_CATS,
    tiles: ring(2),
    startFish: 16,
    baseHp: 10,
    hpScale: 3.105,
    waveHpGrowth: 0.1276,
    waves: buildWaves({
      waves: 12,
      count: 10,
      growth: 1.4,
      interval: [1.1, 0.7],
      mix: (w) => ({ normal: 3, fast: 1, armored: w > 2 ? 0.6 : 0 }),
      chests: { 3: 'bronze', 7: 'silver', 10: 'bronze' },
      elites: { 5: 'brute', 9: 'thief' },
    }),
    rewards: { firstClear: 90, replay: 28 },
  },
  {
    id: '2-2',
    number: 2,
    roster: ALL_CATS,
    tiles: ring(3),
    startFish: 16,
    baseHp: 10,
    hpScale: 2.828,
    waveHpGrowth: 0.0893,
    waves: buildWaves({
      waves: 13,
      count: 11,
      growth: 1.5,
      interval: [1.05, 0.68],
      mix: (w) => ({ normal: 3, fast: 1, shielded: w > 1 ? 1 : 0 }),
      chests: { 3: 'bronze', 7: 'silver', 11: 'bronze' },
      elites: { 4: 'thief', 8: 'captain', 12: 'brute' },
    }),
    rewards: { firstClear: 95, replay: 30 },
  },
  {
    id: '2-3',
    number: 3,
    roster: ALL_CATS,
    tiles: ring(4),
    startFish: 16,
    baseHp: 10,
    hpScale: 3.667,
    waveHpGrowth: 0.1034,
    waves: buildWaves({
      waves: 14,
      count: 12,
      growth: 1.5,
      interval: [1.0, 0.62],
      // "Rush hour": many Zippy Mice mixed with slow knights — speed variety.
      mix: (w) => ({ normal: 2, fast: 2 + w * 0.1, armored: w > 2 ? 0.8 : 0 }),
      chests: { 3: 'bronze', 7: 'silver', 11: 'silver' },
      elites: { 5: 'ironclad', 9: 'captain', 13: 'thief' },
    }),
    rewards: { firstClear: 100, replay: 32 },
  },
  {
    id: '2-4',
    number: 4,
    roster: ALL_CATS,
    tiles: ring(4),
    startFish: 16,
    baseHp: 10,
    hpScale: 2.963,
    waveHpGrowth: 0.1022,
    armorBonus: 1,
    waves: buildWaves({
      waves: 15,
      count: 12,
      growth: 1.6,
      interval: [1.0, 0.6],
      mix: (w) => ({ normal: 3, fast: 1, armored: 1 + w * 0.08, shielded: w > 3 ? 0.8 : 0 }),
      chests: { 3: 'bronze', 6: 'silver', 10: 'bronze', 13: 'silver' },
      elites: { 4: 'brute', 8: 'ironclad', 10: 'brute', 12: 'captain', 14: 'thief' },
    }),
    rewards: { firstClear: 105, replay: 34 },
  },
  {
    id: '2-5',
    number: 5,
    roster: ALL_CATS,
    tiles: ring(5),
    startFish: 16,
    baseHp: 10,
    hpScale: 2.662,
    waveHpGrowth: 0.0895,
    armorBonus: 1,
    waves: buildWaves({
      waves: 16,
      count: 12,
      growth: 1.7,
      interval: [0.98, 0.58],
      mix: (w) => ({ normal: 3, fast: 1.2, armored: 1 + w * 0.06, shielded: 1 + w * 0.06 }),
      chests: { 3: 'bronze', 7: 'silver', 11: 'gold', 14: 'bronze' },
      elites: { 4: 'captain', 8: 'thief', 12: 'ironclad', 15: 'brute' },
    }),
    rewards: { firstClear: 110, replay: 36 },
  },
  {
    id: '2-6',
    number: 6,
    roster: ALL_CATS,
    tiles: ring(6),
    startFish: 16,
    baseHp: 10,
    hpScale: 3.195,
    waveHpGrowth: 0.1047,
    armorBonus: 1,
    waves: buildWaves({
      waves: 16,
      count: 14,
      growth: 1.9,
      interval: [0.92, 0.52],
      // Swarm stage: lots of light mice — splash (Orange) and range (Black) shine.
      mix: (w) => ({ normal: 4, fast: 2, shielded: w > 2 ? 0.8 : 0 }),
      chests: { 3: 'bronze', 6: 'silver', 10: 'silver', 14: 'bronze' },
      elites: { 4: 'ironclad', 7: 'brute', 11: 'captain', 15: 'thief' },
    }),
    rewards: { firstClear: 115, replay: 38 },
  },
  {
    id: '2-7',
    number: 7,
    roster: ALL_CATS,
    tiles: ring(6),
    startFish: 16,
    baseHp: 10,
    hpScale: 2.085,
    waveHpGrowth: 0.1257,
    armorBonus: 2,
    waves: buildWaves({
      waves: 17,
      count: 13,
      growth: 1.8,
      interval: [0.95, 0.55],
      // Iron march: knights and guards — Black Cat's piercing shots and Noble White's charm matter.
      mix: (w) => ({ normal: 2, fast: 1, armored: 1.5 + w * 0.08, shielded: 1.2 + w * 0.06 }),
      chests: { 3: 'bronze', 7: 'silver', 11: 'gold', 15: 'bronze' },
      elites: { 4: 'thief', 8: 'captain', 12: 'brute', 16: 'ironclad' },
    }),
    rewards: { firstClear: 120, replay: 40 },
  },
  {
    id: '2-8',
    number: 8,
    roster: ALL_CATS,
    tiles: ring(7),
    startFish: 16,
    baseHp: 10,
    hpScale: 2.542,
    waveHpGrowth: 0.111,
    armorBonus: 2,
    waves: buildWaves({
      waves: 18,
      count: 14,
      growth: 1.9,
      interval: [0.92, 0.52],
      mix: (w) => ({ normal: 3, fast: 1.5 + w * 0.05, armored: 1.2 + w * 0.06, shielded: 1.2 + w * 0.06 }),
      chests: { 3: 'bronze', 6: 'silver', 10: 'silver', 14: 'gold', 17: 'bronze' },
      elites: { 4: 'brute', 8: 'ironclad', 12: 'captain', 14: 'thief', 16: 'thief' },
    }),
    rewards: { firstClear: 130, replay: 42 },
  },
  {
    id: '2-9',
    number: 9,
    roster: ALL_CATS,
    tiles: ring(8),
    startFish: 16,
    baseHp: 10,
    hpScale: 2.737,
    waveHpGrowth: 0.0959,
    armorBonus: 2,
    waves: buildWaves({
      waves: 19,
      count: 15,
      growth: 2.0,
      interval: [0.9, 0.5],
      mix: (w) => ({ normal: 3, fast: 1.8, armored: 1.4 + w * 0.06, shielded: 1.4 + w * 0.06 }),
      chests: { 3: 'bronze', 7: 'silver', 11: 'gold', 15: 'silver', 18: 'bronze' },
      elites: { 4: 'captain', 8: 'thief', 12: 'ironclad', 15: 'brute', 18: 'captain' },
    }),
    rewards: { firstClear: 140, replay: 45 },
  },
  {
    id: '2-10',
    number: 10,
    roster: ALL_CATS,
    tiles: ring(8),
    startFish: 16,
    baseHp: 10,
    hpScale: 2.75,
    waveHpGrowth: 0.0949,
    armorBonus: 2,
    isBoss: true,
    waves: buildWaves({
      waves: 21,
      count: 15,
      growth: 1.9,
      interval: [0.9, 0.52],
      // The final wave is lighter so the Mushroom King gets the spotlight.
      mix: (w) => (w === 20 ? { normal: 2, shielded: 1 } : { normal: 3, fast: 1.6, armored: 1.3 + w * 0.05, shielded: 1.3 + w * 0.05 }),
      chests: { 3: 'bronze', 7: 'silver', 11: 'gold', 15: 'silver', 19: 'gold' },
      extra: {
        21: [
          { enemy: 'mushroomKing', count: 1, interval: 1, delay: 3 },
          { enemy: 'captain', count: 1, interval: 1, delay: 6 },
        ],
      },
      elites: { 4: 'ironclad', 8: 'captain', 12: 'thief', 16: 'brute', 19: 'captain' },
    }),
    rewards: { firstClear: 250, replay: 60 },
  },

  // ---- Chapter 2, part two (2-11 … 2-20): deeper into the moonlit forest -----------------
  // Every stage uses the full 23-tile board and has its own tactical theme built from the
  // existing mice and elites (no new stat inflation): escorts, thieves, armor, parades, a
  // mini-boss (2-15), speed, a fortress, a grand escort and the final boss (2-20).
  // ~11–14 played waves, spawn intervals no denser than 2-9/2-10.
  {
    id: '2-11',
    number: 11,
    roster: ALL_CATS,
    tiles: ring(8),
    startFish: 16,
    baseHp: 10,
    hpScale: 2.6,
    waveHpGrowth: 0.105,
    armorBonus: 2,
    waves: buildWaves({
      waves: 15,
      count: 13,
      growth: 1.6,
      interval: [0.95, 0.62],
      // Spore Drift: leaf-shielded mice marching behind Mouse Captains.
      mix: (w) => ({ normal: 3, fast: 0.8, shielded: 1.6 + w * 0.05, armored: 0.8 }),
      chests: { 3: 'bronze', 7: 'silver', 11: 'gold', 14: 'bronze' },
      elites: { 4: 'captain', 9: 'captain', 11: 'ironclad', 13: 'brute' },
    }),
    rewards: { firstClear: 150, replay: 46 },
  },
  {
    id: '2-12',
    number: 12,
    roster: ALL_CATS,
    tiles: ring(8),
    startFish: 16,
    baseHp: 10,
    hpScale: 3.0,
    waveHpGrowth: 0.12,
    armorBonus: 2,
    waves: buildWaves({
      waves: 15,
      count: 13,
      growth: 1.6,
      interval: [0.95, 0.62],
      // Thief Night: three Cheese Thieves test "First" targeting near the exit.
      mix: (w) => ({ normal: 3, fast: 1.0, shielded: 0.8, armored: w > 1 ? 0.9 : 0 }),
      chests: { 3: 'bronze', 7: 'silver', 11: 'gold', 14: 'bronze' },
      elites: { 3: 'thief', 7: 'thief', 9: 'captain', 11: 'thief', 14: 'brute' },
    }),
    rewards: { firstClear: 160, replay: 48 },
  },
  {
    id: '2-13',
    number: 13,
    roster: ALL_CATS,
    tiles: ring(8),
    startFish: 16,
    baseHp: 10,
    hpScale: 2.65,
    waveHpGrowth: 0.115,
    armorBonus: 2,
    waves: buildWaves({
      waves: 16,
      count: 13,
      growth: 1.6,
      interval: [0.95, 0.62],
      // Iron March: armor everywhere — big hits, Armor Break and poison shine.
      mix: (w) => ({ normal: 3, armored: 1.6 + w * 0.05, fast: 0.6, shielded: 0.6 }),
      chests: { 3: 'bronze', 7: 'silver', 11: 'gold', 15: 'bronze' },
      elites: { 4: 'ironclad', 8: 'ironclad', 12: 'captain', 13: 'brute', 15: 'ironclad' },
    }),
    rewards: { firstClear: 170, replay: 50 },
  },
  {
    id: '2-14',
    number: 14,
    roster: ALL_CATS,
    tiles: ring(8),
    startFish: 16,
    baseHp: 10,
    hpScale: 2.65,
    waveHpGrowth: 0.1,
    armorBonus: 2,
    waves: buildWaves({
      waves: 17,
      count: 13,
      growth: 1.6,
      interval: [0.95, 0.6],
      // Captains' Parade: three escorted Captains — break the guard first.
      mix: (w) => ({ normal: 3.5, fast: 1, shielded: 1.1, armored: 0.8 + w * 0.03 }),
      chests: { 3: 'bronze', 7: 'silver', 11: 'gold', 15: 'silver' },
      elites: { 3: 'captain', 7: 'captain', 10: 'thief', 13: 'captain', 16: 'brute' },
    }),
    rewards: { firstClear: 180, replay: 52 },
  },
  {
    id: '2-15',
    number: 15,
    roster: ALL_CATS,
    tiles: ring(8),
    startFish: 16,
    baseHp: 10,
    hpScale: 2.7,
    waveHpGrowth: 0.11,
    armorBonus: 2,
    miniBoss: true,
    waves: buildWaves({
      waves: 17,
      count: 13,
      growth: 1.6,
      interval: [0.95, 0.6],
      // Mini-boss: the Cheese King returns, guarded by two Mouse Captains.
      mix: (w) => (w === 16 ? { normal: 2, shielded: 1 } : { normal: 3, fast: 1.1, armored: 1, shielded: 1 }),
      chests: { 3: 'bronze', 7: 'silver', 11: 'gold', 15: 'silver' },
      elites: { 5: 'brute', 10: 'ironclad', 14: 'thief', 17: 'captain' },
      extra: {
        17: [
          { enemy: 'boss', count: 1, interval: 1, delay: 3 },
          { enemy: 'captain', count: 1, interval: 1, delay: 5 },
        ],
      },
    }),
    rewards: { firstClear: 200, replay: 56 },
  },
  {
    id: '2-16',
    number: 16,
    roster: ALL_CATS,
    tiles: ring(8),
    startFish: 16,
    baseHp: 10,
    hpScale: 2.7,
    waveHpGrowth: 0.115,
    armorBonus: 2,
    waves: buildWaves({
      waves: 17,
      count: 13,
      growth: 1.7,
      interval: [0.95, 0.6],
      // Moonlit Mix: every mouse type at once — a test of a balanced formation.
      mix: (w) => ({ normal: 3, fast: 1.2, armored: 1.1 + w * 0.03, shielded: 1.1 + w * 0.03 }),
      chests: { 3: 'bronze', 7: 'silver', 11: 'gold', 15: 'silver' },
      elites: { 3: 'thief', 6: 'brute', 10: 'ironclad', 13: 'captain', 16: 'brute' },
    }),
    rewards: { firstClear: 205, replay: 58 },
  },
  {
    id: '2-17',
    number: 17,
    roster: ALL_CATS,
    tiles: ring(8),
    startFish: 16,
    baseHp: 10,
    hpScale: 3.2,
    waveHpGrowth: 0.12,
    armorBonus: 2,
    waves: buildWaves({
      waves: 18,
      count: 13,
      growth: 1.6,
      interval: [0.95, 0.62],
      // Swift Shadows: speed — spread out (slower spawns), so it's about slows and "First".
      mix: (w) => ({ normal: 3, fast: 1.8, shielded: 1, armored: w > 4 ? 0.8 : 0 }),
      chests: { 3: 'bronze', 7: 'silver', 11: 'gold', 15: 'silver', 18: 'bronze' },
      elites: { 3: 'thief', 7: 'thief', 9: 'ironclad', 11: 'captain', 14: 'thief', 17: 'brute' },
    }),
    rewards: { firstClear: 210, replay: 60 },
  },
  {
    id: '2-18',
    number: 18,
    roster: ALL_CATS,
    tiles: ring(8),
    startFish: 16,
    baseHp: 10,
    hpScale: 2.75,
    waveHpGrowth: 0.115,
    armorBonus: 3,
    waves: buildWaves({
      waves: 18,
      count: 12,
      growth: 1.6,
      interval: [1.0, 0.65],
      // Fortress: slow, heavily armored columns — a positioning and armor-break puzzle.
      mix: (w) => ({ normal: 3, armored: 1.8 + w * 0.04, shielded: 1, fast: 0.5 }),
      chests: { 3: 'bronze', 7: 'silver', 11: 'gold', 15: 'silver', 18: 'bronze' },
      elites: { 4: 'ironclad', 8: 'brute', 12: 'ironclad', 15: 'captain', 18: 'brute' },
    }),
    rewards: { firstClear: 220, replay: 62 },
  },
  {
    id: '2-19',
    number: 19,
    roster: ALL_CATS,
    tiles: ring(8),
    startFish: 16,
    baseHp: 10,
    hpScale: 2.75,
    waveHpGrowth: 0.11,
    armorBonus: 3,
    waves: buildWaves({
      waves: 19,
      count: 13,
      growth: 1.7,
      interval: [0.95, 0.6],
      // Grand Escort: every elite role in one march.
      mix: (w) => ({ normal: 3, fast: 1.2, armored: 1.2 + w * 0.03, shielded: 1.2 + w * 0.03 }),
      chests: { 3: 'bronze', 7: 'silver', 11: 'gold', 15: 'silver', 18: 'gold' },
      elites: { 5: 'captain', 7: 'thief', 9: 'ironclad', 12: 'captain', 15: 'brute', 18: 'captain' },
    }),
    rewards: { firstClear: 230, replay: 64 },
  },
  {
    id: '2-20',
    number: 20,
    roster: ALL_CATS,
    tiles: ring(8),
    startFish: 16,
    baseHp: 10,
    hpScale: 2.75,
    waveHpGrowth: 0.105,
    armorBonus: 3,
    isBoss: true,
    waves: buildWaves({
      waves: 20,
      count: 13,
      growth: 1.7,
      interval: [0.95, 0.6],
      // Final boss: the Moonshadow Emperor (veil regrows once at half HP). Its wave is light.
      mix: (w) => (w === 19 ? { normal: 2, shielded: 1 } : { normal: 3, fast: 1.2, armored: 1.2 + w * 0.03, shielded: 1.2 + w * 0.03 }),
      chests: { 3: 'bronze', 7: 'silver', 11: 'gold', 15: 'silver', 18: 'gold' },
      elites: { 4: 'ironclad', 8: 'captain', 12: 'thief', 15: 'brute', 16: 'thief', 18: 'captain' },
      extra: { 20: [{ enemy: 'moonEmperor', count: 1, interval: 1, delay: 3 }] },
    }),
    rewards: { firstClear: 350, replay: 80 },
  },
];

// To add a chapter: give it a map in maps.ts, a stage list built like the ones above,
// names in the i18n files (`chapter.<id>`, `stage.<id>`), and append it here.
// Unlocking is linear across ALL_STAGE_IDS, so the new chapter opens after the previous boss.
export const CHAPTERS: ChapterDef[] = [
  { id: 'ch1', number: 1, name: 'Beginner Forest', mapId: 'forest_compact', stages: STAGES },
  { id: 'ch2', number: 2, name: 'Moonlit Mushroom Forest', mapId: 'mushroom', stages: CH2_STAGES },
];

// Global 1-based order (skill-shop unlock, chest scaling) — chapter-local `number` is for display.
// Shorter stages keep the same HP arc: the per-wave growth is stretched to the played wave count.
CHAPTERS.flatMap((c) => c.stages).forEach((s, i) => {
  s.order = i + 1;
  const scale = (s.waves as BuiltWaves).progressScale ?? 1;
  s.waveHpGrowth = (s.waveHpGrowth ?? BALANCE.waveHpGrowth) * Math.pow(scale, BALANCE.waveHpCurve);
});

/**
 * Tutorial replay: Stage 1-1's map, cats and gentle waves plus one bronze chest, so every
 * basic lesson (summon, move, swap, merge, targeting, chest reward, speed, Tactical Pause)
 * can be practised again. It is not part of any chapter: no unlocks, rewards or saves.
 */
export const PRACTICE_STAGE_ID = 'practice';
export const PRACTICE_STAGE: StageDef = {
  ...STAGES[0],
  id: PRACTICE_STAGE_ID,
  practice: true,
  waves: buildWaves({ waves: 6, count: 5, growth: 1.2, interval: [1.7, 1.2], mix: () => ({ normal: 1 }), chests: { 3: 'bronze' } }),
  rewards: { firstClear: 0, replay: 0 },
};

/**
 * Sir Sable's piercing lesson: his REAL attack on a small map with one straight road. Mice are
 * placed by the lesson steps; tough mice (hpScale) so each strike's reach is easy to see.
 */
export const PIERCE_LESSON_ID = 'lesson-pierce';
export const PIERCE_LESSON_STAGE: StageDef = {
  id: PIERCE_LESSON_ID,
  number: 1,
  roster: ['sable'],
  fixedRoster: true,
  practice: true,
  lesson: 'pierce',
  tiles: ['2-6', '3-4', '1-4', '3-2', '1-2'],
  startFish: 0,
  baseHp: 99,
  hpScale: 8,
  waves: [],
  startCats: [{ type: 'sable', level: 5, tile: '3-4' }],
  rewards: { firstClear: 0, replay: 0 },
};

export function findStage(stageId: string): { chapter: ChapterDef; stage: StageDef; index: number } | null {
  if (stageId === PRACTICE_STAGE_ID) return { chapter: CHAPTERS[0], stage: PRACTICE_STAGE, index: 0 };
  if (stageId === PIERCE_LESSON_ID) return { chapter: { ...CHAPTERS[1], mapId: 'pierce_lesson' }, stage: PIERCE_LESSON_STAGE, index: 0 };
  for (const chapter of CHAPTERS) {
    const index = chapter.stages.findIndex((s) => s.id === stageId);
    if (index >= 0) return { chapter, stage: chapter.stages[index], index };
  }
  return null;
}

/** Linear order of all stages across chapters (for unlock progression). */
export const ALL_STAGE_IDS: string[] = CHAPTERS.flatMap((c) => c.stages.map((s) => s.id));
